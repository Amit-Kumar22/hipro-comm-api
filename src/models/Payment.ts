import mongoose, { Document, Schema, Types } from 'mongoose';

export type PaymentStatus = 'INITIATED' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'PENDING';
export type PaymentMethod = 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET' | 'COD';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  paymentId: string;
  order: Types.ObjectId;
  customer: Types.ObjectId;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  gateway: {
    provider: string;
    transactionId?: string;
    gatewayOrderId?: string;
    gatewayPaymentId?: string;
    signature?: string;
  };
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    timestamp: Date;
  };
  refund?: {
    amount: number;
    reason: string;
    processedAt: Date;
    refundId: string;
  };
  createdAt: Date;
  updatedAt: Date;

  // Methods
  canBeRefunded(): boolean;
  processRefund(amount: number, reason: string): Promise<boolean>;
  generatePaymentId(): string;
}

const PaymentSchema = new Schema<IPayment>({
  paymentId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  order: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'INR',
    uppercase: true
  },
  method: {
    type: String,
    enum: ['CARD', 'UPI', 'NET_BANKING', 'WALLET', 'COD'],
    required: true
  },
  status: {
    type: String,
    enum: ['INITIATED', 'SUCCESS', 'FAILED', 'REFUNDED', 'PENDING'],
    default: 'INITIATED'
  },
  gateway: {
    provider: {
      type: String,
      required: true,
      default: 'RAZORPAY' // Simulated gateway
    },
    transactionId: String,
    gatewayOrderId: String,
    gatewayPaymentId: String,
    signature: String
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  refund: {
    amount: {
      type: Number,
      min: 0
    },
    reason: {
      type: String,
      trim: true
    },
    processedAt: Date,
    refundId: String
  }
}, {
  timestamps: true
});

// Indexes
PaymentSchema.index({ paymentId: 1 });
PaymentSchema.index({ order: 1 });
PaymentSchema.index({ customer: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ createdAt: -1 });
PaymentSchema.index({ customer: 1, createdAt: -1 });

// Pre-save middleware to generate payment ID
PaymentSchema.pre('save', function(this: IPayment) {
  if (!this.paymentId) {
    this.paymentId = this.generatePaymentId();
  }
});

// Method to check if payment can be refunded
PaymentSchema.methods.canBeRefunded = function(): boolean {
  return this.status === 'SUCCESS' && !this.refund;
};

// Method to process refund
PaymentSchema.methods.processRefund = async function(amount: number, reason: string): Promise<boolean> {
  if (!this.canBeRefunded()) {
    return false;
  }

  if (amount > this.amount) {
    return false;
  }

  // Simulate refund processing
  const refundId = `REF${Date.now().toString().slice(-8)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  
  this.refund = {
    amount,
    reason,
    processedAt: new Date(),
    refundId
  };
  
  this.status = 'REFUNDED';
  await this.save();
  
  return true;
};

// Method to generate payment ID
PaymentSchema.methods.generatePaymentId = function(): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PAY${timestamp}${random}`;
};

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);