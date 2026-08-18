import { Menu, Search, Mic, Plus, Bell } from "lucide-react"
import { Button } from "../ui/button"

export function Navbar() {
  return (
    <header className="flex h-14 items-center justify-between bg-background px-4 text-foreground border-b border-transparent">
      
      {/* Left Section: Menu & Logo */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-10 w-10 rounded-full hover:bg-accent text-foreground transition-colors"
        >
          <Menu className="h-6 w-6" />
        </Button>
        <div className="text-2xl font-bold tracking-tight">
          Frame<span className="text-red-600 dark:text-red-500">IQ</span>
        </div>
      </div>

      {/* Center Section: Search Bar & Mic */}
      <div className="flex flex-1 items-center justify-center px-12 max-w-[720px]">
        <div className="flex w-full items-center">
          {/* Input Area */}
          <div className="flex w-full items-center rounded-l-full border border-border bg-input px-4 py-0.5 shadow-inner">
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
          {/* Search Button */}
          <button className="flex h-[42px] w-16 items-center justify-center rounded-r-full border border-l-0 border-border bg-muted hover:bg-accent transition-colors">
            <Search className="h-5 w-5 text-foreground" />
          </button>
        </div>
        {/* Mic Button */}
        <button className="ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors">
          <Mic className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Right Section: Actions & Profile */}
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

    </header>
  )
}