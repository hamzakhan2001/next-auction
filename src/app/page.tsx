import Link from 'next/link';
import dbConnect from '@/lib/db';
import Auction from '@/models/Auction';
import '@/models/Product';
import '@/models/User';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await dbConnect();

  const activeAuctions = await Auction.find({ status: 'active' })
    .populate('product', 'title imageUrl startingPrice')
    .populate('seller', 'name')
    .populate('winner', 'name')
    .sort({ endTime: 1 })
    .limit(6)
    .lean();

  const upcomingAuctions = await Auction.find({ status: 'pending' })
    .populate('product', 'title imageUrl startingPrice')
    .populate('seller', 'name')
    .sort({ startTime: 1 })
    .limit(3)
    .lean();

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-12 mb-8">
        <h1 className="text-4xl font-bold mb-4">
          Real-Time Auction Platform
        </h1>
        <p className="text-gray-600 text-lg mb-6 max-w-2xl mx-auto">
          Bid, sell, and win. List your products, set up auctions, and compete
          with other bidders in real-time.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/auctions"
            className="bg-amber-500 hover:bg-amber-600 text-black font-medium px-6 py-3 rounded-lg transition"
          >
            Browse Auctions
          </Link>
          <Link
            href="/register"
            className="border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-6 py-3 rounded-lg transition"
          >
            Get Started
          </Link>
        </div>
      </div>

      {/* Live Auctions */}
      {activeAuctions.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              Live Auctions
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse ml-2 align-middle" />
            </h2>
            <Link
              href="/auctions"
              className="text-amber-600 hover:underline text-sm"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeAuctions.map((auction: any) => (
              <Link
                key={auction._id.toString()}
                href={`/auctions/${auction._id}`}
                className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition block"
              >
                <div className="relative">
                  <img
                    src={auction.product.imageUrl}
                    alt={auction.product.title}
                    className="w-full h-48 object-cover"
                  />
                  <span className="absolute top-2 right-2 bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-medium">
                    LIVE
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1 truncate">
                    {auction.product.title}
                  </h3>
                  <p className="text-gray-500 text-sm mb-2">
                    by {auction.seller.name}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Current Bid</span>
                    <span className="text-lg font-bold text-amber-600">
                      ${auction.currentBid.toFixed(2)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Auctions */}
      {upcomingAuctions.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Upcoming Auctions</h2>
            <Link
              href="/auctions"
              className="text-amber-600 hover:underline text-sm"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {upcomingAuctions.map((auction: any) => (
              <Link
                key={auction._id.toString()}
                href={`/auctions/${auction._id}`}
                className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition block"
              >
                <img
                  src={auction.product.imageUrl}
                  alt={auction.product.title}
                  className="w-full h-40 object-cover"
                />
                <div className="p-4">
                  <h3 className="font-semibold mb-1 truncate">
                    {auction.product.title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Starting at ${auction.product.startingPrice.toFixed(2)}
                  </p>
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded mt-2 inline-block">
                    UPCOMING
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {activeAuctions.length === 0 && upcomingAuctions.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2 text-gray-700">
            No auctions yet
          </h2>
          <p className="text-gray-500 mb-4">
            Be the first to list a product and start an auction!
          </p>
          <Link
            href="/products/new"
            className="text-amber-600 hover:underline font-medium"
          >
            Add a product
          </Link>
        </div>
      )}
    </div>
  );
}
