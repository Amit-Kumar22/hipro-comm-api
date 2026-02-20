import mongoose, { Document, Schema, Types } from 'mongoose';

// Image Interface
export interface IImage extends Document {
  _id: Types.ObjectId;
  name: string;
  alt: string;
  data: Buffer;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  entityType: 'product' | 'category' | 'payment' | 'other';
  entityId?: Types.ObjectId;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Virtual methods
  getUrl(): string;
  getBase64(): string;
}

// Image Schema
const ImageSchema = new Schema<IImage>({
  name: {
    type: String,
    required: [true, 'Image name is required'],
    trim: true
  },
  alt: {
    type: String,
    required: [true, 'Alt text is required'],
    trim: true
  },
  data: {
    type: Buffer,
    required: [true, 'Image data is required']
  },
  contentType: {
    type: String,
    required: [true, 'Content type is required'],
    enum: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
  },
  size: {
    type: Number,
    required: [true, 'Image size is required'],
    min: 0
  },
  width: {
    type: Number,
    min: 0
  },
  height: {
    type: Number,
    min: 0
  },
  entityType: {
    type: String,
    required: [true, 'Entity type is required'],
    enum: ['product', 'category', 'payment', 'other'],
    index: true
  },
  entityId: {
    type: Schema.Types.ObjectId,
    index: true
  },
  isPrimary: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
ImageSchema.index({ entityType: 1, entityId: 1 });
ImageSchema.index({ createdAt: -1 });

// Method to get URL for this image
ImageSchema.methods.getUrl = function(): string {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://shop.hiprotech.org' 
    : (process.env.API_BASE_URL || 'http://localhost:5001');
  return `${baseUrl}/api/v1/images/${this._id}`;
};

// Method to get base64 string
ImageSchema.methods.getBase64 = function(): string {
  if (this.data) {
    return `data:${this.contentType};base64,${this.data.toString('base64')}`;
  }
  return '';
};

// Static method to find images by entity
ImageSchema.statics.findByEntity = function(entityType: string, entityId: string) {
  return this.find({ entityType, entityId }).sort({ isPrimary: -1, createdAt: 1 });
};

// Static method to delete images by entity
ImageSchema.statics.deleteByEntity = function(entityType: string, entityId: string) {
  return this.deleteMany({ entityType, entityId });
};

// Virtual for URL (doesn't require method call)
ImageSchema.virtual('url').get(function(this: IImage) {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://shop.hiprotech.org' 
    : (process.env.API_BASE_URL || 'http://localhost:5001');
  return `${baseUrl}/api/v1/images/${this._id}`;
});

// Include virtuals in JSON output (but exclude data to avoid large responses)
ImageSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    // Remove the binary data from the JSON output to keep responses small
    const { data, ...rest } = ret;
    return rest;
  }
});

ImageSchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    // Remove the binary data from the object output
    const { data, ...rest } = ret;
    return rest;
  }
});

export const Image = mongoose.model<IImage>('Image', ImageSchema);
