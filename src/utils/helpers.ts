// Utility functions for the API

/**
 * Standardized Pagination Interface for all GET APIs
 */
export interface PaginationResult {
  page: number;
  size: number;
  skip: number;
  totalPages: number;
  totalElements: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Standardized Query Parameters Interface
 */
export interface StandardizedQueryParams {
  page?: number;
  size?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

/**
 * Standardized API Response Interface
 */
export interface StandardizedResponse<T> {
  data: T[];
  pageable: {
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
}

/**
 * Enhanced pagination calculation with standardized naming
 */
export const calculatePagination = (page: number = 1, size: number = 10, totalElements: number): PaginationResult => {
  // Ensure valid page and size values
  const validPage = Math.max(1, Math.floor(page));
  const validSize = Math.max(1, Math.min(100, Math.floor(size))); // Max 100 items per page
  const totalPages = Math.ceil(totalElements / validSize);
  const skip = (validPage - 1) * validSize;
  
  return {
    page: validPage,
    size: validSize,
    skip,
    totalPages,
    totalElements,
    hasNextPage: validPage < totalPages,
    hasPrevPage: validPage > 1
  };
};

/**
 * Parse and validate standardized query parameters
 */
export const parseStandardizedQuery = (query: any): StandardizedQueryParams => {
  return {
    page: query.page ? parseInt(query.page) : 1,
    size: query.size || query.limit ? parseInt(query.size || query.limit) : 10,
    sortBy: query.sortBy || 'createdAt',
    sortOrder: query.sortOrder === 'asc' ? 'asc' : 'desc',
    search: query.search || '',
    filters: {}
  };
};

/**
 * Build MongoDB sort object from standardized params
 */
export const buildSortObject = (sortBy: string = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc'): Record<string, 1 | -1> => {
  const sort: Record<string, 1 | -1> = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
  return sort;
};

/**
 * Build MongoDB filter object for search functionality
 */
export const buildSearchFilter = (search: string, searchFields: string[] = ['name']): Record<string, any> => {
  if (!search || !search.trim()) return {};
  
  return {
    $or: searchFields.map(field => ({
      [field]: { $regex: search.trim(), $options: 'i' }
    }))
  };
};

/**
 * Create standardized API response
 */
export const createStandardizedResponse = <T>(
  data: T[], 
  pagination: PaginationResult
): StandardizedResponse<T> => {
  return {
    data,
    pageable: {
      page: pagination.page,
      size: pagination.size,
      totalElements: pagination.totalElements,
      totalPages: pagination.totalPages
    }
  };
};

export const generateSlug = (name: string): string => {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

export const generateSKU = (name: string, categoryName: string): string => {
  const namePrefix = name.substring(0, 3).toUpperCase();
  const categoryPrefix = categoryName.substring(0, 2).toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `${categoryPrefix}-${namePrefix}-${timestamp}`;
};

export const generateOrderNumber = (): string => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = date.getTime().toString().slice(-4);
  return `ORD-${dateStr}-${timeStr}`;
};