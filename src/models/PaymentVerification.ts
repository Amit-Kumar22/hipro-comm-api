import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentVerification extends Document {
  orderId?: string | null;
  transactionId: string;
  amount: number;
  paymentMethod: 'bank_transfer' | 'upi' | 'online';
  screenshot: {
    data: Buffer;
    contentType: string;
    filename: string;
    size: number;
  };
  customerInfo?: {
    email: string;
    name: string;
    phone?: string;
  };
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date;
  verifiedBy?: string;
  rejectionReason?: string;
  orderCancelledDueToFraud?: boolean;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentVerificationSchema: Schema = new Schema({
  orderId: {
    type: String,
    required: false,
    default: null,
    index: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'upi', 'online'],
    required: true
  },
  screenshot: {
    data: {
      type: Buffer,
      required: true
    },
    contentType: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    }
  },
  customerInfo: {
    email: {
      type: String,
      required: false
    },
    name: {
      type: String,
      required: false
    },
    phone: {
      type: String,
      required: false
    }
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
    index: true
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  verifiedBy: {
    type: String,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  orderCancelledDueToFraud: {
    type: Boolean,
    default: false
  },
  adminNotes: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better query performance
paymentVerificationSchema.index({ orderId: 1, verificationStatus: 1 });
paymentVerificationSchema.index({ createdAt: -1 });
paymentVerificationSchema.index({ 'customerInfo.email': 1 });

// Static method to find pending verifications
paymentVerificationSchema.statics.findPending = function() {
  return this.find({ verificationStatus: 'pending' }).sort({ createdAt: -1 });
};

// Static method to verify payment
paymentVerificationSchema.statics.verifyPayment = function(
  orderId: string, 
  verifiedBy: string, 
  approved: boolean = true,
  rejectionReason?: string,
  adminNotes?: string
) {
  const updateData: any = {
    verificationStatus: approved ? 'verified' : 'rejected',
    verifiedAt: new Date(),
    verifiedBy
  };

  if (!approved && rejectionReason) {
    updateData.rejectionReason = rejectionReason;
  }

  if (adminNotes) {
    updateData.adminNotes = adminNotes;
  }

  return this.findOneAndUpdate(
    { orderId, verificationStatus: 'pending' },
    updateData,
    { new: true }
  );
};

// Method to get screenshot as base64
paymentVerificationSchema.methods.getScreenshotBase64 = function() {
  if (this.screenshot && this.screenshot.data) {
    return `data:${this.screenshot.contentType};base64,${this.screenshot.data.toString('base64')}`;
  }
  return null;
};

export default mongoose.model<IPaymentVerification>('PaymentVerification', paymentVerificationSchema);