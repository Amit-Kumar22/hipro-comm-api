import mongoose, { Document, Schema, Types } from 'mongoose';

// Category Interface
export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  image: string;
  parent?: Types.ObjectId;
  children: Types.ObjectId[];
  isActive: boolean;
  sortOrder: number;
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// Category Schema
const CategorySchema = new Schema<ICategory>({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxLength: [100, 'Category name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    required: [true, 'Category slug is required'],
    unique: true,
    lowercase: true,
    match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers and hyphens']
  },
  description: {
    type: String,
    required: [true, 'Category description is required'],
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  image: {
    type: String,
    required: [true, 'Category image is required']
  },
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  children: [{
    type: Schema.Types.ObjectId,
    ref: 'Category'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
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
  }
}, {
  timestamps: true
});

// Indexes
CategorySchema.index({ slug: 1 });
CategorySchema.index({ parent: 1 });
CategorySchema.index({ isActive: 1 });
CategorySchema.index({ sortOrder: 1 });
CategorySchema.index({ name: 'text', description: 'text' });

// Pre-save middleware to update parent's children array
CategorySchema.pre('save', async function(this: ICategory) {
  if (this.isModified('parent') && this.parent) {
    // Add this category to parent's children if not already present
    await mongoose.model('Category').findByIdAndUpdate(
      this.parent,
      { $addToSet: { children: this._id } }
    );
  }
});

// Pre-remove middleware to clean up parent-child relationships
CategorySchema.pre('deleteOne', { document: true, query: false }, async function(this: ICategory) {
  // Remove this category from parent's children array
  if (this.parent) {
    await mongoose.model('Category').findByIdAndUpdate(
      this.parent,
      { $pull: { children: this._id } }
    );
  }
  
  // Update children to remove parent reference
  await mongoose.model('Category').updateMany(
    { parent: this._id },
    { $unset: { parent: 1 } }
  );
});

export const Category = mongoose.model<ICategory>('Category', CategorySchema);