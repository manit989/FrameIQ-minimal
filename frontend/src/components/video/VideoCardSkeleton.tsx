export function VideoCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {/* Thumbnail Skeleton */}
      <div className="aspect-video w-full rounded-xl bg-muted" />
      
      {/* Details Skeleton */}
      <div className="flex gap-3 px-0.5">
        <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-4 w-5/6 bg-muted rounded" />
          <div className="h-3 w-1/2 bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}