import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PaginacaoCompactaProps {
  page: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

/**
 * Paginação compacta (até 3 números + prev/next) — estava duplicada
 * praticamente linha a linha entre as abas "Por Extrato" e "Por Transação"
 * do ConciliacaoManual (F7 sub-frente 2/5).
 */
export function PaginacaoCompacta({
  page,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginacaoCompactaProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col gap-2 pt-3 border-t mt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        {(page - 1) * itemsPerPage + 1} -{" "}
        {Math.min(page * itemsPerPage, totalItems)} de {totalItems}
      </p>
      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
            />
          </PaginationItem>
          {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
            let pageNumber: number;
            if (totalPages <= 3) {
              pageNumber = i + 1;
            } else if (page === 1) {
              pageNumber = i + 1;
            } else if (page === totalPages) {
              pageNumber = totalPages - 2 + i;
            } else {
              pageNumber = page - 1 + i;
            }
            return (
              <PaginationItem key={pageNumber}>
                <PaginationLink
                  onClick={() => onPageChange(pageNumber)}
                  isActive={page === pageNumber}
                >
                  {pageNumber}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
