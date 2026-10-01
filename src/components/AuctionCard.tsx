'use client';

import Link from 'next/link';
import CountdownTimer from './CountdownTimer';

interface AuctionCardProps {
  auction: {
    _id: string;
    product: {
      _id: string;
      title: string;
      imageUrl: string;
      startingPrice: number;
    };
    seller: { _id: string; name: string };
    startTime: string;
    endTime: string;
    status: 'pending' | 'active' | 'ended';
    currentBid: number;
    winner?: { _id: string; name: string } | null;
  };
}

export default function AuctionCard({ auction }: AuctionCardProps) {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    ended: 'bg-gray-100 text-gray-700',
  };

  return (
    <Link
      href={`/auctions/${auction._id}`}
      className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition block"
    >
      <div className="relative">
        <img
          src={auction.product.imageUrl}
          alt={auction.product.title}
          className="w-full h-48 object-cover"
        />
        <span
          className={`absolute top-2 right-2 text-xs px-2 py-1 rounded font-medium ${
            statusColors[auction.status]
          }`}
        >
          {auction.status === 'active' ? 'LIVE' : auction.status.toUpperCase()}
        </span>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1 truncate">
          {auction.product.title}
        </h3>
        <p className="text-gray-500 text-sm mb-2">by {auction.seller.name}</p>

        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">Current Bid</span>
          <span className="text-lg font-bold text-amber-600">
            ${auction.currentBid.toFixed(2)}
          </span>
        </div>

        {auction.status === 'pending' && (
          <CountdownTimer targetDate={auction.startTime} label="Starts in" />
        )}
        {auction.status === 'active' && (
          <CountdownTimer targetDate={auction.endTime} label="Ends in" />
        )}
        {auction.status === 'ended' && auction.winner && (
          <p className="text-sm text-green-600 font-medium">
            Won by {auction.winner.name}
          </p>
        )}
      </div>
    </Link>
  );
}
