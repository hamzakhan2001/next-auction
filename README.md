# AuctionHub - Real-Time Auction Platform

A full-stack real-time auction platform built with Next.js (App Router), MongoDB, Socket.io, and JWT authentication.

## Features

- User registration & login (bcrypt + JWT httpOnly cookies)
- Product listing (CRUD)
- Auction creation with scheduled start/end times
- Auctions go live automatically based on server time
- Real-time bidding via Socket.io
- Bid validation (must be higher than current highest bid)
- Automatic winner selection when auction ends
- Protected routes via Next.js middleware

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend**: Next.js API Routes, Custom Server (Socket.io)
- **Database**: MongoDB + Mongoose 7
- **Auth**: JWT via `jose` (Edge-compatible), bcrypt password hashing
- **Real-time**: Socket.io

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB instance (local or remote)

### Installation

```bash
git clone git@github.com:mdsbrand/next-auction.git
cd next-auction
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
MONGODB_URI=mongodb://localhost:27017/next-auction
JWT_SECRET=your-super-secret-key-change-in-production-min-32-chars
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Seed Database

**Option 1: Using the seed script** (generates fresh data with dynamic timestamps):

```bash
npx tsx seed.ts
```

**Option 2: Import sample data** from the `data/` directory (static JSON exports):

```bash
mongoimport --uri "mongodb://localhost:27017/next-auction" --collection users --jsonArray --file data/users.json
mongoimport --uri "mongodb://localhost:27017/next-auction" --collection products --jsonArray --file data/products.json
mongoimport --uri "mongodb://localhost:27017/next-auction" --collection auctions --jsonArray --file data/auctions.json
mongoimport --uri "mongodb://localhost:27017/next-auction" --collection bids --jsonArray --file data/bids.json
```

> Replace the `--uri` value with your MongoDB connection string if using a remote database.

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

## Test Accounts

After running the seed script, you can log in with these accounts:

| Email | Password | Products | Auctions |
|---|---|---|---|
| `alice@example.com` | `password123` | Vintage Rolex, Oil Painting, Persian Rug | 2 active |
| `bob@example.com` | `password123` | MacBook Pro, Fender Guitar, First Edition Book | 1 active + 1 pending |
| `charlie@example.com` | `password123` | Signed Jordan Jersey, DJI Drone | 1 active + 1 pending |

**Seeded data summary:**
- 3 users
- 8 products (6 with auctions, 2 without)
- 4 active auctions (with existing bids)
- 2 pending auctions (starting in 1-3 hours)
- 13 bids across the active auctions

## Project Structure

```
next-auction/
├── server.ts                    # Custom server: Next.js + Socket.io + auction scheduler
├── seed.ts                      # Database seed script
├── src/
│   ├── middleware.ts             # Route protection (JWT check)
│   ├── app/
│   │   ├── page.tsx              # Homepage
│   │   ├── (auth)/               # Login & Register pages
│   │   ├── dashboard/            # User's products & auctions
│   │   ├── products/             # Add product, product detail, auction config
│   │   ├── auctions/             # Browse auctions, live auction room
│   │   └── api/                  # API routes (auth, products, auctions, bids)
│   ├── lib/                      # DB connection, JWT helpers, auth guard, API utils
│   ├── models/                   # Mongoose schemas (User, Product, Auction, Bid)
│   ├── components/               # UI components (Navbar, BidForm, CountdownTimer, etc.)
│   ├── hooks/                    # useAuth, useAuction (real-time)
│   └── types/                    # TypeScript interfaces & Socket.io event types
```

## API Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login, set httpOnly cookie |
| POST | `/api/auth/logout` | No | Clear auth cookie |
| GET | `/api/auth/me` | Yes | Get current user |
| GET | `/api/products` | No | List products |
| POST | `/api/products` | Yes | Create product |
| GET | `/api/products/[id]` | No | Product detail |
| PUT | `/api/products/[id]` | Yes | Update product (owner only) |
| DELETE | `/api/products/[id]` | Yes | Delete product (owner only) |
| GET | `/api/auctions` | No | List auctions (filter by status) |
| POST | `/api/auctions` | Yes | Create auction on a product |
| GET | `/api/auctions/[id]` | No | Auction detail |
| GET | `/api/auctions/[id]/bids` | No | Bid history |
| POST | `/api/auctions/[id]/bids` | Yes | Place a bid |
