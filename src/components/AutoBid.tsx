'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AutoBidData } from '@/types';

interface AutoBidPanelProps {
  auctionId: string;
  currentBid: number;
  isActive: boolean;
  isSeller: boolean;
  isLoggedIn: boolean;
}

function describeIncrement(ab: AutoBidData) {
  return ab.incrementType === 'fixed'
    ? `+$${ab.incrementValue.toFixed(2)}`
    : `+${ab.incrementValue}%`;
}

export default function AutoBidPanel({
  auctionId,
  currentBid,
  isActive,
  isSeller,
  isLoggedIn,
}: AutoBidPanelProps) {
  const [autoBid, setAutoBid] = useState<AutoBidData | null>(null);
  const [editing, setEditing] = useState(false);
  const [maxAmount, setMaxAmount] = useState('');
  const [incrementType, setIncrementType] = useState<'fixed' | 'percentage'>('fixed');
  const [incrementValue, setIncrementValue] = useState('');
  const [maxBidCount, setMaxBidCount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const endpoint = `/api/auctions/${auctionId}/auto-bid`;
  const eligible = isLoggedIn && !isSeller;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { credentials: 'include' });
      const json = await res.json();
      if (json.success) setAutoBid(json.data);
    } catch {
      // keep showing the last known state
    }
  }, [endpoint]);

  // Load on mount, and re-sync whenever the current bid changes so
  // "bids used" / "exhausted" update live as auto-bids fire.
  useEffect(() => {
    if (eligible) refresh();
  }, [eligible, refresh, currentBid, isActive]);

  if (!eligible) return null;
  if (!isActive && !autoBid) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cap = parseFloat(maxAmount);
    const inc = parseFloat(incrementValue);
    if (isNaN(cap) || cap <= currentBid) {
      setError(`Maximum must be higher than $${currentBid.toFixed(2)}`);
      return;
    }
    if (isNaN(inc) || inc <= 0) {
      setError('Increment must be a positive number');
      return;
    }
    const body: Record<string, unknown> = {
      maxAmount: cap,
      incrementType,
      incrementValue: inc,
    };
    if (maxBidCount.trim() !== '') body.maxBidCount = parseInt(maxBidCount, 10);

    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Failed to set auto-bid');
        return;
      }
      setAutoBid(json.data);
      setEditing(false);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Failed to cancel auto-bid');
        return;
      }
      setAutoBid(null);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => {
    if (autoBid) {
      setMaxAmount(String(autoBid.maxAmount));
      setIncrementType(autoBid.incrementType);
      setIncrementValue(String(autoBid.incrementValue));
      setMaxBidCount(autoBid.maxBidCount ? String(autoBid.maxBidCount) : '');
    }
    setEditing(true);
  };

  const showForm = isActive && (!autoBid || editing);

  return (
    <div className="mt-4 border border-blue-200 bg-blue-50/50 rounded p-4">
      <h3 className="font-semibold text-blue-900 mb-1">Auto-Bid</h3>

      {error && (
        <div className="bg-red-50 text-red-600 p-2 rounded text-sm mb-2">
          {error}
        </div>
      )}

      {autoBid && !showForm && (
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                autoBid.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {autoBid.status === 'active' ? 'ACTIVE' : 'EXHAUSTED'}
            </span>
          </div>
          <p className="text-gray-700">
            Cap: <strong>${autoBid.maxAmount.toFixed(2)}</strong> · Increment:{' '}
            {describeIncrement(autoBid)}
          </p>
          <p className="text-gray-700">
            Bids used: {autoBid.bidsUsed}
            {autoBid.maxBidCount ? ` of ${autoBid.maxBidCount}` : ''}
            {autoBid.lastBidAmount != null &&
              ` · Last auto-bid: $${autoBid.lastBidAmount.toFixed(2)}`}
          </p>
          {autoBid.status === 'exhausted' && (
            <p className="text-gray-500">
              Auto-bidding has stopped (cap reached, bid limit used, or
              outbid beyond your cap).
            </p>
          )}
          {isActive && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={startEditing}
                disabled={loading}
                className="text-blue-700 hover:underline disabled:opacity-50"
              >
                Edit
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="text-red-600 hover:underline disabled:opacity-50"
              >
                {loading ? 'Cancelling...' : 'Cancel auto-bid'}
              </button>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <p className="text-xs text-gray-500">
            We&apos;ll outbid others for you, up to your cap.
          </p>
          <input
            type="number"
            step="0.01"
            min={currentBid + 0.01}
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            placeholder={`Max amount (above $${currentBid.toFixed(2)})`}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex gap-2">
            <select
              value={incrementType}
              onChange={(e) =>
                setIncrementType(e.target.value as 'fixed' | 'percentage')
              }
              className="border border-gray-300 rounded px-2 py-2 text-sm"
            >
              <option value="fixed">Fixed ($)</option>
              <option value="percentage">Percentage (%)</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={incrementValue}
              onChange={(e) => setIncrementValue(e.target.value)}
              placeholder={incrementType === 'fixed' ? 'e.g. 50' : 'e.g. 5'}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <input
            type="number"
            step="1"
            min="1"
            value={maxBidCount}
            onChange={(e) => setMaxBidCount(e.target.value)}
            placeholder="Max number of auto-bids (optional)"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded text-sm transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : autoBid ? 'Replace auto-bid' : 'Set auto-bid'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-gray-600 hover:underline text-sm"
              >
                Back
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
