'use client';

import { useEffect, useState } from 'react';
import AuctionCard from '@/components/AuctionCard';

type StatusFilter = 'all' | 'active' | 'pending' | 'ended';

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAuctions() {
      setLoading(true);
      const query = filter === 'all' ? '' : `?status=${filter}`;
      const res = await fetch(`/api/auctions${query}`);
      const data = await res.json();
      if (data.success) {
        setAuctions(data.data);
      }
      setLoading(false);
    }
    fetchAuctions();
  }, [filter]);

  const tabs: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Live', value: 'active' },
    { label: 'Upcoming', value: 'pending' },
    { label: 'Ended', value: 'ended' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Browse Auctions</h1>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 rounded text-sm font-medium transition ${
              filter === tab.value
                ? 'bg-amber-500 text-black'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow h-72 animate-pulse" />
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No auctions found.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {auctions.map((auction) => (
            <AuctionCard key={auction._id} auction={auction} />
          ))}
        </div>
      )}
    </div>
  );
}
