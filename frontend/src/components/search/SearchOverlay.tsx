import { ArrowLeft, Sparkles, Send } from "lucide-react"
import { useSearch } from "../../context/SearchContext"

export function SearchOverlay() {
  const { isOverlayOpen, closeOverlay } = useSearch()

  if (!isOverlayOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md transition-all duration-300">
      
      {/* Top-Left Back Button */}
      <button
        type="button"
        onClick={closeOverlay}
        className="absolute top-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-accent text-foreground transition-colors shadow-lg"
        aria-label="Back to feed"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      {/* Centered Interface Card */}
      <div className="w-full max-w-2xl mx-4 rounded-2xl border border-border bg-card/90 p-8 shadow-2xl backdrop-blur-lg flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Heading */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Hi..., let's search
          </h2>
        </div>

        {/* Interactive Input */}
        <div className="relative flex items-center">
          <input
            type="text"
            autoFocus
            placeholder="Ask AI or describe what video scene you're looking for..."
            className="w-full rounded-xl border border-border bg-input px-4 py-3.5 pr-12 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors text-base"
          />
          <button 
            type="button"
            className="absolute right-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {/* Action Prompt Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button className="flex flex-col items-start gap-1 p-4 rounded-xl border border-border bg-muted/40 hover:bg-muted text-left transition-colors">
            <span className="font-semibold text-sm text-foreground">
              🎬 Find specific video scenes
            </span>
            <span className="text-xs text-muted-foreground">
              "Find tutorials on React 19 layout animations"
            </span>
          </button>

          <button className="flex flex-col items-start gap-1 p-4 rounded-xl border border-border bg-muted/40 hover:bg-muted text-left transition-colors">
            <span className="font-semibold text-sm text-foreground">
              🧠 Smart Topic Explorer
            </span>
            <span className="text-xs text-muted-foreground">
              "Show top 5 machine learning concepts explained simply"
            </span>
          </button>
        </div>

      </div>

    </div>
  )
}