import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type AutoBidIncrementType = 'fixed' | 'percentage';
// active    - will react to outbids
// exhausted - cap reached, bid count used up, or outbid beyond the cap
// cancelled - cancelled by the user, or the auction ended
export type AutoBidStatus = 'active' | 'exhausted' | 'cancelled';

export interface IAutoBid extends Document {
  _id: Types.ObjectId;
  auction: Types.ObjectId;
  bidder: Types.ObjectId;
  maxAmount: number;
  incrementType: AutoBidIncrementType;
  incrementValue: number;
  maxBidCount: number | null;
  bidsUsed: number;
  lastBidAmount: number | null;
  status: AutoBidStatus;
  createdAt: Date;
  updatedAt: Date;
}

const AutoBidSchema = new Schema<IAutoBid>(
  {
    auction: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
    },
    bidder: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    maxAmount: {
      type: Number,
      required: [true, 'Maximum amount is required'],
      min: [0.01, 'Maximum amount must be positive'],
    },
    incrementType: {
      type: String,
      enum: ['fixed', 'percentage'],
      required: [true, 'Increment type is required'],
    },
    incrementValue: {
      type: Number,
      required: [true, 'Increment value is required'],
      min: [0.01, 'Increment value must be positive'],
    },
    maxBidCount: {
      type: Number,
      default: null,
      min: [1, 'Maximum bid count must be at least 1'],
    },
    bidsUsed: { type: Number, default: 0, min: 0 },
    lastBidAmount: { type: Number, default: null },
    status: {
      type: String,
      enum: ['active', 'exhausted', 'cancelled'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// One auto-bid document per user per auction. "Replace" = overwrite in place.
AutoBidSchema.index({ auction: 1, bidder: 1 }, { unique: true });
// Hot path: find active auto-bids on an auction, highest cap first.
AutoBidSchema.index({ auction: 1, status: 1, maxAmount: -1 });

const AutoBid: Model<IAutoBid> =
  mongoose.models.AutoBid ||
  mongoose.model<IAutoBid>('AutoBid', AutoBidSchema);

export default AutoBid;
