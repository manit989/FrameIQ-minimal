import {
  Home,
  Flame,
  Clapperboard,
  Tv,
  MessageCircle,
  Settings,
} from "lucide-react"

export function Sidebar() {
  return (
    <aside className="w-60 border-r min-h-[calc(100vh-4rem)] p-4">

      <nav className="space-y-2">

        <SidebarItem icon={<Home />} label="Home" />
        <SidebarItem icon={<Flame />} label="Trending" />
        <SidebarItem icon={<Clapperboard />} label="Shorts" />

        <div className="my-4 border-t" />

        <SidebarItem icon={<Tv />} label="Subscriptions" />

        <div className="my-4 border-t" />

        <SidebarItem
          icon={<MessageCircle />}
          label="AI Search"
        />

        <SidebarItem
          icon={<Settings />}
          label="Settings"
        />

      </nav>

    </aside>
  )
}

type SidebarItemProps = {
  icon: React.ReactNode
  label: string
}

function SidebarItem({ icon, label }: SidebarItemProps) {
  return (
    <button className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-muted transition-colors text-left">
      {icon}
      <span>{label}</span>
    </button>
  )
}