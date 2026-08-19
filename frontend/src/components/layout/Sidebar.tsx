import {
  Home,
  Flame,
  Clapperboard,
  Search,
  Settings,
  Upload,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import type { Page } from "../../App"

interface SidebarProps {
  isOpen: boolean
  currentPage: Page
  onNavigate: (page: Page) => void
}

export function Sidebar({ isOpen, currentPage, onNavigate }: SidebarProps) {
  return (
    <aside
      className={`
        ${isOpen ? "w-56" : "w-[72px]"}
        hidden md:flex flex-col shrink-0
        border-r border-border/50 bg-background
        transition-all duration-300 ease-in-out
        overflow-y-auto overflow-x-hidden no-scrollbar
      `}
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      <nav className="flex flex-col gap-0.5 p-2 pt-3">
        <SidebarItem
          icon={<Home className="size-5" />}
          label="Home"
          isOpen={isOpen}
          active={currentPage === "home"}
          onClick={() => onNavigate("home")}
        />
        <SidebarItem icon={<Flame className="size-5" />} label="Trending" isOpen={isOpen} />
        <SidebarItem icon={<Clapperboard className="size-5" />} label="Shorts" isOpen={isOpen} />

        <div className="my-2 mx-3 border-t border-border/50" />

        <SidebarItem
          icon={<Upload className="size-5" />}
          label="Upload"
          isOpen={isOpen}
          active={currentPage === "upload"}
          onClick={() => onNavigate("upload")}
        />
        <SidebarItem icon={<TrendingUp className="size-5" />} label="Analytics" isOpen={isOpen} />

        <div className="my-2 mx-3 border-t border-border/50" />

        <SidebarItem
          icon={<Sparkles className="size-5" />}
          label="AI Search"
          isOpen={isOpen}
          active={currentPage === "search"}
          onClick={() => onNavigate("search")}
          badge
        />
        <SidebarItem icon={<Search className="size-5" />} label="Browse" isOpen={isOpen} />
        <SidebarItem icon={<Settings className="size-5" />} label="Settings" isOpen={isOpen} />
      </nav>

      {/* Bottom branding — only when expanded */}
      {isOpen && (
        <div className="mt-auto p-4 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            © 2026 FrameIQ<br />
            AI-powered video intelligence
          </p>
        </div>
      )}
    </aside>
  )
}

type SidebarItemProps = {
  icon: React.ReactNode
  label: string
  isOpen: boolean
  active?: boolean
  badge?: boolean
  onClick?: () => void
}

function SidebarItem({ icon, label, isOpen, active, badge, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-3.5 rounded-lg transition-all duration-200
        ${isOpen ? "px-3 py-2.5" : "flex-col justify-center px-0 py-3 gap-1"}
        ${active
          ? "bg-accent text-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        }
      `}
    >
      <span className="shrink-0 relative">
        {icon}
        {badge && (
          <span className="absolute -top-1 -right-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        )}
      </span>
      {isOpen ? (
        <span className="text-sm truncate">{label}</span>
      ) : (
        <span className="text-[10px] truncate max-w-full">{label}</span>
      )}
    </button>
  )
}