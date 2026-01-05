import { Request, Response } from 'express';
import { z } from 'zod';
import { Category, Product } from '../models';
import { 
  asyncHandler, 
  ValidationError, 
  NotFoundError 
} from '../middleware/errorMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { generateSlug } from '../utils/helpers';

// Validation schema for category
const categorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500),
  image: z.string().url('Invalid image URL'),
  parent: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid parent category ID').optional(),
  sortOrder: z.number().min(0).default(0),
  seo: z.object({
    metaTitle: z.string().max(60).optional(),
    metaDescription: z.string().max(160).optional(),
    metaKeywords: z.array(z.string()).optional()
  }).optional()
});

const updateCategorySchema = categorySchema.partial();

/**
 * @swagger
 * /api/v1/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include inactive categories
 *       - in: query
 *         name: parentOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Return only parent categories (no children)
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const { includeInactive = false, parentOnly = false } = req.query;

  const filter: any = {};
  if (!includeInactive || includeInactive === 'false') {
    filter.isActive = true;
  }
  if (parentOnly === 'true') {
    filter.parent = null;
  }

  const categories = await Category.find(filter)
    .populate('parent', 'name slug')
    .populate('children', 'name slug isActive')
    .sort({ sortOrder: 1, name: 1 });

  res.json({
    success: true,
    data: categories
  });
});

// Get category by ID
export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const category = await Category.findById(id)
    .populate('parent', 'name slug description')
    .populate('children', 'name slug description isActive');

  if (!category) {
    throw new NotFoundError('Category not found');
  }

  res.json({
    success: true,
    data: category
  });
});

// Get category by slug
export const getCategoryBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;

  const category = await Category.findOne({ slug, isActive: true })
    .populate('parent', 'name slug description')
    .populate('children', 'name slug description isActive');

  if (!category) {
    throw new NotFoundError('Category not found');
  }

  // Get product count for this category
  const productCount = await Product.countDocuments({ 
    category: category._id, 
    isActive: true 
  });

  res.json({
    success: true,
    data: {
      ...category.toObject(),
      productCount
    }
  });
});

// Create new category (Admin only)
export const createCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const validatedData = categorySchema.parse(req.body);

  // Check if parent category exists (if specified)
  if (validatedData.parent) {
    const parentCategory = await Category.findById(validatedData.parent);
    if (!parentCategory) {
      throw new ValidationError('Parent category not found');
    }
  }

  // Generate slug
  const slug = generateSlug(validatedData.name);

  // Check if slug already exists
  const existingCategory = await Category.findOne({ slug });
  if (existingCategory) {
    throw new ValidationError('A category with this name already exists');
  }

  // Create category
  const category = await Category.create({
    ...validatedData,
    slug
  });

  // Populate the created category
  const populatedCategory = await Category.findById(category._id)
    .populate('parent', 'name slug');

  res.status(201).json({
    success: true,
    data: populatedCategory
  });
});

// Update category (Admin only)
export const updateCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const validatedData = updateCategorySchema.parse(req.body);

  const category = await Category.findById(id);
  if (!category) {
    throw new NotFoundError('Category not found');
  }

  // Check if parent category exists (if being updated)
  if (validatedData.parent) {
    const parentCategory = await Category.findById(validatedData.parent);
    if (!parentCategory) {
      throw new ValidationError('Parent category not found');
    }
    
    // Prevent setting self or child as parent
    if (validatedData.parent === id) {
      throw new ValidationError('Category cannot be its own parent');
    }
  }

  // Update slug if name is changed
  let updateData: any = validatedData;
  if (validatedData.name && validatedData.name !== category.name) {
    const newSlug = generateSlug(validatedData.name);
    
    // Check if new slug already exists
    const existingCategory = await Category.findOne({ 
      slug: newSlug, 
      _id: { $ne: id } 
    });
    if (existingCategory) {
      throw new ValidationError('A category with this name already exists');
    }
    
    updateData = { ...validatedData, slug: newSlug };
  }

  // Update category
  const updatedCategory = await Category.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).populate('parent', 'name slug').populate('children', 'name slug');

  res.json({
    success: true,
    data: updatedCategory
  });
});

// Delete category (Admin only)
export const deleteCategory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    throw new NotFoundError('Category not found');
  }

  // Check if category has products
  const productCount = await Product.countDocuments({ category: id });
  if (productCount > 0) {
    throw new ValidationError('Cannot delete category that has products. Please move or delete products first.');
  }

  // Check if category has children
  const childCount = await Category.countDocuments({ parent: id });
  if (childCount > 0) {
    throw new ValidationError('Cannot delete category that has subcategories. Please delete subcategories first.');
  }

  // Soft delete by setting isActive to false
  await Category.findByIdAndUpdate(id, { isActive: false });

  res.json({
    success: true,
    message: 'Category deleted successfully'
  });
});

// Get category tree (hierarchical structure)
export const getCategoryTree = asyncHandler(async (req: Request, res: Response) => {
  const categories = await Category.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 });

  // Build tree structure
  const categoryMap = new Map();
  const rootCategories: any[] = [];

  // First pass: create map and identify root categories
  categories.forEach(category => {
    const categoryObj = {
      ...category.toObject(),
      children: []
    };
    categoryMap.set(category._id.toString(), categoryObj);
    
    if (!category.parent) {
      rootCategories.push(categoryObj);
    }
  });

  // Second pass: build parent-child relationships
  categories.forEach(category => {
    if (category.parent) {
      const parent = categoryMap.get(category.parent.toString());
      const child = categoryMap.get(category._id.toString());
      if (parent && child) {
        parent.children.push(child);
      }
    }
  });

  res.json({
    success: true,
    data: rootCategories
  });
});