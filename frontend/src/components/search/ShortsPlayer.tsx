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
  ChevronUp,
  ChevronDown,
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
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const timeCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const isAnimatingRef = useRef(false)
  const touchStartYRef = useRef<number | null>(null)
  // Ref mirror of currentIndex for use inside event handlers to avoid stale closures
  const currentIndexRef = useRef(startIndex)

  // Keep ref in sync with state
  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

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
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }, [])

  // ── Navigate between clips with smooth imperative animation ──
  const goToClip = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= items.length) return
    if (isAnimatingRef.current) return

    isAnimatingRef.current = true
    const direction = newIndex > currentIndexRef.current ? 1 : -1
    const container = videoContainerRef.current
    if (!container) {
      isAnimatingRef.current = false
      return
    }

    // Phase 1 — Slide the current clip out
    container.style.transition =
      "transform 0.18s ease-in, opacity 0.15s ease-in"
    container.style.transform = `translateY(${-direction * 70}px) scale(0.97)`
    container.style.opacity = "0"

    setTimeout(() => {
      // Phase 2 — Jump instantly to the entrance position (no transition)
      container.style.transition = "none"
      container.style.transform = `translateY(${direction * 70}px) scale(0.97)`
      // opacity stays 0 so the loading frame isn't visible

      // Update React state → triggers the useEffect that loads the new video
      setCurrentIndex(newIndex)
      setProgress(0)
      setLiked(false)

      // Phase 3 — Slide in (double-rAF ensures the browser committed the jump)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          container.style.transition =
            "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-out"
          container.style.transform = "translateY(0) scale(1)"
          container.style.opacity = "1"

          setTimeout(() => {
            isAnimatingRef.current = false
          }, 300)
        })
      })
    }, 180) // matches Phase 1 duration
  }, [items.length])

  // ── Load & play video when clip changes ──
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const curItem = items[currentIndex]
    const filename = curItem.video_filename || `${curItem.video_id}.mp4`

    video.pause()
    video.src = `/videos/${filename}`
    video.load()

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

  // ── Wheel navigation ──
  useEffect(() => {
    const el = playerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (isAnimatingRef.current) return

      if (e.deltaY > 30) {
        goToClip(currentIndexRef.current + 1)
      } else if (e.deltaY < -30) {
        goToClip(currentIndexRef.current - 1)
      }
    }

    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [goToClip])

  // ── Touch swipe navigation ──
  useEffect(() => {
    const el = playerRef.current
    if (!el) return

    const handleTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartYRef.current === null) return
      const deltaY = touchStartYRef.current - e.changedTouches[0].clientY
      touchStartYRef.current = null

      if (deltaY > 50) {
        goToClip(currentIndexRef.current + 1)
      } else if (deltaY < -50) {
        goToClip(currentIndexRef.current - 1)
      }
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [goToClip])

  // ── Keyboard navigation ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose()
          break
        case "ArrowUp":
          e.preventDefault()
          goToClip(currentIndexRef.current - 1)
          break
        case "ArrowDown":
          e.preventDefault()
          goToClip(currentIndexRef.current + 1)
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
  }, [onClose, goToClip, togglePlay])

  // ── Sync muted ──
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted
  }, [isMuted])

  // ── Lock body scroll ──
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  // ── Seek within clip ──
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
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose()
      }}
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
              <p className="text-white text-sm font-semibold line-clamp-2">
                {item.title}
              </p>
              <p className="text-white/40 text-xs font-mono mt-1">
                {item.video_id}
              </p>
            </div>

            {cleanText && (
              <div>
                <p className="text-white/50 text-[10px] uppercase tracking-wider font-semibold mb-1">
                  Description
                </p>
                <p className="text-white/70 text-xs leading-relaxed">
                  {cleanText}
                </p>
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

        {/* Center — Video player */}
        <div
          ref={playerRef}
          className="relative h-full aspect-[9/16] max-w-[400px] rounded-2xl overflow-hidden bg-black"
        >
          {/*
            Video container — always mounted, NEVER remounted.
            Transitions are driven imperatively via videoContainerRef.
          */}
          <div
            ref={videoContainerRef}
            className="h-full w-full relative"
            style={{ willChange: "transform, opacity" }}
          >
            {/* Thumbnail poster — visible while video loads */}
            <img
              src={item.thumbnail_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover -z-[1]"
            />

            <video
              ref={videoRef}
              muted={isMuted}
              playsInline
              className="h-full w-full object-cover"
            />

            {/* Tap to play/pause */}
            <div
              onClick={(e) => {
                e.stopPropagation()
                togglePlay()
              }}
              className="absolute inset-0 z-10"
            >
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 animate-fade-in-fast">
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
                <p className="text-white text-sm font-semibold line-clamp-2 drop-shadow-lg">
                  {item.title}
                </p>
                {cleanText && (
                  <p className="text-white/60 text-xs mt-1 line-clamp-2">
                    {cleanText}
                  </p>
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

          {/* Navigation hint arrows */}
          {currentIndex > 0 && (
            <button
              onClick={() => goToClip(currentIndex - 1)}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white/50 hover:bg-black/50 hover:text-white transition-all"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
          {currentIndex < items.length - 1 && (
            <button
              onClick={() => goToClip(currentIndex + 1)}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white/50 hover:bg-black/50 hover:text-white transition-all animate-bounce-subtle"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Right side — Action buttons */}
        <div className="flex flex-col items-center gap-5 py-4 self-end mb-16">
          {/* Like */}
          <button
            onClick={() => setLiked(!liked)}
            className="flex flex-col items-center gap-1"
          >
            <div
              className={`
              flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200
              ${liked ? "bg-primary/20 text-primary" : "bg-white/10 text-white hover:bg-white/20"}
            `}
            >
              <Heart
                className={`h-5 w-5 transition-transform duration-200 ${liked ? "fill-primary scale-110" : ""}`}
              />
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
              {isMuted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </div>
            <span className="text-[10px] text-white/60">
              {isMuted ? "Unmute" : "Mute"}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}