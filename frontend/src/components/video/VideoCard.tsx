interface VideoCardProps {
  title?: string
  channelName?: string
  views?: string
  timestamp?: string
  duration?: string
  avatarUrl?: string
}

export function VideoCard({
  title = "Building a Modern Web Application with Tailwind CSS v4 & React",
  channelName = "FrameIQ Channel",
  views = "120K views",
  timestamp = "2 days ago",
  duration = "12:34",
  avatarUrl = "https://github.com/shadcn.png"
}: VideoCardProps) {
  return (
    <div className="flex flex-col gap-3 cursor-pointer group">
      {/* Thumbnail */}
      <div className="aspect-video w-full rounded-xl bg-muted overflow-hidden relative transition-all duration-200">
        <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
          {duration}
        </div>
      </div>

      {/* Video Details */}
      <div className="flex gap-3 px-0.5">
        <img
          src={avatarUrl}
          alt={channelName}
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
        <div className="flex flex-col gap-1 pr-2">
          <h3 className="font-semibold text-sm line-clamp-2 leading-snug text-foreground">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {channelName}
          </p>
          <p className="text-xs text-muted-foreground">
            {views} • {timestamp}
          </p>
        </div>
      </div>
    </div>
  )
}