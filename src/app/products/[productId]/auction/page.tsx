import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import AuctionConfigForm from '@/components/AuctionConfigForm';

export default async function AuctionConfigPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) redirect('/login');

  const decoded = await verifyToken(token);
  if (!decoded) redirect('/login');

  await dbConnect();

  const product = await Product.findById(productId).lean();
  if (!product) notFound();

  if (product.owner.toString() !== decoded.userId) {
    redirect('/dashboard');
  }

  if (product.hasAuction) {
    redirect('/dashboard');
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-3xl font-bold mb-6">Enable Auction</h1>
      <AuctionConfigForm
        productId={productId}
        productTitle={product.title}
      />
    </div>
  );
}
