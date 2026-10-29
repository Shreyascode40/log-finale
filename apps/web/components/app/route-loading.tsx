/**
 * Shared route-level loading skeleton. Kept outside the paper sheet components:
 * this is app chrome, so it must never appear in the printable logbook.
 */
export function RouteLoading({ withHeader = false }: { withHeader?: boolean }) {
  const progress = (
    <div
      aria-hidden
      className="print-hide pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-neutral-200/70"
    >
      <div className="route-progress-bar h-full bg-neutral-900" />
    </div>
  );

  const content = (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto w-full max-w-5xl px-4 py-6"
    >
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <span className="relative inline-flex h-5 w-5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-200 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 motion-reduce:animate-none" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900">Preparing your logbook…</p>
            <p className="text-xs text-muted-foreground">Loading the next page.</p>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none" />
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-neutral-100 motion-reduce:animate-none" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-neutral-100 motion-reduce:animate-none" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-neutral-100 motion-reduce:animate-none" />
          </div>
          <div className="h-24 w-full animate-pulse rounded bg-neutral-50 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );

  if (!withHeader) {
    return (
      <>
        {progress}
        {content}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      {progress}
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="space-y-2">
            <div className="h-3 w-52 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none" />
            <div className="h-2 w-64 animate-pulse rounded bg-neutral-100 motion-reduce:animate-none" />
          </div>
          <div className="h-8 w-24 animate-pulse rounded bg-neutral-100 motion-reduce:animate-none" />
        </div>
      </div>
      {content}
    </div>
  );
}
