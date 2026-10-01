import Link from 'next/link';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import Auction from '@/models/Auction';
import { notFound } from 'next/navigation';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  await dbConnect();

  const product = await Product.findById(productId)
    .populate('owner', 'name email')
    .lean();

  if (!product) {
    notFound();
  }

  const auction = product.hasAuction
    ? await Auction.findOne({ product: productId }).lean()
    : null;

  const owner = product.owner as unknown as { _id: string; name: string; email: string };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="md:flex">
          <div className="md:w-1/2">
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-full h-64 md:h-full object-cover"
            />
          </div>
          <div className="p-6 md:w-1/2">
            <h1 className="text-2xl font-bold mb-2">{product.title}</h1>
            <p className="text-gray-500 text-sm mb-4">
              Listed by {owner.name}
            </p>
            <p className="text-gray-700 mb-4">{product.description}</p>
            <p className="text-2xl font-bold text-amber-600 mb-6">
              Starting at ${product.startingPrice.toFixed(2)}
            </p>

            {auction ? (
              <Link
                href={`/auctions/${auction._id}`}
                className="inline-block bg-amber-500 hover:bg-amber-600 text-black font-medium px-6 py-2 rounded transition"
              >
                View Auction ({auction.status})
              </Link>
            ) : (
              <div className="text-gray-500 text-sm">
                No auction has been set up for this product yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
