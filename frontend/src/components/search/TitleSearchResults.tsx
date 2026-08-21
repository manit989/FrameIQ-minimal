import { Film, RefreshCw, Search as SearchIcon } from "lucide-react"
import { VideoCard, VideoCardSkeleton } from "../video/VideoCard"
import { getApiErrorTitle, type ApiError, type VideoItem } from "../../lib/api"

interface TitleSearchResultsProps {
  query: string
  results: VideoItem[]
  isLoading: boolean
  error: ApiError | null
  onRetry: () => void
}

export function TitleSearchResults({
  query,
  results,
  isLoading,
  error,
  onRetry,
}: TitleSearchResultsProps) {
  if (!query && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-5">
          <Film className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Search by video title</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Enter part or all of a title to find a video in your library.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SearchIcon className="h-4 w-4 animate-pulse text-primary" />
          Searching titles for "{query}"…
        </div>
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <VideoCardSkeleton key={index} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 mb-4">
          <SearchIcon className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-base font-semibold text-foreground">{getApiErrorTitle(error)}</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">{error.message}</p>
        <p className="mt-2 text-[11px] font-mono text-muted-foreground/70">
          {error.code}{error.requestId ? ` • Request ${error.requestId}` : ""}
        </p>
        {error.retryable && (
          <button
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry search
          </button>
        )}
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
          <SearchIcon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-base font-semibold text-foreground">No matching titles found</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          No video title contains "{query}". Try a shorter or different title.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Found <span className="text-foreground font-medium">{results.length}</span> video{results.length !== 1 && "s"} with titles matching "{query}"
      </p>
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {results.map((video, index) => (
          <VideoCard key={video.video_id} video={video} index={index} />
        ))}
      </div>
    </div>
  )
}
