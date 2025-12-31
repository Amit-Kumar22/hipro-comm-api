import mongoose, { Document, Schema, Types } from 'mongoose';

// Order Status Types
export type OrderStatus = 
  | 'PENDING'
  | 'PAID'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

// Payment Status Types
export type PaymentStatus = 
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED';

// Order Item Interface
export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  variants?: {
    [key: string]: string;
  };
  total: number;
}

// Order Interface
export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string;
  user: Types.ObjectId;
  items: IOrderItem[];
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    shipping: number;
    total: number;
  };
  appliedCoupons: {
    code: string;
    discount: number;
  }[];
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    phone: string;
  };
  billingAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    phone: string;
  };
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: 'cod' | 'online';
  paymentId?: Types.ObjectId;
  statusHistory: {
    status: OrderStatus;
    timestamp: Date;
    note?: string;
    updatedBy?: Types.ObjectId;
  }[];
  tracking: {
    carrier?: string;
    trackingNumber?: string;
    estimatedDelivery?: Date;
    actualDelivery?: Date;
  };
  notes: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Order Schema
const OrderSchema = new Schema<IOrder>({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    match: [/^ORD-\d{8}-\d{4}$/, 'Invalid order number format']
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required']
  },
  items: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    sku: {
      type: String,
      required: true,
      uppercase: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative']
    },
    variants: {
      type: Map,
      of: String
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Total cannot be negative']
    }
  }],
  totals: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    tax: {
      type: Number,
      required: true,
      min: 0
    },
    shipping: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  },
  appliedCoupons: [{
    code: {
      type: String,
      required: true,
      uppercase: true
    },
    discount: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  shippingAddress: {
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    pincode: {
      type: String,
      required: true,
      match: [/^\d{6}$/, 'Please enter a valid 6-digit pincode']
    },
    country: {
      type: String,
      required: true,
      default: 'India'
    },
    phone: {
      type: String,
      required: true,
      match: [/^\d{10}$/, 'Please enter a valid 10-digit phone number']
    }
  },
  billingAddress: {
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    pincode: {
      type: String,
      required: true,
      match: [/^\d{6}$/, 'Please enter a valid 6-digit pincode']
    },
    country: {
      type: String,
      required: true,
      default: 'India'
    },
    phone: {
      type: String,
      required: true,
      match: [/^\d{10}$/, 'Please enter a valid 10-digit phone number']
    }
  },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING'
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
    default: 'PENDING'
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'online'],
    required: true
  },
  paymentId: {
    type: Schema.Types.ObjectId,
    ref: 'Payment'
  },
  statusHistory: [{
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      trim: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Customer'
    }
  }],
  tracking: {
    carrier: {
      type: String,
      trim: true
    },
    trackingNumber: {
      type: String,
      trim: true,
      uppercase: true
    },
    estimatedDelivery: {
      type: Date
    },
    actualDelivery: {
      type: Date
    }
  },
  notes: {
    type: String,
    trim: true,
    maxLength: [500, 'Notes cannot exceed 500 characters']
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String,
    trim: true,
    maxLength: [200, 'Cancellation reason cannot exceed 200 characters']
  }
}, {
  timestamps: true
});

// Indexes
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ user: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ 'items.product': 1 });
OrderSchema.index({ 'statusHistory.status': 1 });

// Pre-save middleware to generate order number
OrderSchema.pre('save', async function(this: IOrder) {
  if (this.isNew && !this.orderNumber) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.getTime().toString().slice(-4);
    this.orderNumber = `ORD-${dateStr}-${timeStr}`;
  }
  
  // Add status history entry if status changed
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });
  }
});

// Virtual for total items
OrderSchema.virtual('totalItems').get(function(this: IOrder) {
  return this.items.reduce((count, item) => count + item.quantity, 0);
});

// Virtual for unique product count
OrderSchema.virtual('uniqueProductCount').get(function(this: IOrder) {
  return this.items.length;
});

// Virtual for can cancel
OrderSchema.virtual('canCancel').get(function(this: IOrder) {
  return ['PENDING', 'PAID'].includes(this.status);
});

// Virtual for can return
OrderSchema.virtual('canReturn').get(function(this: IOrder) {
  return this.status === 'DELIVERED' && this.paymentStatus !== 'REFUNDED';
});

export const Order = mongoose.model<IOrder>('Order', OrderSchema);