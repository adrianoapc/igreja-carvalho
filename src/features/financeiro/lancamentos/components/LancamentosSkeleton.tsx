import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton padronizado das listas do financeiro (F2/ADR-029 §6.5). */
export function LancamentosSkeleton({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="space-y-2 p-4 md:p-6 pt-0" aria-busy="true">
      {Array.from({ length: linhas }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border bg-card"
        >
          <div className="flex-shrink-0 w-12 md:w-14 space-y-1">
            <Skeleton className="h-4 w-8 mx-auto" />
            <Skeleton className="h-3 w-10 mx-auto" />
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <div className="flex-shrink-0 space-y-2 text-right">
            <Skeleton className="h-5 w-24 ml-auto" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}
