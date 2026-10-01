import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Auction from '@/models/Auction';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) redirect('/login');

  const decoded = await verifyToken(token);
  if (!decoded) redirect('/login');

  await dbConnect();

  const products = await Product.find({ owner: decoded.userId })
    .sort({ createdAt: -1 })
    .lean();

  const productIds = products.map((p) => p._id);
  const auctions = await Auction.find({ product: { $in: productIds } }).lean();
  const auctionMap = new Map(
    auctions.map((a) => [a.product.toString(), a])
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">My Dashboard</h1>
        <Link
          href="/products/new"
          className="bg-amber-500 hover:bg-amber-600 text-black font-medium px-4 py-2 rounded transition"
        >
          + Add Product
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">You haven&apos;t added any products yet.</p>
          <Link
            href="/products/new"
            className="text-amber-600 hover:underline font-medium"
          >
            Add your first product
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const auction = auctionMap.get(product._id.toString());
            return (
              <div
                key={product._id.toString()}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  className="w-full h-40 object-cover"
                />
                <div className="p-4">
                  <h2 className="font-semibold text-lg mb-1">
                    {product.title}
                  </h2>
                  <p className="text-amber-600 font-bold mb-3">
                    ${product.startingPrice.toFixed(2)}
                  </p>

                  {auction ? (
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs px-2 py-1 rounded font-medium ${
                          auction.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : auction.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        Auction: {auction.status}
                      </span>
                      <Link
                        href={`/auctions/${auction._id}`}
                        className="text-sm text-amber-600 hover:underline"
                      >
                        View Auction
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/products/${product._id}`}
                        className="text-sm text-gray-500 hover:underline"
                      >
                        View
                      </Link>
                      <Link
                        href={`/products/${product._id}/auction`}
                        className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded transition"
                      >
                        Start Auction
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
