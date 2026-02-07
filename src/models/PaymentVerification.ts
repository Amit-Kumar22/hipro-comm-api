import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentVerification extends Document {
  orderId?: string | null;
  transactionId: string;
  amount: number;
  screenshotPath: string;
  screenshotFilename: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date;
  verifiedBy?: string;
  rejectionReason?: string;
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
  screenshotPath: {
    type: String,
    required: true
  },
  screenshotFilename: {
    type: String,
    required: true
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
  }
}, {
  timestamps: true
});

// Indexes for better query performance
paymentVerificationSchema.index({ orderId: 1, verificationStatus: 1 });
paymentVerificationSchema.index({ createdAt: -1 });

// Static method to find pending verifications
paymentVerificationSchema.statics.findPending = function() {
  return this.find({ verificationStatus: 'pending' });
};

// Static method to verify payment
paymentVerificationSchema.statics.verifyPayment = function(
  orderId: string, 
  verifiedBy: string, 
  approved: boolean = true,
  rejectionReason?: string
) {
  const updateData: any = {
    verificationStatus: approved ? 'verified' : 'rejected',
    verifiedAt: new Date(),
    verifiedBy
  };

  if (!approved && rejectionReason) {
    updateData.rejectionReason = rejectionReason;
  }

  return this.findOneAndUpdate(
    { orderId, verificationStatus: 'pending' },
    updateData,
    { new: true }
  );
};

export default mongoose.model<IPaymentVerification>('PaymentVerification', paymentVerificationSchema);