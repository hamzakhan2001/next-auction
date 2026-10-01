import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

// Define schemas inline to avoid path alias issues
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

const ProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    startingPrice: { type: Number, required: true, min: 0.01 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hasAuction: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const AuctionSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'active', 'ended'], default: 'pending' },
    currentBid: { type: Number, required: true, min: 0 },
    currentBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

const BidSchema = new mongoose.Schema(
  {
    auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
    bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0.01 },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
const Auction = mongoose.models.Auction || mongoose.model('Auction', AuctionSchema);
const Bid = mongoose.models.Bid || mongoose.model('Bid', BidSchema);

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected!');

  // Clear existing data
  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    Auction.deleteMany({}),
    Bid.deleteMany({}),
  ]);

  // Create users (password: "password123" for all)
  console.log('Creating users...');
  const hashedPassword = await bcrypt.hash('password123', 12);

  const [alice, bob, charlie] = await User.create([
    { name: 'Alice Johnson', email: 'alice@example.com', password: hashedPassword },
    { name: 'Bob Smith', email: 'bob@example.com', password: hashedPassword },
    { name: 'Charlie Brown', email: 'charlie@example.com', password: hashedPassword },
  ]);

  console.log(`  Created: alice@example.com, bob@example.com, charlie@example.com`);
  console.log(`  Password for all: password123`);

  // Create products
  console.log('Creating products...');
  const now = new Date();

  const products = await Product.create([
    // Alice's products
    {
      title: 'Vintage Rolex Submariner 1968',
      description: 'A beautifully preserved vintage Rolex Submariner from 1968. Original dial, hands, and bezel. Comes with box and papers. Service history available.',
      imageUrl: 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=800',
      startingPrice: 5000,
      owner: alice._id,
      hasAuction: true,
    },
    {
      title: 'Original Oil Painting - Sunset Over Mountains',
      description: 'A stunning original oil painting by renowned local artist. Canvas size 36x48 inches. Signed and dated. Certificate of authenticity included.',
      imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800',
      startingPrice: 800,
      owner: alice._id,
      hasAuction: true,
    },
    {
      title: 'Antique Persian Rug - Handwoven',
      description: 'Authentic handwoven Persian rug from Isfahan, circa 1920. Measures 8x10 feet. Beautiful floral pattern in deep reds and blues. Minor wear consistent with age.',
      imageUrl: 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=800',
      startingPrice: 1200,
      owner: alice._id,
      hasAuction: false,
    },

    // Bob's products
    {
      title: 'MacBook Pro M3 Max - Sealed',
      description: 'Brand new sealed MacBook Pro 16" with M3 Max chip, 36GB RAM, 1TB SSD. Space Black. Full Apple warranty.',
      imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800',
      startingPrice: 2500,
      owner: bob._id,
      hasAuction: true,
    },
    {
      title: 'Fender Stratocaster 1964 Reissue',
      description: 'Limited edition Fender Custom Shop 1964 Stratocaster reissue. Sunburst finish, rosewood fretboard. Includes original hardshell case.',
      imageUrl: 'https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=800',
      startingPrice: 3000,
      owner: bob._id,
      hasAuction: true,
    },
    {
      title: 'Rare First Edition - The Great Gatsby',
      description: 'First edition, first printing of The Great Gatsby by F. Scott Fitzgerald (1925). Green cloth binding with gilt lettering. Good condition with minor foxing.',
      imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800',
      startingPrice: 15000,
      owner: bob._id,
      hasAuction: false,
    },

    // Charlie's products
    {
      title: 'Signed Michael Jordan Jersey',
      description: 'Authenticated signed Michael Jordan Chicago Bulls jersey. Number 23. Comes with COA from Beckett Authentication. Frame not included.',
      imageUrl: 'https://images.unsplash.com/photo-1515459961680-58bf0b6c6e03?w=800',
      startingPrice: 2000,
      owner: charlie._id,
      hasAuction: true,
    },
    {
      title: 'DJI Mavic 3 Pro Fly More Combo',
      description: 'Complete DJI Mavic 3 Pro Fly More Combo. Includes 3 batteries, charging hub, ND filter set, and carrying case. Only 5 hours of flight time.',
      imageUrl: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800',
      startingPrice: 1500,
      owner: charlie._id,
      hasAuction: true,
    },
  ]);

  console.log(`  Created ${products.length} products`);

  // Create auctions with different statuses
  console.log('Creating auctions...');

  // Auction 1: ACTIVE - Vintage Rolex (started 2 hours ago, ends in 4 hours)
  const auction1 = await Auction.create({
    product: products[0]._id,
    seller: alice._id,
    startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    endTime: new Date(now.getTime() + 4 * 60 * 60 * 1000),
    status: 'active',
    currentBid: 5850,
    currentBidder: charlie._id,
  });

  // Auction 2: ACTIVE - Oil Painting (started 1 hour ago, ends in 6 hours)
  const auction2 = await Auction.create({
    product: products[1]._id,
    seller: alice._id,
    startTime: new Date(now.getTime() - 1 * 60 * 60 * 1000),
    endTime: new Date(now.getTime() + 6 * 60 * 60 * 1000),
    status: 'active',
    currentBid: 950,
    currentBidder: bob._id,
  });

  // Auction 3: ACTIVE - MacBook Pro (started 30 min ago, ends in 2 hours)
  const auction3 = await Auction.create({
    product: products[3]._id,
    seller: bob._id,
    startTime: new Date(now.getTime() - 30 * 60 * 1000),
    endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    status: 'active',
    currentBid: 2800,
    currentBidder: alice._id,
  });

  // Auction 4: PENDING - Fender Guitar (starts in 3 hours, ends in 27 hours)
  const auction4 = await Auction.create({
    product: products[4]._id,
    seller: bob._id,
    startTime: new Date(now.getTime() + 3 * 60 * 60 * 1000),
    endTime: new Date(now.getTime() + 27 * 60 * 60 * 1000),
    status: 'pending',
    currentBid: 3000,
  });

  // Auction 5: PENDING - Signed Jersey (starts in 1 hour, ends in 25 hours)
  const auction5 = await Auction.create({
    product: products[6]._id,
    seller: charlie._id,
    startTime: new Date(now.getTime() + 1 * 60 * 60 * 1000),
    endTime: new Date(now.getTime() + 25 * 60 * 60 * 1000),
    status: 'pending',
    currentBid: 2000,
  });

  // Auction 6: ACTIVE - DJI Drone (started 45 min ago, ends in 5 hours)
  const auction6 = await Auction.create({
    product: products[7]._id,
    seller: charlie._id,
    startTime: new Date(now.getTime() - 45 * 60 * 1000),
    endTime: new Date(now.getTime() + 5 * 60 * 60 * 1000),
    status: 'active',
    currentBid: 1650,
    currentBidder: alice._id,
  });

  console.log('  Created 6 auctions (4 active, 2 pending)');

  // Create bids for active auctions
  console.log('Creating bids...');

  // Bids on Vintage Rolex auction
  await Bid.create([
    { auction: auction1._id, bidder: bob._id, amount: 5200, createdAt: new Date(now.getTime() - 90 * 60 * 1000) },
    { auction: auction1._id, bidder: charlie._id, amount: 5500, createdAt: new Date(now.getTime() - 60 * 60 * 1000) },
    { auction: auction1._id, bidder: bob._id, amount: 5700, createdAt: new Date(now.getTime() - 30 * 60 * 1000) },
    { auction: auction1._id, bidder: charlie._id, amount: 5850, createdAt: new Date(now.getTime() - 15 * 60 * 1000) },
  ]);

  // Bids on Oil Painting auction
  await Bid.create([
    { auction: auction2._id, bidder: bob._id, amount: 850, createdAt: new Date(now.getTime() - 45 * 60 * 1000) },
    { auction: auction2._id, bidder: charlie._id, amount: 900, createdAt: new Date(now.getTime() - 30 * 60 * 1000) },
    { auction: auction2._id, bidder: bob._id, amount: 950, createdAt: new Date(now.getTime() - 10 * 60 * 1000) },
  ]);

  // Bids on MacBook auction
  await Bid.create([
    { auction: auction3._id, bidder: alice._id, amount: 2600, createdAt: new Date(now.getTime() - 25 * 60 * 1000) },
    { auction: auction3._id, bidder: charlie._id, amount: 2700, createdAt: new Date(now.getTime() - 15 * 60 * 1000) },
    { auction: auction3._id, bidder: alice._id, amount: 2800, createdAt: new Date(now.getTime() - 5 * 60 * 1000) },
  ]);

  // Bids on DJI Drone auction
  await Bid.create([
    { auction: auction6._id, bidder: bob._id, amount: 1550, createdAt: new Date(now.getTime() - 35 * 60 * 1000) },
    { auction: auction6._id, bidder: alice._id, amount: 1650, createdAt: new Date(now.getTime() - 20 * 60 * 1000) },
  ]);

  console.log('  Created 13 bids across 4 auctions');

  console.log('\n--- Seed Complete! ---');
  console.log('\nTest accounts:');
  console.log('  alice@example.com   / password123  (has 3 products, 2 active auctions)');
  console.log('  bob@example.com     / password123  (has 3 products, 1 active + 1 pending auction)');
  console.log('  charlie@example.com / password123  (has 2 products, 1 active + 1 pending auction)');
  console.log('\nAuction summary:');
  console.log('  4 ACTIVE auctions (with bids, ending in 2-6 hours)');
  console.log('  2 PENDING auctions (starting in 1-3 hours)');
  console.log('  2 products without auctions (Alice\'s rug, Bob\'s book)');

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB.');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
