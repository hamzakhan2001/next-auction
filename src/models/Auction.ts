import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type AuctionStatus = 'pending' | 'active' | 'ended';

export interface IAuction extends Document {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  seller: Types.ObjectId;
  startTime: Date;
  endTime: Date;
  status: AuctionStatus;
  currentBid: number;
  currentBidder: Types.ObjectId | null;
  winner: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AuctionSchema = new Schema<IAuction>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startTime: {
      type: Date,
      required: [true, 'Auction start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'Auction end time is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'ended'],
      default: 'pending',
      index: true,
    },
    currentBid: {
      type: Number,
      required: true,
      min: 0,
    },
    currentBidder: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    winner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Validate time constraints
AuctionSchema.pre('validate', function () {
  if (this.isNew && this.startTime && this.startTime.getTime() <= Date.now()) {
    this.invalidate('startTime', 'Start time must be in the future');
  }
  if (this.startTime && this.endTime && this.endTime.getTime() <= this.startTime.getTime()) {
    this.invalidate('endTime', 'End time must be after start time');
  }
});

AuctionSchema.index({ status: 1, startTime: 1, endTime: 1 });

const Auction: Model<IAuction> =
  mongoose.models.Auction || mongoose.model<IAuction>('Auction', AuctionSchema);

export default Auction;
