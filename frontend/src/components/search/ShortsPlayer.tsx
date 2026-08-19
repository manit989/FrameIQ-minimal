import { useState, useRef, useEffect, useCallback } from "react"
import {
  X,
  Play,
  Volume2,
  VolumeX,
  Heart,
  Share2,
  MessageCircle,
  Clock,
  Sparkles,
} from "lucide-react"
import type { SearchResultItem } from "../../lib/api"
import { cleanSceneText } from "../../lib/utils"

interface ShortsPlayerProps {
  items: SearchResultItem[]
  startIndex: number
  onClose: () => void
}

export function ShortsPlayer({ items, startIndex, onClose }: ShortsPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [liked, setLiked] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timeCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const item = items[currentIndex]
  const similarityPercent = Math.round(item.similarity_score * 100)

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${min}:${sec.toString().padStart(2, "0")}`
  }

  const clipDuration = item.end_time - item.start_time

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
    } else {
      video.play().then(() => setIsPlaying(true)).catch(() => {})
    }
  }, [isPlaying])

  // Navigate between clips
  const goToClip = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= items.length) return
    setCurrentIndex(newIndex)
    setProgress(0)
    setLiked(false)

    // Scroll the snap container to the correct position
    const scrollEl = scrollRef.current
    if (scrollEl) {
      isScrollingRef.current = true
      const targetY = newIndex * scrollEl.clientHeight
      scrollEl.scrollTo({ top: targetY, behavior: "smooth" })
      // Reset scroll lock after animation
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false
      }, 600)
    }
  }, [items.length])

  // Start playing when clip changes
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.pause()
    video.src = `/videos/${items[currentIndex].video_id}.mp4`
    video.load()

    const curItem = items[currentIndex]
    const curDuration = curItem.end_time - curItem.start_time

    const handleCanPlay = () => {
      video.currentTime = curItem.start_time
      video.play().then(() => setIsPlaying(true)).catch(() => {})
    }
    video.addEventListener("canplay", handleCanPlay, { once: true })

    if (timeCheckRef.current) clearInterval(timeCheckRef.current)
    timeCheckRef.current = setInterval(() => {
      if (!video) return
      const elapsed = video.currentTime - curItem.start_time
      setProgress(Math.min(Math.max(elapsed / curDuration, 0), 1))
      if (video.currentTime >= curItem.end_time) {
        video.currentTime = curItem.start_time
      }
    }, 50)

    return () => {
      video.removeEventListener("canplay", handleCanPlay)
      if (timeCheckRef.current) clearInterval(timeCheckRef.current)
    }
  }, [currentIndex, items])

  // Scroll snap detection — detect which clip user scrolled to
  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    // Initial scroll to startIndex
    scrollEl.scrollTo({ top: startIndex * scrollEl.clientHeight, behavior: "instant" })

    const handleScroll = () => {
      if (isScrollingRef.current) return

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = setTimeout(() => {
        const idx = Math.round(scrollEl.scrollTop / scrollEl.clientHeight)
        const clamped = Math.max(0, Math.min(idx, items.length - 1))
        if (clamped !== currentIndex) {
          setCurrentIndex(clamped)
          setProgress(0)
          setLiked(false)
        }
      }, 150)
    }

    scrollEl.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      scrollEl.removeEventListener("scroll", handleScroll)
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    }
  }, [startIndex, items.length, currentIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose()
          break
        case "ArrowUp":
          e.preventDefault()
          goToClip(currentIndex - 1)
          break
        case "ArrowDown":
          e.preventDefault()
          goToClip(currentIndex + 1)
          break
        case " ":
          e.preventDefault()
          togglePlay()
          break
        case "m":
          setIsMuted((p) => !p)
          break
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [currentIndex, isPlaying, onClose, goToClip, togglePlay])

  // Sync muted
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted
  }, [isMuted])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  // Click on progress bar to seek within clip
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    const targetTime = item.start_time + pct * clipDuration
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime
    }
  }

  const cleanText = cleanSceneText(item.text)

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-5 left-5 z-50 text-white/60 text-sm font-medium">
        {currentIndex + 1} / {items.length}
      </div>

      {/* Main layout */}
      <div className="relative flex items-center gap-4 h-full max-h-[92vh] py-4">

        {/* Left side — Scene info panel (desktop only) */}
        <div className="hidden lg:flex flex-col justify-end w-72 h-full max-h-[calc(92vh-2rem)] pb-4">
          <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5 space-y-4 max-h-[50%] overflow-y-auto no-scrollbar">
            <div>
              <p className="text-white text-sm font-semibold line-clamp-2">{item.title}</p>
              <p className="text-white/40 text-xs font-mono mt-1">{item.video_id}</p>
            </div>

            {cleanText && (
              <div>
                <p className="text-white/50 text-[10px] uppercase tracking-wider font-semibold mb-1">Description</p>
                <p className="text-white/70 text-xs leading-relaxed">{cleanText}</p>
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-white/50">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(item.start_time)} — {formatTime(item.end_time)}
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {similarityPercent}% match
              </span>
            </div>
          </div>
        </div>

        {/* Center — Scroll-snap container with video player */}
        <div className="relative h-full aspect-[9/16] max-w-[400px]">
          {/* The snap scroll container — each "page" represents a clip */}
          <div
            ref={scrollRef}
            className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar rounded-2xl"
          >
            {items.map((clipItem, idx) => (
              <div
                key={`${clipItem.video_id}-${clipItem.start_time}`}
                className="h-full w-full snap-start snap-always shrink-0 relative"
              >
                {/* Only the active clip gets the real video */}
                {idx === currentIndex ? (
                  // Active clip — real video player
                  <div className="h-full w-full bg-black relative overflow-hidden">
                    <video
                      ref={videoRef}
                      muted={isMuted}
                      playsInline
                      className="h-full w-full object-cover"
                    />

                    {/* Click to play/pause */}
                    <div
                      onClick={(e) => { e.stopPropagation(); togglePlay() }}
                      className="absolute inset-0 z-10"
                    >
                      {!isPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
                            <Play className="h-7 w-7 text-white fill-white ml-1" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Progress bar — top */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-20 cursor-pointer"
                      onClick={handleProgressClick}
                    >
                      <div
                        className="h-full bg-white/90 transition-[width] duration-100 ease-linear"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>

                    {/* Bottom info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none">
                      <div className="lg:hidden">
                        <p className="text-white text-sm font-semibold line-clamp-2 drop-shadow-lg">{item.title}</p>
                        {cleanText && (
                          <p className="text-white/60 text-xs mt-1 line-clamp-2">{cleanText}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-white/60">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(item.start_time)} — {formatTime(item.end_time)}
                        </span>
                        <span className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded">
                          {similarityPercent}% match
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Inactive clip — thumbnail placeholder
                  <div className="h-full w-full bg-black relative overflow-hidden flex items-center justify-center">
                    <img
                      src={clipItem.thumbnail_url}
                      alt={clipItem.title}
                      className="h-full w-full object-cover opacity-50"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
                        <Play className="h-6 w-6 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                    {/* Title overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-white text-sm font-semibold line-clamp-1 drop-shadow-lg">{clipItem.title}</p>
                      <p className="text-white/50 text-xs mt-0.5">{cleanSceneText(clipItem.text)}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right side — Action buttons */}
        <div className="flex flex-col items-center gap-5 py-4 self-end mb-16">
          {/* Like */}
          <button
            onClick={() => setLiked(!liked)}
            className="flex flex-col items-center gap-1"
          >
            <div className={`
              flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200
              ${liked ? "bg-primary/20 text-primary" : "bg-white/10 text-white hover:bg-white/20"}
            `}>
              <Heart className={`h-5 w-5 transition-transform duration-200 ${liked ? "fill-primary scale-110" : ""}`} />
            </div>
            <span className="text-[10px] text-white/60">Like</span>
          </button>

          {/* Info */}
          <button className="flex flex-col items-center gap-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
              <MessageCircle className="h-5 w-5" />
            </div>
            <span className="text-[10px] text-white/60">Info</span>
          </button>

          {/* Share */}
          <button className="flex flex-col items-center gap-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
              <Share2 className="h-5 w-5" />
            </div>
            <span className="text-[10px] text-white/60">Share</span>
          </button>

          {/* Mute */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="flex flex-col items-center gap-1"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </div>
            <span className="text-[10px] text-white/60">{isMuted ? "Unmute" : "Mute"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
