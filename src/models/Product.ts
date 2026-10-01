import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IProduct extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  imageUrl: string;
  startingPrice: number;
  owner: Types.ObjectId;
  hasAuction: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    imageUrl: {
      type: String,
      required: [true, 'Image URL is required'],
    },
    startingPrice: {
      type: Number,
      required: [true, 'Starting price is required'],
      min: [0.01, 'Starting price must be at least 0.01'],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    hasAuction: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default Product;
