import { useState, useMemo } from "react";

interface UsePaginationOptions {
  pageSize?: number;
}

interface UsePaginationResult<T> {
  currentPage: number;
  totalPages: number;
  paginatedData: T[];
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  startIndex: number;
  endIndex: number;
  totalItems: number;
}

export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
): UsePaginationResult<T> {
  const { pageSize = 20 } = options;
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Reset to page 1 if current page is out of bounds
  const validPage = useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      return 1;
    }
    return currentPage;
  }, [currentPage, totalPages]);

  const paginatedData = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    const end = start + pageSize;
    return data.slice(start, end);
  }, [data, validPage, pageSize]);

  const startIndex = (validPage - 1) * pageSize + 1;
  const endIndex = Math.min(validPage * pageSize, totalItems);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const nextPage = () => {
    if (validPage < totalPages) {
      setCurrentPage(validPage + 1);
    }
  };

  const prevPage = () => {
    if (validPage > 1) {
      setCurrentPage(validPage - 1);
    }
  };

  return {
    currentPage: validPage,
    totalPages,
    paginatedData,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage: validPage < totalPages,
    hasPrevPage: validPage > 1,
    startIndex: totalItems > 0 ? startIndex : 0,
    endIndex,
    totalItems,
  };
}
