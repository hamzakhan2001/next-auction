'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuctionConfigFormProps {
  productId: string;
  productTitle: string;
}

export default function AuctionConfigForm({
  productId,
  productTitle,
}: AuctionConfigFormProps) {
  const router = useRouter();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    if (start <= now) {
      setError('Start time must be in the future');
      return;
    }

    if (end <= start) {
      setError('End time must be after start time');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to create auction');
        return;
      }

      router.push(`/auctions/${data.data._id}`);
      router.refresh();
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
      <h2 className="text-lg font-semibold">
        Configure Auction for &quot;{productTitle}&quot;
      </h2>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="startTime"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Start Time
        </label>
        <input
          id="startTime"
          type="datetime-local"
          required
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div>
        <label
          htmlFor="endTime"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          End Time
        </label>
        <input
          id="endTime"
          type="datetime-local"
          required
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded transition disabled:opacity-50"
      >
        {loading ? 'Creating Auction...' : 'Start Auction'}
      </button>
    </form>
  );
}
