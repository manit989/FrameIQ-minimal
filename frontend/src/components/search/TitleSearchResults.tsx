import { useState } from "react"
import { Film, RefreshCw, Search as SearchIcon } from "lucide-react"
import { VideoCard, VideoCardSkeleton } from "../video/VideoCard"
import { getApiErrorTitle, type ApiError, type VideoItem, type SearchResultItem } from "../../lib/api"
import { ShortsPlayer } from "./ShortsPlayer"

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
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)

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

  // Safely adapt VideoItem objects into complete SearchResultItem objects
  const playerItems: SearchResultItem[] = results.map((video: any) => {
    const videoId = video.video_id || video.id || ""
    const filename = video.video_filename || video.filename || (videoId ? `${videoId}.mp4` : "")

    return {
      ...video,
      video_id: videoId,
      video_filename: filename,
      title: video.title || "Untitled Video",
      thumbnail_url: video.thumbnail_url || video.thumbnail || "",
      start_time: Number(video.start_time) || 0, // Prevents NaN in player currentTime
      end_time: Number(video.end_time) || Number(video.duration) || 0,
      similarity_score: typeof video.similarity_score === "number" ? video.similarity_score : 1,
      text: video.text || video.description || video.title || "",
    } as SearchResultItem
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Found <span className="text-foreground font-medium">{results.length}</span> video{results.length !== 1 && "s"} with titles matching "{query}"
      </p>

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {results.map((video: any, index) => {
          const key = video.video_id || video.id || index
          return (
            <div
              key={key}
              onClickCapture={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setPlayingIndex(index)
              }}
              className="cursor-pointer"
            >
              <VideoCard video={video} index={index} />
            </div>
          )
        })}
      </div>

      {playingIndex !== null && (
        <ShortsPlayer
          items={playerItems}
          startIndex={playingIndex}
          onClose={() => setPlayingIndex(null)}
        />
      )}
    </div>
  )
}