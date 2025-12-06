import { useEffect, useRef, useCallback, useState } from "react";

interface UseInfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
  onLoadMore?: () => void;
}

interface UseInfiniteScrollReturn {
  loadMoreRef: (node: HTMLElement | null) => void;
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  setIsLoading: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  reset: () => void;
  triggerLoadMore: () => void;
}

export function useInfiniteScroll(
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn {
  const { threshold = 0.1, rootMargin = "100px", onLoadMore } = options;
  
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  
  // Use ref to always have latest callback
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);
  
  const observer = useRef<IntersectionObserver | null>(null);
  
  const triggerLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setIsLoading(true);
      setPage(prev => prev + 1);
    }
  }, [isLoading, hasMore]);
  
  const loadMoreRef = useCallback(
    (node: HTMLElement | null) => {
      if (observer.current) observer.current.disconnect();
      
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !isLoading) {
            if (onLoadMoreRef.current) {
              onLoadMoreRef.current();
            } else {
              setIsLoading(true);
              setPage(prev => prev + 1);
            }
          }
        },
        { threshold, rootMargin }
      );
      
      if (node) observer.current.observe(node);
    },
    [isLoading, hasMore, threshold, rootMargin]
  );

  const reset = useCallback(() => {
    setPage(1);
    setHasMore(true);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, []);

  return {
    loadMoreRef,
    isLoading,
    hasMore,
    page,
    setIsLoading,
    setHasMore,
    setPage,
    reset,
    triggerLoadMore
  };
}
