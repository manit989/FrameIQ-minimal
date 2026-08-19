import { Plus, Bell, Upload } from "lucide-react"
import { Button } from "../../ui/button"

export function NavActions() {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* Upload button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full hover:bg-accent text-foreground"
      >
        <Upload className="h-5 w-5" />
      </Button>

      {/* Notifications */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full hover:bg-accent text-foreground relative"
      >
        <Bell className="h-5 w-5" />
        <span className="absolute top-1 right-1.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
      </Button>

      {/* Profile Avatar */}
      <button className="ml-1 h-8 w-8 overflow-hidden rounded-full ring-2 ring-transparent hover:ring-primary/50 transition-all duration-200">
        <img
          src="https://github.com/shadcn.png"
          alt="Profile"
          className="h-full w-full object-cover"
        />
      </button>
    </div>
  )
}