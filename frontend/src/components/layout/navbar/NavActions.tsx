import { Plus, Bell } from "lucide-react"

export function NavActions() {
  return (
    <div className="flex items-center gap-3 pr-2">
      {/* Create Button */}
      <button className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
        <Plus className="h-5 w-5" />
        Create
      </button>

      {/* Notifications */}
      <button className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent transition-colors">
        <Bell className="h-6 w-6 text-foreground" />
        <span className="absolute right-1 top-1.5 flex h-4 items-center justify-center rounded-full border-2 border-background bg-red-600 px-1 text-[10px] font-bold text-white">
          9+
        </span>
      </button>

      {/* Profile Avatar */}
      <button className="ml-2 h-8 w-8 overflow-hidden rounded-full">
        <img
          src="https://github.com/shadcn.png" 
          alt="Profile"
          className="h-full w-full object-cover"
        />
      </button>
    </div>
  )
}