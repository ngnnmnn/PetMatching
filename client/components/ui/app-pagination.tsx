'use client';

import * as React from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

export interface AppPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  showSummary?: boolean;
  scrollToId?: string;
  className?: string;
}

export default function AppPagination({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
  itemLabel,
  showSummary = true,
  scrollToId,
  className,
}: AppPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const firstItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  const handlePageSelect = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
    if (scrollToId && typeof window !== 'undefined') {
      const el = document.getElementById(scrollToId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const pageItems: Array<number | 'start-ellipsis' | 'end-ellipsis'> = React.useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, 'end-ellipsis', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [
        1,
        'start-ellipsis',
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }
    return [
      1,
      'start-ellipsis',
      currentPage - 1,
      currentPage,
      currentPage + 1,
      'end-ellipsis',
      totalPages,
    ];
  }, [totalPages, currentPage]);

  if (totalItems <= 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border-color)] px-4 py-3 sm:px-5 mt-4 rounded-xl bg-white/80 dark:bg-card/50 shadow-2xs backdrop-blur-xs',
        className,
      )}
    >
      {showSummary && (
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
          Hiển thị{' '}
          <span className="font-extrabold text-primary">
            {firstItem}–{lastItem}
          </span>{' '}
          trên <span className="font-extrabold text-primary">{totalItems}</span>
          {itemLabel ? ` ${itemLabel}` : ''}
        </p>
      )}

      {totalPages > 1 ? (
        <Pagination className="mx-0 w-auto">
          <PaginationContent className="gap-1">
            <PaginationItem>
              <PaginationPrevious
                aria-label="Trang trước"
                aria-disabled={currentPage === 1}
                tabIndex={currentPage === 1 ? -1 : 0}
                onClick={(e) => {
                  e.preventDefault();
                  handlePageSelect(currentPage - 1);
                }}
                className={cn(
                  'size-8 sm:size-9 rounded-lg font-bold transition select-none',
                  currentPage === 1
                    ? 'pointer-events-none opacity-40'
                    : 'cursor-pointer hover:bg-primary/10 hover:text-primary',
                )}
              />
            </PaginationItem>

            {pageItems.map((item, index) =>
              typeof item === 'number' ? (
                <PaginationItem key={item}>
                  <PaginationLink
                    isActive={item === currentPage}
                    aria-label={`Đến trang ${item}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handlePageSelect(item);
                    }}
                    className={cn(
                      'size-8 sm:size-9 rounded-lg font-extrabold text-xs transition cursor-pointer select-none',
                      item === currentPage
                        ? 'border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/95 hover:text-primary-foreground'
                        : 'hover:bg-primary/10 hover:text-primary',
                    )}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ) : (
                <PaginationItem key={`${item}-${index}`}>
                  <PaginationEllipsis className="size-8 sm:size-9 text-gray-400" />
                </PaginationItem>
              ),
            )}

            <PaginationItem>
              <PaginationNext
                aria-label="Trang sau"
                aria-disabled={currentPage === totalPages}
                tabIndex={currentPage === totalPages ? -1 : 0}
                onClick={(e) => {
                  e.preventDefault();
                  handlePageSelect(currentPage + 1);
                }}
                className={cn(
                  'size-8 sm:size-9 rounded-lg font-bold transition select-none',
                  currentPage === totalPages
                    ? 'pointer-events-none opacity-40'
                    : 'cursor-pointer hover:bg-primary/10 hover:text-primary',
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : (
        <div />
      )}
    </div>
  );
}
