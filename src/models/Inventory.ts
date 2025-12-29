import mongoose, { Document, Schema, Types } from 'mongoose';

// Inventory Interface
export interface IInventory extends Document {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  sku: string;
  quantityAvailable: number;
  quantityReserved: number;
  quantityLocked: number;
  reorderLevel: number;
  maxStockLevel: number;
  location: {
    warehouse: string;
    section: string;
    shelf: string;
  };
  supplier: {
    name: string;
    contact: string;
    leadTime: number; // in days
  };
  lastRestocked: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Virtual properties
  totalStock: number;
  availableForSale: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

// Stock Reservation Interface
export interface IStockReservation extends Document {
  _id: Types.ObjectId;
  inventory: Types.ObjectId;
  quantity: number;
  reservedBy: Types.ObjectId;
  expiresAt: Date;
  reason: 'cart' | 'checkout' | 'admin_hold';
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Inventory Schema
const InventorySchema = new Schema<IInventory>({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required'],
    unique: true
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    uppercase: true,
    match: [/^[A-Z0-9-]+$/, 'SKU can only contain uppercase letters, numbers and hyphens']
  },
  quantityAvailable: {
    type: Number,
    required: [true, 'Available quantity is required'],
    min: [0, 'Available quantity cannot be negative'],
    default: 0
  },
  quantityReserved: {
    type: Number,
    default: 0,
    min: [0, 'Reserved quantity cannot be negative']
  },
  quantityLocked: {
    type: Number,
    default: 0,
    min: [0, 'Locked quantity cannot be negative']
  },
  reorderLevel: {
    type: Number,
    required: [true, 'Reorder level is required'],
    min: [0, 'Reorder level cannot be negative'],
    default: 10
  },
  maxStockLevel: {
    type: Number,
    required: [true, 'Max stock level is required'],
    min: [0, 'Max stock level cannot be negative'],
    default: 1000
  },
  location: {
    warehouse: {
      type: String,
      required: true,
      default: 'Main Warehouse'
    },
    section: {
      type: String,
      required: true,
      default: 'A'
    },
    shelf: {
      type: String,
      required: true,
      default: '1'
    }
  },
  supplier: {
    name: {
      type: String,
      required: true
    },
    contact: {
      type: String,
      required: true
    },
    leadTime: {
      type: Number,
      required: true,
      min: 1,
      default: 7
    }
  },
  lastRestocked: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Stock Reservation Schema
const StockReservationSchema = new Schema<IStockReservation>({
  inventory: {
    type: Schema.Types.ObjectId,
    ref: 'Inventory',
    required: [true, 'Inventory is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  reservedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Reserved by user is required']
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiration date is required'],
    index: { expireAfterSeconds: 0 }
  },
  reason: {
    type: String,
    enum: ['cart', 'checkout', 'admin_hold'],
    required: true
  },
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
InventorySchema.index({ product: 1 });
InventorySchema.index({ sku: 1 });
InventorySchema.index({ quantityAvailable: 1 });
InventorySchema.index({ reorderLevel: 1 });
InventorySchema.index({ isActive: 1 });
InventorySchema.index({ lastRestocked: -1 });

StockReservationSchema.index({ inventory: 1 });
StockReservationSchema.index({ reservedBy: 1 });
StockReservationSchema.index({ expiresAt: 1 });
StockReservationSchema.index({ reason: 1 });

// Virtual for total stock
InventorySchema.virtual('totalStock').get(function(this: IInventory) {
  return this.quantityAvailable + this.quantityReserved + this.quantityLocked;
});

// Virtual for available for sale (excluding reserved and locked)
InventorySchema.virtual('availableForSale').get(function(this: IInventory) {
  return Math.max(0, this.quantityAvailable - this.quantityReserved - this.quantityLocked);
});

// Virtual for low stock warning
InventorySchema.virtual('isLowStock').get(function(this: IInventory) {
  return this.quantityAvailable <= this.reorderLevel;
});

// Virtual for out of stock
InventorySchema.virtual('isOutOfStock').get(function(this: IInventory) {
  return this.availableForSale <= 0;
});

// Pre-save middleware to validate stock levels
InventorySchema.pre('save', function(this: IInventory) {
  // Ensure max stock level is greater than reorder level
  if (this.maxStockLevel <= this.reorderLevel) {
    throw new Error('Max stock level must be greater than reorder level');
  }
  
  // Ensure total quantities don't exceed max stock level
  const totalStock = this.quantityAvailable + this.quantityReserved + this.quantityLocked;
  if (totalStock > this.maxStockLevel) {
    throw new Error('Total stock cannot exceed max stock level');
  }
});

export const Inventory = mongoose.model<IInventory>('Inventory', InventorySchema);
export const StockReservation = mongoose.model<IStockReservation>('StockReservation', StockReservationSchema);