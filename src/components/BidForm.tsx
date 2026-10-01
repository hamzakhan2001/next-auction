'use client';

import { useState } from 'react';

interface BidFormProps {
  auctionId: string;
  currentBid: number;
  isActive: boolean;
  isSeller: boolean;
  isLoggedIn: boolean;
}

export default function BidForm({
  auctionId,
  currentBid,
  isActive,
  isSeller,
  isLoggedIn,
}: BidFormProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const bidAmount = parseFloat(amount);
    if (isNaN(bidAmount) || bidAmount <= currentBid) {
      setError(`Bid must be higher than $${currentBid.toFixed(2)}`);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/auctions/${auctionId}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: bidAmount }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to place bid');
        return;
      }

      setSuccess(`Bid of $${bidAmount.toFixed(2)} placed!`);
      setAmount('');
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="bg-gray-50 p-4 rounded text-center text-gray-600">
        Please log in to place a bid.
      </div>
    );
  }

  if (isSeller) {
    return (
      <div className="bg-gray-50 p-4 rounded text-center text-gray-600">
        You cannot bid on your own auction.
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="bg-gray-50 p-4 rounded text-center text-gray-600">
        This auction is not currently accepting bids.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="bg-red-50 text-red-600 p-2 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 p-2 rounded text-sm">
          {success}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          min={currentBid + 0.01}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Min $${(currentBid + 0.01).toFixed(2)}`}
          className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-600 text-black font-medium px-6 py-2 rounded transition disabled:opacity-50"
        >
          {loading ? 'Bidding...' : 'Place Bid'}
        </button>
      </div>
    </form>
  );
}
