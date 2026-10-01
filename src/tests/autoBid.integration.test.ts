/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles / monkey-patching */
/**
 * Integration tests for the auto-bid engine against a real MongoDB.
 *
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/next-auction-test npm test
 *
 * Skipped automatically when TEST_MONGODB_URI is not set.
 *
 * Run against a real MongoDB, whose single-document operations are atomic.
 * Mongo-compatible emulators (e.g. FerretDB) do NOT make findOneAndUpdate
 * atomic, which makes the concurrency tests meaningless there. For those, set
 * TEST_EMULATE_ATOMIC_WRITES=1 to serialize findOneAndUpdate calls in-process,
 * which models Mongo's guarantee so the engine's logic can still be exercised.
 */
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import Auction from '../src/models/Auction';
import AutoBid from '../src/models/AutoBid';
import Bid from '../src/models/Bid';
import User from '../src/models/User';
import { commitBid } from '../src/lib/bidding';
import {
  setAutoBid,
  getAutoBid,
  cancelAutoBid,
  deactivateAutoBidsForAuction,
  processAutoBids,
  MAX_AUTO_BID_ITERATIONS,
} from '../src/lib/autoBid';

const URI = process.env.TEST_MONGODB_URI;

if (process.env.TEST_EMULATE_ATOMIC_WRITES === '1') {
  let tail: Promise<unknown> = Promise.resolve();
  for (const model of [Auction, AutoBid] as const) {
    const original = model.findOneAndUpdate.bind(model) as any;
    (model as any).findOneAndUpdate = (...args: unknown[]) => {
      const run = tail.then(() => original(...args));
      tail = run.catch(() => undefined);
      return run;
    };
  }
}

