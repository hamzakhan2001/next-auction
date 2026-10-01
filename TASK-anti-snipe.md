# Feature Task: Auction Anti-Snipe (Auto-Extend)

## Overview

Implement an **Anti-Snipe** feature that automatically extends an auction's end time when a bid is placed in the final moments. This prevents "sniping" — the strategy where a bidder waits until the last few seconds to place a bid, giving other participants no time to respond.

When enabled, if a bid lands within a configured time window before the auction ends, the end time is pushed forward by a configured duration — giving all bidders a fair chance to counter.

---

## Feature Requirements

### 1. Snipe Protection Configuration

When creating an auction, the seller should be able to **optionally** enable snipe protection with these settings:

| Field | Type | Description |
|---|---|---|
| `antiSnipe` | Boolean | Whether snipe protection is enabled for this auction. Defaults to `false`. |
| `snipeWindowMinutes` | Number | The time window before auction end that triggers an extension (e.g., `5` means any bid placed in the last 5 minutes triggers it). |
| `extensionMinutes` | Number | How many minutes to add to the end time when triggered (e.g., `3` means push the deadline by 3 minutes). |
| `maxExtensions` | Number | Maximum number of times the auction can be extended (e.g., `10`). Prevents auctions from running indefinitely. |

**Example scenario:**

An auction ends at 3:00 PM. Snipe protection: `snipeWindowMinutes: 5`, `extensionMinutes: 3`, `maxExtensions: 10`.

- At 2:54 PM, User A bids. This is inside the 5-minute window (6 minutes left? No — 6 > 5, so no extension).
- At 2:56 PM, User B bids. This is inside the 5-minute window (4 minutes left). Auction extends to **3:03 PM**. Extension count: 1.
- At 2:59 PM, User A bids again. Now there are 4 minutes left until 3:03 PM — inside the window. Auction extends to **3:06 PM**. Extension count: 2.
- This continues until either no one bids in the window, or `maxExtensions` (10) is reached.

---

### 2. Rules & Constraints

- Snipe protection is **optional** — auctions without it work exactly as before. No regressions.
- The extension **only triggers** when a bid is placed within the `snipeWindowMinutes` before the current end time.
- Each extension **shifts the end time forward** from its current value (not from the original end time).
- The snipe window applies to the **new** end time after each extension — so the extended time can itself be sniped, triggering another extension.
- Once `maxExtensions` is reached, no more extensions occur — the auction ends at the last extended time regardless of late bids.
- The seller configures snipe protection **at auction creation time** and **cannot change it** once the auction is active.
- The number of extensions used so far should be tracked and visible to users in the auction room.

---

### 3. Real-Time End Time Updates

When an extension is triggered:

1. The new end time must be **broadcast to all connected clients** in the auction room via Socket.io — immediately, not on next poll.
2. The **countdown timer** on every connected client must update to reflect the new end time **without a page refresh**.
3. The auction lifecycle scheduler (the 10-second interval in the server) must respect the updated end time — it should not end an auction that has been extended.

---

### 4. API Requirements

- The auction creation endpoint must accept the snipe protection configuration fields.
- The auction detail endpoint should include snipe protection config and current extension count in its response.
- The bid placement endpoint must check whether the bid triggers an extension and apply it.

---

### 5. Frontend Requirements

- The auction creation form should have an optional section to enable and configure snipe protection.
- The auction room page should show:
  - Whether snipe protection is enabled
  - The snipe window and extension duration
  - How many extensions have been used out of the maximum (e.g., "Extensions: 3/10")
- The countdown timer must seamlessly update when an extension occurs — no flicker, no jump, no reload.

---

## Testing Checklist

- [ ] Seller can enable snipe protection when creating an auction with all required fields
- [ ] Seller can create an auction without snipe protection (feature is optional)
- [ ] Bid placed **inside** the snipe window triggers an end time extension
- [ ] Bid placed **outside** the snipe window does not trigger an extension
- [ ] End time extends by exactly `extensionMinutes` from the current end time
- [ ] Extension of the extended time works (recursive sniping — bid in the new window triggers another extension)
- [ ] Extensions stop after `maxExtensions` is reached — no further extensions even if bids land in the window
- [ ] Extension count is tracked and incremented correctly
- [ ] All connected clients receive the new end time via Socket.io in real-time
- [ ] Countdown timer updates live on all clients without page refresh or flicker
- [ ] Auction lifecycle scheduler respects the extended end time (does not end the auction prematurely)
- [ ] Auction detail API response includes snipe protection config and current extension count
- [ ] Auction creation form includes snipe protection fields with proper validation
- [ ] Auction room shows snipe protection status and extension count (e.g., "3/10 extensions used")
- [ ] Existing auctions without snipe protection are completely unaffected — no regressions
- [ ] Snipe protection settings cannot be modified after the auction becomes active

---

## Evaluation Criteria

| Area | Weight | What We're Looking For |
|---|---|---|
| **Correctness** | 30% | Extension logic works precisely — right window, right duration, right cap. No off-by-one errors on timing. |
| **Real-Time Sync** | 25% | End time updates propagate instantly to all clients. Countdown timer transitions smoothly. Scheduler respects new times. |
| **Code Quality** | 20% | Follows existing codebase patterns. Clean integration with current bid flow — no duplication of logic. |
| **No Regressions** | 15% | Auctions without snipe protection behave identically to before. Existing tests/flows unbroken. |
| **UI/UX** | 10% | Snipe config form is intuitive. Extension status is clearly visible in the auction room. |
