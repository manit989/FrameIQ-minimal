import { Menu } from "lucide-react"
import { Button } from "../../ui/button"

interface NavLeftProps {
  onToggleSidebar: () => void
  onNavigateHome: () => void
}

export function NavLeft({ onToggleSidebar, onNavigateHome }: NavLeftProps) {
  return (
    <div className="flex items-center gap-3 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="h-9 w-9 rounded-full hover:bg-accent text-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <button
        onClick={onNavigateHome}
        className="text-xl font-bold tracking-tight select-none hover:opacity-80 transition-opacity"
      >
        Shor<span className="text-red-500">TS</span>
      </button>
    </div>
  )
}