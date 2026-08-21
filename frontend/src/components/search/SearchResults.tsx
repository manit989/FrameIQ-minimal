import { useState, useRef, useCallback, useEffect } from "react"
import { Clock, Film, Sparkles, Search as SearchIcon, Play, RefreshCw, Volume2, VolumeX } from "lucide-react"
import { getApiErrorTitle, type ApiError, type SearchResultItem } from "../../lib/api"
import { ShortsPlayer } from "./ShortsPlayer"

interface SearchResultsProps {
  query: string
  results: SearchResultItem[]
  isLoading: boolean
  error: ApiError | null
  onRetry: () => void
}

export function SearchResults({ query, results, isLoading, error, onRetry }: SearchResultsProps) {
  const [playerIndex, setPlayerIndex] = useState<number | null>(null)

  // Empty state — no search yet
  if (!query && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-5">
          <Sparkles className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">AI-Powered Video Search</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Describe a scene, object, or concept — FrameIQ will find matching moments across all your analyzed videos.
        </p>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse text-primary" />
          Searching for "{query}"…
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`rounded-xl bg-muted/30 ring-1 ring-white/[0.04] animate-pulse stagger-${i + 1}`}>
              <div className="aspect-video bg-muted/50 rounded-t-xl" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 bg-muted/50 rounded" />
                <div className="h-3 w-1/2 bg-muted/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
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

  // No results
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mb-4">
          <SearchIcon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-base font-semibold text-foreground">No results found</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          No matching scenes found for "{query}". Try uploading more videos or using different search terms.
        </p>
      </div>
    )
  }

  // Results grid
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Found <span className="text-foreground font-medium">{results.length}</span> result{results.length !== 1 && "s"} for "{query}"
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {results.map((item, idx) => (
            <SearchResultCard
              key={`${item.video_id}-${item.start_time}`}
              item={item}
              index={idx}
              onOpen={() => setPlayerIndex(idx)}
            />
          ))}
        </div>
      </div>

      {/* Shorts Player Modal */}
      {playerIndex !== null && (
        <ShortsPlayer
          items={results}
          startIndex={playerIndex}
          onClose={() => setPlayerIndex(null)}
        />
      )}
    </>
  )
}

interface SearchResultCardProps {
  item: SearchResultItem
  index: number
  onOpen: () => void
}

function SearchResultCard({ item, index, onOpen }: SearchResultCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [videoReady, setVideoReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timeCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Use video_filename from API response to avoid hardcoded .mp4 404 errors
  const videoUrl = item.video_filename
    ? `/videos/${item.video_filename}`
    : `/videos/${item.video_id}.mp4`

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${min}:${sec.toString().padStart(2, "0")}`
  }

  const similarityPercent = Math.round(item.similarity_score * 100)

  // Start playback from start_time, loop at end_time
  const startPlayback = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = item.start_time
    video.play().then(() => {
      setIsPlaying(true)
    }).catch(() => {})

    if (timeCheckRef.current) clearInterval(timeCheckRef.current)
    timeCheckRef.current = setInterval(() => {
      if (video.currentTime >= item.end_time) {
        video.currentTime = item.start_time
      }
    }, 100)
  }, [item.start_time, item.end_time])

  const stopPlayback = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    video.pause()
    setIsPlaying(false)
    setVideoReady(false)

    if (timeCheckRef.current) {
      clearInterval(timeCheckRef.current)
      timeCheckRef.current = null
    }
  }, [])

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      startPlayback()
    }, 400)
  }

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    stopPlayback()
  }

  const handleClick = () => {
    // Stop the hover preview and open the Shorts player
    stopPlayback()
    onOpen()
  }

  const handleVideoCanPlay = () => {
    setVideoReady(true)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      if (timeCheckRef.current) clearInterval(timeCheckRef.current)
    }
  }, [])

  // Sync muted state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted
    }
  }, [isMuted])

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`
        rounded-xl border border-border/40 bg-card overflow-hidden
        hover:border-border hover:shadow-xl hover:shadow-black/20
        transition-all duration-300 cursor-pointer group
        animate-fade-in-up stagger-${(index % 12) + 1}
      `}
    >
      {/* Thumbnail / Video Area */}
      <div className="relative aspect-video bg-muted/30 overflow-hidden">
        {/* Thumbnail image — hidden when video is playing and ready */}
        <img
          src={item.thumbnail_url}
          alt={item.title}
          className={`
            absolute inset-0 h-full w-full object-cover transition-opacity duration-300
            ${isPlaying && videoReady ? "opacity-0" : "opacity-100"}
          `}
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget
            el.style.display = "none"
          }}
        />

        {/* Video element — preloaded on hover */}
        <video
          ref={videoRef}
          src={videoUrl}
          muted={isMuted}
          playsInline
          preload="none"
          onCanPlay={handleVideoCanPlay}
          className={`
            absolute inset-0 h-full w-full object-cover transition-opacity duration-300
            ${isPlaying && videoReady ? "opacity-100" : "opacity-0"}
          `}
        />

        {/* Fallback for missing thumbnail */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 -z-10">
          <Film className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Play button overlay — shown when not playing */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-110">
              <Play className="h-5 w-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Mute/Unmute toggle — shown when playing */}
        {isPlaying && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsMuted((prev) => !prev)
            }}
            className="absolute top-2 left-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition-colors"
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        )}

        {/* Time range badge — bottom left */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-medium text-white">
          <Clock className="h-2.5 w-2.5" />
          {formatTime(item.start_time)} — {formatTime(item.end_time)}
        </div>

        {/* Similarity score — bottom right, subtle */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-white/10 backdrop-blur-sm text-[10px] font-medium text-white/80">
          {similarityPercent}%
        </div>

        {/* Playing indicator bar */}
        {isPlaying && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
            <div className="h-full bg-primary/90 animate-shimmer" style={{ width: "100%" }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-sm font-medium text-foreground line-clamp-1">{item.title}</p>
        {item.text && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.text}</p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">
          {item.video_id}
        </p>
      </div>
    </div>
  )
}
