// Utility functions for the API

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const calculatePagination = (page: number, limit: number, totalCount: number): PaginationResult => {
  const totalPages = Math.ceil(totalCount / limit);
  const skip = (page - 1) * limit;
  
  return {
    page,
    limit,
    skip,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
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