describe('auto-bid engine', { skip: !URI }, () => {
  let seller: Types.ObjectId;
  let users: Types.ObjectId[]; // [alice, bob, carol, dave]
  let auctionId: string;
  let emitted: Array<{ room: string; event: string; payload: any }>;

  before(async () => {
    await mongoose.connect(URI!);
    await Promise.all([AutoBid.init(), Bid.init(), Auction.init()]);
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Promise.all([
      Auction.deleteMany({}),
      AutoBid.deleteMany({}),
      Bid.deleteMany({}),
      User.deleteMany({}),
    ]);
    const mk = (n: string) =>
      User.create({ name: n, email: `${n}@x.com`, password: 'secret123' });
    const [s, ...rest] = await Promise.all(
      ['seller', 'alice', 'bob', 'carol', 'dave'].map(mk)
    );
    seller = s._id;
    users = rest.map((u) => u._id);

    auctionId = await makeAuction(2500);

    emitted = [];
    (globalThis as any).io = {
      to: (room: string) => ({
        emit: (event: string, payload: any) => emitted.push({ room, event, payload }),
      }),
    };
  });

  async function makeAuction(currentBid: number, endsInMs = 3_600_000) {
    const a = await Auction.create({
      product: new Types.ObjectId(),
      seller,
      startTime: new Date(Date.now() + 1000),
      endTime: new Date(Date.now() + endsInMs),
      currentBid,
    });
    // bypass the "start must be in the future" validation
    await Auction.updateOne(
      { _id: a._id },
      { status: 'active', startTime: new Date(Date.now() - 1000) }
    );
    return a._id.toString();
  }

  const [ALICE, BOB, CAROL, DAVE] = [0, 1, 2, 3];

  /** Mirrors what POST /bids does after validation. */
  async function manualBid(userIdx: number, amount: number) {
    const r = await commitBid({ auctionId, bidderId: users[userIdx], amount });
    if (r) await processAutoBids(auctionId);
    return r;
  }

  const fixedCfg = (maxAmount: number, incrementValue: number, maxBidCount?: number) => ({
    maxAmount,
    incrementType: 'fixed',
    incrementValue,
    maxBidCount,
  });
  const pctCfg = (maxAmount: number, incrementValue: number, maxBidCount?: number) => ({
    maxAmount,
    incrementType: 'percentage',
    incrementValue,
    maxBidCount,
  });

  async function setOk(userIdx: number, cfg: any) {
    const r = await setAutoBid(users[userIdx], auctionId, cfg);
    assert.ok(r.ok, r.ok ? '' : r.error);
  }

  async function bidAmounts() {
    const bids = await Bid.find({ auction: auctionId }).sort({ createdAt: 1, _id: 1 });
    return bids.map((b) => ({
      amount: b.amount,
      bidder: b.bidder.toString(),
      auto: b.isAutoBid,
    }));
  }

  // ---- configuration -------------------------------------------------------

  test('user can set an auto-bid on an active auction', async () => {
    const r = await setAutoBid(users[ALICE], auctionId, fixedCfg(3000, 100));
    assert.ok(r.ok);
    const stored = await getAutoBid(users[ALICE], auctionId);
    assert.equal(stored?.maxAmount, 3000);
    assert.equal(stored?.status, 'active');
    assert.equal(stored?.bidsUsed, 0);
  });

  test('seller cannot set an auto-bid on their own auction', async () => {
    const r = await setAutoBid(seller, auctionId, fixedCfg(3000, 100));
    assert.equal(r.ok, false);
  });

  test('maxAmount must be greater than the current bid', async () => {
    assert.equal((await setAutoBid(users[ALICE], auctionId, fixedCfg(2500, 100))).ok, false);
    assert.equal((await setAutoBid(users[ALICE], auctionId, fixedCfg(2000, 100))).ok, false);
    assert.equal((await setAutoBid(users[ALICE], auctionId, fixedCfg(2500.01, 100))).ok, true);
  });

  test('rejects invalid config', async () => {
    const bad = [
      { ...fixedCfg(3000, 0) },
      { ...fixedCfg(3000, -5) },
      { ...fixedCfg(3000, 10, 0) },
      { ...fixedCfg(3000, 10, 1.5) },
      { ...pctCfg(3000, 101) },
      { maxAmount: 3000, incrementType: 'weird', incrementValue: 5 },
      { maxAmount: '3000', incrementType: 'fixed', incrementValue: 5 },
    ];
    for (const cfg of bad) {
      assert.equal((await setAutoBid(users[ALICE], auctionId, cfg as any)).ok, false);
    }
  });

  test('cannot set an auto-bid on an ended auction', async () => {
    await Auction.updateOne({ _id: auctionId }, { status: 'ended' });
    assert.equal((await setAutoBid(users[ALICE], auctionId, fixedCfg(3000, 100))).ok, false);
  });

  test('setting a new auto-bid replaces the previous one', async () => {
    await setOk(ALICE, fixedCfg(3000, 100));
    await manualBid(BOB, 2600); // alice fires once
    assert.equal((await getAutoBid(users[ALICE], auctionId))?.bidsUsed, 1);

    await setOk(ALICE, pctCfg(4000, 5, 2));
    assert.equal(await AutoBid.countDocuments({ auction: auctionId, bidder: users[ALICE] }), 1);
    const replaced = await getAutoBid(users[ALICE], auctionId);
    assert.equal(replaced?.maxAmount, 4000);
    assert.equal(replaced?.incrementType, 'percentage');
    assert.equal(replaced?.maxBidCount, 2);
    assert.equal(replaced?.bidsUsed, 0);
    assert.equal(replaced?.status, 'active');
  });

  test('user can cancel their auto-bid, and it then no longer fires', async () => {
    await setOk(ALICE, fixedCfg(3000, 100));
    assert.equal(await cancelAutoBid(users[ALICE], auctionId), true);
    assert.equal(await getAutoBid(users[ALICE], auctionId), null);
    assert.equal(await cancelAutoBid(users[ALICE], auctionId), false);

    await manualBid(BOB, 2600);
    assert.equal((await bidAmounts()).length, 1);
  });

  // ---- firing & increments -------------------------------------------------

  test('fixed increments follow the spec example, ending capped at maxAmount', async () => {
    await setOk(ALICE, fixedCfg(3000, 100));

    await manualBid(BOB, 2600);
    assert.equal((await Auction.findById(auctionId))!.currentBid, 2700);

    await manualBid(BOB, 2800);
    assert.equal((await Auction.findById(auctionId))!.currentBid, 2900);

    // 2950 + 100 would be 3050: capped to exactly 3000, then exhausted
    await manualBid(BOB, 2950);
    const a = await Auction.findById(auctionId);
    assert.equal(a!.currentBid, 3000);
    assert.equal(a!.currentBidder!.toString(), users[ALICE].toString());
    assert.equal((await AutoBid.findOne({ bidder: users[ALICE] }))!.status, 'exhausted');

    // beyond the cap: auto-bid stays out of it
    await manualBid(BOB, 3100);
    const after = await Auction.findById(auctionId);
    assert.equal(after!.currentBid, 3100);
    assert.equal(after!.currentBidder!.toString(), users[BOB].toString());
  });

  test('percentage increments follow the spec example with maxBidCount', async () => {
    await Auction.updateOne({ _id: auctionId }, { currentBid: 4000 });
    await setOk(ALICE, pctCfg(5000, 5, 3));

    await manualBid(BOB, 4100);
    assert.equal((await Auction.findById(auctionId))!.currentBid, 4305);

    await manualBid(BOB, 4400);
    assert.equal((await Auction.findById(auctionId))!.currentBid, 4620);
    assert.equal((await AutoBid.findOne({ bidder: users[ALICE] }))!.status, 'active');

    // third and last allowed auto-bid: 4700 * 1.05 = 4935
    await manualBid(BOB, 4700);
    assert.equal((await Auction.findById(auctionId))!.currentBid, 4935);
    const ab = await AutoBid.findOne({ bidder: users[ALICE] });
    assert.equal(ab!.bidsUsed, 3);
    assert.equal(ab!.status, 'exhausted'); // count used up, cap (5000) not reached

    // no 4th auto-bid even though the cap has room
    await manualBid(BOB, 4940);
    const a = await Auction.findById(auctionId);
    assert.equal(a!.currentBid, 4940);
    assert.equal(a!.currentBidder!.toString(), users[BOB].toString());
  });

  test('auto-bid is marked exhausted when outbid beyond its cap', async () => {
    await setOk(ALICE, fixedCfg(3000, 100));
    await manualBid(BOB, 3500);
    assert.equal((await AutoBid.findOne({ bidder: users[ALICE] }))!.status, 'exhausted');
    assert.equal((await bidAmounts()).length, 1);
  });

  test('auto-bid does not react to its own bids (no self-triggering)', async () => {
    await setOk(ALICE, fixedCfg(3000, 100));
    // Alice bids manually; her own auto-bid must stay silent
    await manualBid(ALICE, 2600);
    let bids = await bidAmounts();
    assert.equal(bids.length, 1);
    assert.equal(bids[0].auto, false);
    assert.equal((await getAutoBid(users[ALICE], auctionId))?.bidsUsed, 0);

    // Bob outbids -> exactly one auto response, then silence
    await manualBid(BOB, 2650);
    bids = await bidAmounts();
    assert.deepEqual(
      bids.map((b) => [b.amount, b.auto]),
      [[2600, false], [2650, false], [2750, true]]
    );
    const run = await processAutoBids(auctionId);
    assert.equal(run.placed, 0);
  });

  test('auto-placed bids are flagged in the DB', async () => {
    await setOk(ALICE, fixedCfg(3000, 100));
    await manualBid(BOB, 2600);
    const bids = await bidAmounts();
    assert.deepEqual(bids.map((b) => b.auto), [false, true]);
  });

  test('the highest cap gets priority', async () => {
    await setOk(ALICE, fixedCfg(3000, 100));
    await setOk(CAROL, fixedCfg(9000, 100));
    await manualBid(BOB, 2600);
    const first = (await bidAmounts())[1];
    assert.equal(first.bidder, users[CAROL].toString());
  });

  // ---- bidding wars --------------------------------------------------------

  test('competing auto-bids fight until one is exhausted; higher cap wins', async () => {
    await setOk(ALICE, fixedCfg(3000, 100));
    await setOk(CAROL, fixedCfg(3500, 150));
    await manualBid(BOB, 2600);

    const a = await Auction.findById(auctionId);
    assert.equal(a!.currentBidder!.toString(), users[CAROL].toString());
    assert.ok(a!.currentBid >= 3000 && a!.currentBid <= 3500);
    assert.equal((await AutoBid.findOne({ bidder: users[ALICE] }))!.status, 'exhausted');

    // amounts strictly increase, no one ever outbids themselves
    const bids = await bidAmounts();
    for (let i = 1; i < bids.length; i++) {
      assert.ok(bids[i].amount > bids[i - 1].amount);
      assert.notEqual(bids[i].bidder, bids[i - 1].bidder);
    }
  });

  test('equal caps: the first to reach the cap holds it, the other is exhausted', async () => {
    await setOk(ALICE, fixedCfg(3000, 100));
    await setOk(CAROL, fixedCfg(3000, 100));
    await manualBid(BOB, 2600);
    const a = await Auction.findById(auctionId);
    assert.equal(a!.currentBid, 3000);
    const statuses = await AutoBid.find({ auction: auctionId });
    assert.ok(statuses.every((s) => s.status === 'exhausted'));
  });

  test('bidding war stops at the safety limit', async () => {
    await Auction.updateOne({ _id: auctionId }, { currentBid: 10 });
    await setOk(ALICE, fixedCfg(1_000_000, 1));
    await setOk(CAROL, fixedCfg(1_000_000, 1));

    const r = await commitBid({ auctionId, bidderId: users[BOB], amount: 11 });
    assert.ok(r);
    const run = await processAutoBids(auctionId);
    assert.equal(run.hitSafetyLimit, true);
    assert.ok(run.placed <= MAX_AUTO_BID_ITERATIONS);
    assert.equal(run.placed, MAX_AUTO_BID_ITERATIONS);
    // both sides still active; a later trigger can continue the war
    assert.equal(await AutoBid.countDocuments({ auction: auctionId, status: 'active' }), 2);
  });

  // ---- lifecycle -----------------------------------------------------------

  test('ending an auction cancels all active auto-bids', async () => {
    await setOk(ALICE, fixedCfg(3000, 100));
    await setOk(CAROL, fixedCfg(4000, 100));
    await deactivateAutoBidsForAuction(auctionId);
    assert.equal(await AutoBid.countDocuments({ auction: auctionId, status: 'active' }), 0);
    assert.equal(await AutoBid.countDocuments({ auction: auctionId, status: 'cancelled' }), 2);
  });

  test('no bids (manual or auto) are accepted once the auction has ended', async () => {
    await setOk(ALICE, fixedCfg(3000, 100));
    await Auction.updateOne({ _id: auctionId }, { endTime: new Date(Date.now() - 1000) });
    assert.equal(await commitBid({ auctionId, bidderId: users[BOB], amount: 2600 }), null);
    assert.equal((await processAutoBids(auctionId)).placed, 0);
  });

  // ---- real-time events ----------------------------------------------------

  test('auto-placed bids emit bid:placed to the auction room', async () => {
    await setOk(ALICE, fixedCfg(3000, 100));
    await manualBid(BOB, 2600);

    const events = emitted.filter((e) => e.event === 'bid:placed');
    assert.equal(events.length, 2);
    assert.ok(events.every((e) => e.room === `auction:${auctionId}`));

    const [manual, auto] = events.map((e) => e.payload);
    assert.equal(manual.bid.isAutoBid, false);
    assert.equal(manual.currentBid, 2600);
    assert.equal(auto.bid.isAutoBid, true);
    assert.equal(auto.bid.amount, 2700);
    assert.equal(auto.currentBid, 2700);
    assert.equal(auto.bid.bidder.name, 'alice');
    assert.equal(auto.auctionId, auctionId);
  });

  // ---- concurrency ---------------------------------------------------------

  test('an auto-bid commit is rejected if the state it reacted to is stale', async () => {
    await commitBid({ auctionId, bidderId: users[BOB], amount: 2600 });
    await commitBid({ auctionId, bidderId: users[CAROL], amount: 2650 });

    // computed against Bob's 2600, but Carol has since bid 2650
    const stale = await commitBid({
      auctionId,
      bidderId: users[ALICE],
      amount: 2700,
      isAutoBid: true,
      expected: { currentBid: 2600, currentBidder: users[BOB] },
    });
    assert.equal(stale, null);
    assert.equal((await Auction.findById(auctionId))!.currentBid, 2650);

    const fresh = await commitBid({
      auctionId,
      bidderId: users[ALICE],
      amount: 2750,
      isAutoBid: true,
      expected: { currentBid: 2650, currentBidder: users[CAROL] },
    });
    assert.ok(fresh);
  });

  test('a processor holding a stale snapshot re-reads and responds exactly once', async () => {
    await setOk(ALICE, fixedCfg(100000, 100));
    await commitBid({ auctionId, bidderId: users[BOB], amount: 2600 });

    // Pause the first processor right after it reads the auction (sees Bob@2600)
    const originalFindById = Auction.findById.bind(Auction) as any;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let paused!: () => void;
    const hasSnapshot = new Promise<void>((r) => (paused = r));
    let first = true;
    (Auction as any).findById = (...args: unknown[]) => {
      if (!first) return originalFindById(...args);
      first = false;
      return (async () => {
        const snapshot = await originalFindById(...args);
        paused();
        await gate;
        return snapshot;
      })();
    };

    try {
      const p1 = processAutoBids(auctionId);
      await hasSnapshot;
      // Meanwhile Carol outbids; her own trigger runs to completion first
      await commitBid({ auctionId, bidderId: users[CAROL], amount: 2650 });
      await processAutoBids(auctionId);
      release();
      await p1;
    } finally {
      (Auction as any).findById = originalFindById;
    }

    const bids = await bidAmounts();
    const autos = bids.filter((b) => b.auto);
    assert.equal(autos.length, 1, 'exactly one auto response');
    assert.equal(autos[0].amount, 2750, 'increment applied to the real leader (2650)');
    assert.equal((await AutoBid.findOne({ bidder: users[ALICE] }))!.bidsUsed, 1);
  });

  test('two simultaneous manual bids produce no duplicate auto-bid responses', async () => {
    for (let round = 0; round < 15; round++) {
      await Promise.all([
        Auction.updateOne({ _id: auctionId }, { currentBid: 2500, currentBidder: null }),
        Bid.deleteMany({}),
        AutoBid.deleteMany({}),
      ]);
      await setOk(ALICE, fixedCfg(100000, 100));

      await Promise.all([manualBid(BOB, 2600), manualBid(CAROL, 2650)]);

      const bids = await bidAmounts();
      const a = await Auction.findById(auctionId);
      const ab = await AutoBid.findOne({ bidder: users[ALICE] });

      // consistency: last bid == auction state, bid count == bidsUsed
      assert.equal(a!.currentBid, Math.max(...bids.map((b) => b.amount)));
      assert.equal(ab!.bidsUsed, bids.filter((b) => b.auto).length);
      // alice never outbids herself, amounts never repeat
      const sorted = [...bids].sort((x, y) => x.amount - y.amount);
      for (let i = 1; i < sorted.length; i++) {
        assert.notEqual(sorted[i].amount, sorted[i - 1].amount);
        assert.ok(!(sorted[i].auto && sorted[i - 1].bidder === sorted[i].bidder));
      }
      // exactly one auto response per leader change, and alice leads at the end
      assert.equal(a!.currentBidder!.toString(), users[ALICE].toString());
      assert.ok(bids.filter((b) => b.auto).length <= 2);
    }
  });

  test('concurrent flood of manual bids + competing auto-bids stays consistent', async () => {
    await setOk(ALICE, fixedCfg(50000, 25));
    await setOk(BOB, pctCfg(50000, 1));

    const manual = [DAVE, CAROL].flatMap((u, i) =>
      Array.from({ length: 8 }, (_, k) => manualBid(u, 2600 + k * 40 + i * 7))
    );
    await Promise.all(manual);

    const bids = await bidAmounts();
    const a = await Auction.findById(auctionId);
    assert.equal(a!.currentBid, Math.max(...bids.map((b) => b.amount)));

    const winnerBid = [...bids].sort((x, y) => y.amount - x.amount)[0];
    assert.equal(a!.currentBidder!.toString(), winnerBid.bidder);

    for (const u of [ALICE, BOB]) {
      const ab = await AutoBid.findOne({ bidder: users[u] });
      const count = bids.filter((b) => b.auto && b.bidder === users[u].toString()).length;
      assert.equal(ab!.bidsUsed, count, 'bidsUsed matches auto-bids actually placed');
    }
    // no two identical amounts
    assert.equal(new Set(bids.map((b) => b.amount)).size, bids.length);
  });
});
