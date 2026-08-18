import { Heart, Eye } from "lucide-react"

interface VideoCardProps {
  title?: string
  channelName?: string
  views?: string
  likes?: string
  thumbnailUrl?: string
}

export function VideoCard({
  title = "Building a Modern Web Application with Tailwind CSS v4 & React",
  channelName = "frameiq",
  views = "120K",
  likes = "14.2K",
  thumbnailUrl
}: VideoCardProps) {
  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden bg-zinc-900 group cursor-pointer select-none">
      {/* Thumbnail Image */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-zinc-800 to-zinc-950 transition-transform duration-300 group-hover:scale-105" />
      )}

      {/* Top Right Instagram Reel Icon */}
      <div className="absolute top-2.5 right-2.5 z-10 text-white drop-shadow-md">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h15a3 3 0 003-3v-9a3 3 0 00-3-3h-15zM3 9h18v7.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 16.5V9zm3-3h2.25l1.5 3H7.5L6 6zm6 0h2.25l1.5 3H13.5L12 6zm6 0h2.25a1.5 1.5 0 011.5 1.5V9h-2.25L18 6z" />
        </svg>
      </div>

      {/* Bottom Gradient + Overlay Details on Hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 text-white">
        <p className="text-xs font-semibold line-clamp-2 leading-snug mb-2 drop-shadow">
          {title}
        </p>
        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-200">
          <span className="truncate max-w-[100px]">@{channelName}</span>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 fill-white stroke-none" /> {likes}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> {views}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function VideoCardSkeleton() {
  return (
    <div className="aspect-[9/16] w-full bg-muted animate-pulse" />
  )
}