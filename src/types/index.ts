export interface UserData {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface ProductData {
  _id: string;
  title: string;
  description: string;
  imageUrl: string;
  startingPrice: number;
  owner: UserData | string;
  hasAuction: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuctionData {
  _id: string;
  product: ProductData | string;
  seller: UserData | string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'active' | 'ended';
  currentBid: number;
  currentBidder: UserData | string | null;
  winner: UserData | string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BidData {
  _id: string;
  auction: string;
  bidder: UserData | string;
  amount: number;
  createdAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
