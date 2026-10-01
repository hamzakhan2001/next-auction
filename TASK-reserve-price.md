# Feature Task: Reserve Price (Hidden Minimum)

## Overview

Implement a **Reserve Price** feature that allows a seller to set a secret minimum price when creating an auction. Bidding proceeds normally, but if the highest bid does not meet or exceed the reserve price when the auction ends, **there is no winner** — even if bids were placed. Bidders can see whether the reserve has been met or not, but they should **never** see the actual reserve amount.

---

## Feature Requirements

### 1. Reserve Price Configuration

When creating an auction, the seller should be able to **optionally** set a reserve price:

| Field | Type | Description |
|---|---|---|
| `reservePrice` | Number (optional) | The minimum price the seller is willing to accept. If set, the highest bid must meet or exceed this amount for a winner to be declared. |

- The reserve price must be **greater than** the starting price of the auction.
- The reserve price is **optional** — auctions without one work exactly as before.

**Example scenario:**

A seller lists a Vintage Rolex with a starting price of $5,000 and sets a reserve price of $8,000.

- Bidders bid: $5,200 → $5,500 → $6,000 → $7,200. The indicator shows "Reserve not met" throughout.
- Someone bids $8,100. The indicator changes to "Reserve met".
- Auction ends at $8,100. Since $8,100 >= $8,000 (reserve), the highest bidder wins.

**Alternate scenario (reserve not met):**

- Same setup, but the highest bid is $7,500 when the auction ends.
- Auction ends with **no winner**, even though there were bids. The final status should clearly indicate that the reserve was not met.

---

### 2. Rules & Constraints

- The reserve price is a **secret** — it must **never** be exposed to anyone except the seller.
  - It must not appear in API responses for non-seller users.
  - It must not be visible in the frontend for non-seller users.
  - It must not be inferable from the "Reserve met" indicator (the indicator flips at the threshold but doesn't reveal the number).
- The **seller** should be able to see their own reserve price on the auction detail page.
- The reserve status indicator (`"Reserve not met"` / `"Reserve met"`) should be visible to **all users** on the auction page.
- When a bid **crosses the reserve for the first time**, this should be communicated in real-time to all users in the auction room.
- **Winner logic**: When the auction ends:
  - If `reservePrice` is set and `currentBid < reservePrice` → no winner (even if bids exist).
  - If `reservePrice` is set and `currentBid >= reservePrice` → normal winner selection.
  - If `reservePrice` is not set → normal winner selection (no change from current behavior).
- The reserve price **cannot be changed** once the auction is active.
- Auctions that end without meeting the reserve should have a distinct final status message (e.g., "Auction ended — reserve not met") rather than just "No bids were placed."

---

### 3. Real-Time Reserve Status

- When a bid is placed that meets or exceeds the reserve, a Socket.io event should notify all connected clients so the indicator updates from "Reserve not met" to "Reserve met" **instantly**.
- This transition only happens once — subsequent bids above the reserve don't re-trigger it.
- The event should communicate the **status change** only, not the reserve amount itself.

---

### 4. API Requirements

- The auction creation endpoint must accept an optional `reservePrice` field.
- The auction detail endpoint must:
  - Include `reservePrice` in the response **only if the requesting user is the seller**.
  - Include a boolean `reserveMet` field for all users (true/false/null if no reserve).
- The bid placement endpoint must check if a newly placed bid crosses the reserve threshold.
- The auction end logic must conditionally set the winner based on whether the reserve was met.

---

### 5. Frontend Requirements

- The auction creation form should have an optional field for reserve price.
- The auction room page should show:
  - A visible indicator: "Reserve not met" (e.g., in red/orange) or "Reserve met" (e.g., in green).
  - If the current user is the seller: also show the actual reserve amount (e.g., "Your reserve: $8,000").
  - If no reserve is set: no indicator shown at all.
- When the auction ends without meeting the reserve, show a distinct message (not the same as "No bids were placed").
- The indicator must update in real-time when the reserve is crossed mid-auction.

---

## Testing Checklist

- [ ] Seller can create an auction with a reserve price
- [ ] Seller can create an auction without a reserve price (feature is optional, no regressions)
- [ ] Reserve price must be greater than the starting price (validation)
- [ ] Reserve price is **not visible** in the auction detail API response for non-seller users
- [ ] Reserve price **is visible** in the auction detail API response for the seller
- [ ] `reserveMet` boolean is included in the API response for all users
- [ ] "Reserve not met" indicator shows when current bid is below reserve
- [ ] "Reserve met" indicator shows when current bid meets or exceeds reserve
- [ ] Indicator updates in real-time via Socket.io when a bid crosses the reserve
- [ ] Reserve status socket event does **not** leak the reserve amount
- [ ] Auction ends with **no winner** when reserve is not met, even if bids exist
- [ ] Auction ends with a winner normally when reserve is met
- [ ] Ended auction shows "Reserve not met" message (distinct from "No bids were placed")
- [ ] Seller sees their reserve amount on the auction page
- [ ] Non-seller users cannot see the reserve amount anywhere
- [ ] Auctions without a reserve price work exactly as before — no regressions
- [ ] Reserve price cannot be modified after auction becomes active

---

## Evaluation Criteria

| Area | Weight | What We're Looking For |
|---|---|---|
| **Security / Data Privacy** | 30% | Reserve amount is truly hidden — not leaked in API responses, socket events, or frontend state. Only seller sees it. |
| **Correctness** | 25% | Winner logic handles all cases: reserve met, reserve not met, no reserve set. No false winners, no missed winners. |
| **Real-Time Updates** | 20% | Reserve status indicator updates instantly for all clients when the threshold is crossed. |
| **Code Quality** | 15% | Follows existing patterns. Conditional logic is clean and doesn't clutter the existing bid/auction flow. |
| **UI/UX** | 10% | Reserve indicator is clear and well-positioned. Seller vs. bidder views are distinct. End-of-auction messaging is informative. |
