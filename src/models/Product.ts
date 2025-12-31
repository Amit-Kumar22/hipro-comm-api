import mongoose, { Document, Schema, Types } from 'mongoose';

// Product Interface
export interface IProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  sku: string;
  category: Types.ObjectId;
  images: {
    url: string;
    alt: string;
    isPrimary: boolean;
  }[];
  price: {
    original: number;
    selling: number;
    discount: number;
  };
  specifications: {
    key: string;
    value: string;
  }[];
  variants: {
    name: string;
    options: {
      name: string;
      value: string;
      priceAdjustment: number;
      sku: string;
    }[];
  }[];
  dimensions: {
    length: number;
    width: number;
    height: number;
    weight: number;
    unit: 'cm' | 'inch';
    weightUnit: 'kg' | 'lbs';
  };
  isActive: boolean;
  isFeatured: boolean;
  inStock: boolean;
  stock: {
    quantity: number;
    reserved: number;
    available: number;
  };
  tags: string[];
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string[];
  };
  ratings: {
    average: number;
    count: number;
  };
  createdAt: Date;
  updatedAt: Date;
  // Methods
  reserveStock(quantity: number): Promise<boolean>;
  releaseStock(quantity: number): Promise<boolean>;
  confirmSale(quantity: number): Promise<boolean>;
}

// Product Schema
const ProductSchema = new Schema<IProduct>({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxLength: [200, 'Product name cannot exceed 200 characters']
  },
  slug: {
    type: String,
    required: [true, 'Product slug is required'],
    unique: true,
    lowercase: true,
    match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers and hyphens']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxLength: [2000, 'Description cannot exceed 2000 characters']
  },
  shortDescription: {
    type: String,
    required: [true, 'Short description is required'],
    maxLength: [300, 'Short description cannot exceed 300 characters']
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    uppercase: true,
    match: [/^[A-Z0-9-]+$/, 'SKU can only contain uppercase letters, numbers and hyphens']
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      required: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  price: {
    original: {
      type: Number,
      required: [true, 'Original price is required'],
      min: [0, 'Price cannot be negative']
    },
    selling: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Price cannot be negative']
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%']
    }
  },
  specifications: [{
    key: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: String,
      required: true,
      trim: true
    }
  }],
  variants: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    options: [{
      name: {
        type: String,
        required: true,
        trim: true
      },
      value: {
        type: String,
        required: true,
        trim: true
      },
      priceAdjustment: {
        type: Number,
        default: 0
      },
      sku: {
        type: String,
        required: true,
        uppercase: true
      }
    }]
  }],
  dimensions: {
    length: {
      type: Number,
      required: true,
      min: 0
    },
    width: {
      type: Number,
      required: true,
      min: 0
    },
    height: {
      type: Number,
      required: true,
      min: 0
    },
    weight: {
      type: Number,
      required: true,
      min: 0
    },
    unit: {
      type: String,
      enum: ['cm', 'inch'],
      default: 'cm'
    },
    weightUnit: {
      type: String,
      enum: ['kg', 'lbs'],
      default: 'kg'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  inStock: {
    type: Boolean,
    default: true
  },
  stock: {
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    reserved: {
      type: Number,
      default: 0,
      min: 0
    },
    available: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  seo: {
    metaTitle: {
      type: String,
      maxLength: [60, 'Meta title cannot exceed 60 characters']
    },
    metaDescription: {
      type: String,
      maxLength: [160, 'Meta description cannot exceed 160 characters']
    },
    metaKeywords: [{
      type: String
    }]
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
ProductSchema.index({ slug: 1 });
ProductSchema.index({ sku: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ isFeatured: 1 });
ProductSchema.index({ 'price.selling': 1 });
ProductSchema.index({ tags: 1 });
ProductSchema.index({ createdAt: -1 });
// Text index for search
ProductSchema.index({ name: 'text', description: 'text', shortDescription: 'text' });

// Pre-save middleware to calculate discount percentage and available stock
ProductSchema.pre('save', function(this: IProduct) {
  if (this.isModified('price')) {
    const { original, selling } = this.price;
    this.price.discount = original > selling ? Math.round(((original - selling) / original) * 100) : 0;
  }
  
  // Calculate available stock
  if (this.isModified('stock')) {
    this.stock.available = Math.max(0, this.stock.quantity - this.stock.reserved);
    this.inStock = this.stock.available > 0;
  }
});

// Stock management methods
ProductSchema.methods.reserveStock = async function(quantity: number): Promise<boolean> {
  if (this.stock.available < quantity) {
    return false;
  }
  
  this.stock.reserved += quantity;
  this.stock.available = Math.max(0, this.stock.quantity - this.stock.reserved);
  this.inStock = this.stock.available > 0;
  
  await this.save();
  return true;
};

ProductSchema.methods.releaseStock = async function(quantity: number): Promise<boolean> {
  this.stock.reserved = Math.max(0, this.stock.reserved - quantity);
  this.stock.available = Math.max(0, this.stock.quantity - this.stock.reserved);
  this.inStock = this.stock.available > 0;
  
  await this.save();
  return true;
};

ProductSchema.methods.confirmSale = async function(quantity: number): Promise<boolean> {
  if (this.stock.reserved < quantity || this.stock.quantity < quantity) {
    return false;
  }
  
  this.stock.quantity -= quantity;
  this.stock.reserved -= quantity;
  this.stock.available = Math.max(0, this.stock.quantity - this.stock.reserved);
  this.inStock = this.stock.available > 0;
  
  await this.save();
  return true;
};

// Virtual for primary image
ProductSchema.virtual('primaryImage').get(function(this: IProduct) {
  return this.images.find(img => img.isPrimary) || this.images[0];
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema);