import { Heart, Eye, Play, Clock } from "lucide-react"

interface VideoCardProps {
  title?: string
  channelName?: string
  views?: string
  likes?: string
  duration?: string
  thumbnailUrl?: string
  gradient?: string
  index?: number
}

export function VideoCard({
  title = "Building a Modern Web Application with Tailwind CSS v4 & React",
  channelName = "frameiq",
  views = "120K",
  likes = "14.2K",
  duration = "12:34",
  thumbnailUrl,
  gradient = "from-zinc-800/60 via-zinc-900/40 to-zinc-950/80",
  index = 0,
}: VideoCardProps) {
  const staggerClass = `stagger-${(index % 12) + 1}`

  return (
    <div
      className={`
        animate-fade-in-up ${staggerClass}
        relative aspect-[9/14] w-full overflow-hidden rounded-xl
        bg-zinc-900 group cursor-pointer select-none
        ring-1 ring-white/[0.06] hover:ring-white/[0.12]
        transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/40
      `}
    >
      {/* Thumbnail Image / Gradient Placeholder */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
      ) : (
        <div className={`h-full w-full bg-gradient-to-br ${gradient} transition-transform duration-500 group-hover:scale-110`}>
          {/* Subtle noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
          }} />
          {/* Centered play icon placeholder */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
              <Play className="h-5 w-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>
      )}

      {/* Duration badge — top right */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-medium text-white">
        <Clock className="h-2.5 w-2.5" />
        {duration}
      </div>

      {/* Bottom gradient overlay — always visible, intensified on hover */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-70 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Content overlay — slides up on hover */}
      <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col justify-end translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
        {/* Channel avatar + name */}
        <div className="flex items-center gap-2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-[8px] font-bold text-white uppercase ring-1 ring-white/20">
            {channelName?.charAt(0)}
          </div>
          <span className="text-[11px] font-medium text-zinc-300 truncate">
            @{channelName}
          </span>
        </div>

        {/* Title */}
        <p className="text-[12px] font-semibold leading-snug text-white line-clamp-2 drop-shadow-lg mb-2">
          {title}
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[10px] font-medium text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" /> {views}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" /> {likes}
          </span>
        </div>
      </div>
    </div>
  )
}

export function VideoCardSkeleton() {
  return (
    <div className="aspect-[9/14] w-full rounded-xl bg-muted/50 ring-1 ring-white/[0.04] animate-pulse" />
  )
}