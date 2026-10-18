import { Skeleton } from "@/components/ui/misc";

/** Suspense fallback while search params resolve. Keeps the page from jumping. */
export function AuthFallback() {
  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-4 py-10" role="status" aria-label="Loading">
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="mt-4 h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-13 w-full" />
    </div>
  );
}
