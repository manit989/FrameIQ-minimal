import { Menu } from "lucide-react"
import { Button } from "../../ui/button"

export function NavLeft() {
  return (
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
  )
}