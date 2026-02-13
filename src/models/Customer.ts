import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

// Customer Interface - Separate from Admin User
export interface ICustomer extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  phone?: string;
  isEmailVerified: boolean;
  googleId?: string;
  provider?: string;
  avatar?: string;
  otp?: {
    code: string;
    expiresAt: Date;
  };
  addresses: {
    type: 'billing' | 'shipping';
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    isDefault: boolean;
  }[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
  generateOTP(): { code: string; expiresAt: Date };
  isOTPValid(code: string): boolean;
}

// Customer Schema - Completely separate from User/Admin
const CustomerSchema = new Schema<ICustomer>({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxLength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: function(this: ICustomer) {
      // Password is not required for Google OAuth users
      return !this.googleId;
    },
    minLength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  phone: {
    type: String,
    match: [/^\d{10}$/, 'Please enter a valid 10-digit phone number'],
    sparse: true // Allows multiple null values
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
    required: true
  },
  googleId: {
    type: String,
    sparse: true // Allows multiple null values, but if set must be unique
  },
  provider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  avatar: {
    type: String
  },
  otp: {
    code: {
      type: String,
      select: false
    },
    expiresAt: {
      type: Date,
      select: false
    }
  },
  addresses: [{
    type: {
      type: String,
      enum: ['billing', 'shipping'],
      required: true
    },
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
    isDefault: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true
});

// Indexes
CustomerSchema.index({ email: 1 });
CustomerSchema.index({ googleId: 1 }, { sparse: true }); // Sparse index for googleId
CustomerSchema.index({ provider: 1 });
CustomerSchema.index({ isEmailVerified: 1 });
CustomerSchema.index({ 'otp.expiresAt': 1 }, { expireAfterSeconds: 0 }); // Auto cleanup expired OTPs
CustomerSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
CustomerSchema.pre('save', async function(this: ICustomer) {
  if (!this.isModified('password')) return;
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error: any) {
    throw error;
  }
});

// Method to compare password
CustomerSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate OTP
CustomerSchema.methods.generateOTP = function(): { code: string; expiresAt: Date } {
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
  
  this.otp = {
    code: code,
    expiresAt: expiresAt
  };
  
  return { code, expiresAt };
};

// Method to validate OTP
CustomerSchema.methods.isOTPValid = function(code: string): boolean {
  if (!this.otp || !this.otp.code || !this.otp.expiresAt) {
    return false;
  }
  
  if (this.otp.expiresAt < new Date()) {
    return false; // OTP expired
  }
  
  return this.otp.code === code;
};

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);