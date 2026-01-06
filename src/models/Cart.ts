import mongoose, { Document, Schema, Types, Model } from 'mongoose';

// Cart Item Interface
export interface ICartItem {
  product: Types.ObjectId;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  variants?: Record<string, string>;
  addedAt: Date;
  updatedAt: Date;
}

// Cart Interface
export interface ICart extends Document {
  _id: Types.ObjectId;
  customer: Types.ObjectId;
  items: ICartItem[];
  totals: {
    totalItems: number;
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
  };
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  calculateTotals(): void;
  addItem(productData: Partial<ICartItem>): Promise<ICart>;
  updateItemQuantity(productId: string, quantity: number): Promise<ICart>;
  removeItem(productId: string): Promise<ICart>;
  clearCart(): Promise<ICart>;
  isStockAvailable(productId: string, quantity: number): Promise<boolean>;
}

// Cart Model Interface
export interface ICartModel extends Model<ICart> {
  findOrCreateCart(customerId: string): Promise<ICart>;
  cleanExpiredCarts(): Promise<void>;
}

// Cart Item Schema
const CartItemSchema = new Schema<ICartItem>({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    max: [100, 'Maximum quantity is 100']
  },
  selectedSize: {
    type: String,
    trim: true
  },
  selectedColor: {
    type: String,
    trim: true
  },
  variants: {
    type: Schema.Types.Mixed,
    default: {}
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Cart Schema
const CartSchema = new Schema<ICart>({
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required'],
    unique: true
  },
  items: [CartItemSchema],
  totals: {
    totalItems: {
      type: Number,
      default: 0,
      min: 0
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0
    },
    tax: {
      type: Number,
      default: 0,
      min: 0
    },
    shipping: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
CartSchema.index({ customer: 1 });
CartSchema.index({ 'items.product': 1 });
CartSchema.index({ lastActivity: 1 });

// Pre-save middleware to update totals
CartSchema.pre<ICart>('save', function(next) {
  this.calculateTotals();
  this.lastActivity = new Date();
  next();
});

// Methods
CartSchema.methods.calculateTotals = function(): void {
  let totalItems = 0;
  let subtotal = 0;

  this.items.forEach((item: ICartItem) => {
    totalItems += item.quantity;
    subtotal += item.price * item.quantity;
  });

  const tax = Math.round(subtotal * 0.18 * 100) / 100; // 18% GST
  const shipping = subtotal > 500 ? 0 : 50; // Free shipping above ₹500
  const total = Math.round((subtotal + tax + shipping) * 100) / 100;

  this.totals = {
    totalItems,
    subtotal: Math.round(subtotal * 100) / 100,
    tax,
    shipping,
    total
  };
};

CartSchema.methods.addItem = async function(productData: Partial<ICartItem>): Promise<ICart> {
  const existingItemIndex = this.items.findIndex((item: ICartItem) => 
    item.product.toString() === productData.product?.toString() &&
    item.selectedSize === productData.selectedSize &&
    item.selectedColor === productData.selectedColor
  );

  if (existingItemIndex > -1) {
    // Update existing item quantity
    this.items[existingItemIndex].quantity += productData.quantity || 1;
    this.items[existingItemIndex].updatedAt = new Date();
  } else {
    // Add new item
    this.items.push({
      ...productData,
      addedAt: new Date(),
      updatedAt: new Date()
    } as ICartItem);
  }

  return await this.save();
};

CartSchema.methods.updateItemQuantity = async function(productId: string, quantity: number): Promise<ICart> {
  const itemIndex = this.items.findIndex((item: ICartItem) => 
    item.product.toString() === productId
  );

  if (itemIndex === -1) {
    throw new Error('Item not found in cart');
  }

  if (quantity <= 0) {
    // Remove item if quantity is 0 or negative
    this.items.splice(itemIndex, 1);
  } else {
    // Update quantity
    this.items[itemIndex].quantity = quantity;
    this.items[itemIndex].updatedAt = new Date();
  }

  return await this.save();
};

CartSchema.methods.removeItem = async function(productId: string): Promise<ICart> {
  this.items = this.items.filter((item: ICartItem) => 
    item.product.toString() !== productId
  );

  return await this.save();
};

CartSchema.methods.clearCart = async function(): Promise<ICart> {
  this.items = [];
  return await this.save();
};

CartSchema.methods.isStockAvailable = async function(productId: string, quantity: number): Promise<boolean> {
  const Product = mongoose.model('Product');
  const product = await Product.findById(productId);
  
  if (!product || !product.isActive || !product.inStock) {
    return false;
  }

  return product.stock.available >= quantity;
};

// Static method to find or create cart
CartSchema.statics.findOrCreateCart = async function(customerId: string): Promise<ICart> {
  let cart = await this.findOne({ customer: customerId }).populate({
    path: 'items.product',
    select: 'name slug price images sku isActive inStock stock category'
  });

  if (!cart) {
    cart = new this({
      customer: customerId,
      items: []
    });
    await cart.save();
  }

  return cart;
};

// Clean up expired carts (can be run as a cron job)
CartSchema.statics.cleanExpiredCarts = async function(): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await this.deleteMany({
    lastActivity: { $lt: thirtyDaysAgo },
    'totals.totalItems': 0
  });
};

export const Cart = mongoose.model<ICart, ICartModel>('Cart', CartSchema);