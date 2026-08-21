import { useState, useRef, useCallback, useEffect } from "react"
import { Play, Clock, Film, Layers, Volume2, VolumeX } from "lucide-react"
import type { VideoItem } from "../../lib/api"

interface VideoCardProps {
  video: VideoItem
  index?: number
}

export function VideoCard({ video, index = 0 }: VideoCardProps) {
  const staggerClass = `stagger-${(index % 12) + 1}`
  const [isHovering, setIsHovering] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [videoReady, setVideoReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const videoUrl = `/videos/${video.video_filename}`

  const startPlayback = useCallback(() => {
    const vid = videoRef.current
    if (!vid) return
    vid.currentTime = 0
    vid.play()
      .then(() => setIsPlaying(true))
      .catch(() => {})
  }, [])

  const stopPlayback = useCallback(() => {
    const vid = videoRef.current
    if (!vid) return
    vid.pause()
    vid.currentTime = 0
    setIsPlaying(false)
    setVideoReady(false)
  }, [])

  const handleMouseEnter = () => {
    setIsHovering(true)
    hoverTimerRef.current = setTimeout(() => {
      startPlayback()
    }, 400)
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    stopPlayback()
  }

  const handleVideoCanPlay = () => {
    setVideoReady(true)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    }
  }, [])

  // Sync muted state
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted
  }, [isMuted])

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        animate-fade-in-up ${staggerClass}
        relative aspect-[9/14] w-full overflow-hidden rounded-xl
        bg-zinc-900 group cursor-pointer select-none
        ring-1 ring-white/[0.06] hover:ring-white/[0.12]
        transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/40
      `}
    >
      {/* Thumbnail Image — hidden when video is playing and ready */}
      <img
        src={video.thumbnail_url}
        alt={video.title}
        className={`
          absolute inset-0 h-full w-full object-cover transition-opacity duration-300
          ${isPlaying && videoReady ? "opacity-0" : "opacity-100"}
        `}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = "none"
        }}
      />

      {/* Video element — preloaded on hover */}
      <video
        ref={videoRef}
        src={isHovering ? videoUrl : undefined}
        muted={isMuted}
        playsInline
        loop
        preload="none"
        onCanPlay={handleVideoCanPlay}
        className={`
          absolute inset-0 h-full w-full object-cover transition-opacity duration-300
          ${isPlaying && videoReady ? "opacity-100" : "opacity-0"}
        `}
      />

      {/* Gradient fallback behind the image */}
      <div className="absolute inset-0 -z-[1] bg-gradient-to-br from-zinc-800/60 via-zinc-900/40 to-zinc-950/80">
        <div className="absolute inset-0 flex items-center justify-center">
          <Film className="h-10 w-10 text-white/20" />
        </div>
      </div>

      {/* Play icon on hover — hidden when actually playing */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
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
          {isMuted ? (
            <VolumeX className="h-3.5 w-3.5" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      {/* Duration badge — top right */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-medium text-white">
        <Clock className="h-2.5 w-2.5" />
        {video.duration}
      </div>

      {/* Bottom gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Content overlay */}
      <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col justify-end translate-y-2 group-hover:translate-y-0 transition-transform duration-300 z-10">
        {/* Title */}
        <p className="text-[12px] font-semibold leading-snug text-white line-clamp-2 drop-shadow-lg mb-1">
          {video.title}
        </p>

        {/* Original uploaded filename */}
        <p
          title={video.original_filename}
          className="text-[10px] text-zinc-300 truncate drop-shadow mb-2"
        >
          {video.original_filename}
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[10px] font-medium text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {video.scene_count} scenes
          </span>
          <span className="text-zinc-500 font-mono">
            {video.video_id}
          </span>
        </div>
      </div>

      {/* Playing indicator bar */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 z-20">
          <div
            className="h-full bg-primary/90 animate-shimmer"
            style={{ width: "100%" }}
          />
        </div>
      )}
    </div>
  )
}

export function VideoCardSkeleton() {
  return (
    <div className="aspect-[9/14] w-full rounded-xl bg-muted/50 ring-1 ring-white/[0.04] animate-pulse" />
  )
}
