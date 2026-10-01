# Feature Task: Auto-Bid (Cap Bid) System

## Overview

Implement an **Auto-Bid** feature where a user can set a maximum cap amount on an auction. Instead of manually placing individual bids, the system automatically bids on the user's behalf whenever another bidder places a higher bid — until the cap is exhausted.

---

## Feature Requirements

### 1. Auto-Bid Configuration

A user should be able to set an auto-bid on any active auction they're allowed to bid on (not their own). The configuration requires:

| Field | Type | Description |
|---|---|---|
| `maxAmount` | Number | The maximum amount the user is willing to pay (the cap). Must be greater than the current bid. |
| `incrementType` | Enum | Either `"fixed"` or `"percentage"` |
| `incrementValue` | Number | If `fixed`: a dollar amount (e.g., `50` means counter-bid by +$50). If `percentage`: a percentage of the current bid (e.g., `5` means counter-bid by +5% of the opposing bid). |
| `maxBidCount` | Number (optional) | Maximum number of automatic bids to place. If not set, auto-bid continues until `maxAmount` is reached. |

**Example scenarios:**

- User sets `maxAmount: 3000`, `incrementType: "fixed"`, `incrementValue: 100`. Current bid is $2500. Another user bids $2600 → system auto-bids $2700 on behalf of the cap-bid user. If someone then bids $2800 → system auto-bids $2900. If someone bids $2950 → system auto-bids $3000 (the cap). If someone then bids $3100 → auto-bid stops (cap exceeded).

- User sets `maxAmount: 5000`, `incrementType: "percentage"`, `incrementValue: 5`, `maxBidCount: 3`. Current bid is $4000. Another user bids $4100 → system auto-bids $4305 (4100 + 5%). If someone bids $4400 → system auto-bids $4620 (4400 + 5%). That's 2 of 3 auto-bids used. One more allowed, then auto-bid stops regardless of cap.

---

### 2. Rules & Constraints

- A user can only have **one active auto-bid per auction** at a time.
- Setting a new auto-bid **replaces** the previous one on that auction.
- The `maxAmount` must be **greater than** the auction's current bid.
- Auto-bid should **not trigger itself** — if the auto-bid places a counter-bid, it should not cause the same user's auto-bid to react to its own bid.
- Auto-bid should **not conflict with the seller restriction** — if the user is the auction seller, they cannot set an auto-bid.
- When an auction ends, all auto-bids on that auction are automatically **deactivated**.
- If the calculated counter-bid exceeds `maxAmount`, bid exactly `maxAmount` instead (don't skip).
- If `maxAmount` has been reached or `maxBidCount` exhausted, mark the auto-bid as `exhausted`.

---

### 3. Auto-Bid Trigger Flow

When a manual bid is placed on an auction:

1. After the bid is recorded, check for any active auto-bids on this auction from **other users** (not the person who just bid).
2. The qualifying auto-bid with the **highest cap** gets priority.
3. Calculate the counter-bid based on the `incrementType` and `incrementValue`.
4. If the counter-bid would exceed `maxAmount`, bid exactly `maxAmount`.
5. If the counter-bid can't beat the current bid, the auto-bid is exhausted.
6. The auto-bid should place the bid using the **same atomic concurrency pattern** as manual bids.
7. The auto-bid should emit the same **Socket.io events** as a manual bid so all users see real-time updates.
8. If there are **competing auto-bids** from multiple users, they should trigger against each other (a bidding war) until one side is exhausted. This must have a **safety limit** to prevent infinite loops.

---

### 4. API Requirements

The feature needs API endpoints to:

- **Create/update** an auto-bid on an auction (authenticated)
- **Retrieve** the current user's active auto-bid on an auction (authenticated)
- **Cancel** the current user's auto-bid on an auction (authenticated)

---

### 5. Frontend Requirements

- Add a way for users to set up an auto-bid from the auction room page (alongside the existing manual bid form)
- Show the auto-bid status when one is active (cap amount, bids used, whether exhausted)
- Allow cancelling an active auto-bid
- Distinguish auto-placed bids from manual bids in the bid history

---

## Testing Checklist

- [ ] User can set an auto-bid on an active auction
- [ ] User cannot set an auto-bid on their own auction
- [ ] User cannot set `maxAmount` less than or equal to current bid
- [ ] When another user places a manual bid, the auto-bid fires and places a counter-bid automatically
- [ ] Counter-bid uses correct increment (fixed amount)
- [ ] Counter-bid uses correct increment (percentage)
- [ ] Counter-bid does not exceed `maxAmount` — it caps at `maxAmount`
- [ ] After `maxBidCount` bids are placed, auto-bid is marked `exhausted`
- [ ] After `maxAmount` is reached, auto-bid is marked `exhausted`
- [ ] Two competing auto-bids trigger a bidding war until one is exhausted
- [ ] Bidding war loop does not exceed safety limit
- [ ] Auto-bid does not react to its own bids (no self-triggering)
- [ ] Setting a new auto-bid replaces the previous one
- [ ] User can cancel their auto-bid
- [ ] When auction ends, all active auto-bids are cancelled
- [ ] Socket events fire correctly for auto-placed bids (other users see real-time updates)
- [ ] UI shows auto-bid status (active/exhausted) in auction room
- [ ] Bid history distinguishes auto-placed bids from manual bids
- [ ] Atomic concurrency guard works — two simultaneous manual bids don't cause duplicate auto-bid responses

---

## Evaluation Criteria

| Area | Weight | What We're Looking For |
|---|---|---|
| **Correctness** | 30% | Auto-bid logic works as specified, edge cases handled |
| **Concurrency Safety** | 20% | Atomic operations, no race conditions in bid placement or auto-bid processing |
| **Code Quality** | 20% | Clean separation of concerns, follows existing patterns in the codebase |
| **Testing Coverage** | 15% | All checklist items passing, no regressions to existing manual bid flow |
| **UI/UX** | 15% | Auto-bid form is intuitive, status indicators are clear, real-time updates work |
