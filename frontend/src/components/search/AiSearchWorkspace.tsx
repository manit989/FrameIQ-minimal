import { useState, useEffect } from "react"
import { Sparkles, ArrowUpRight, X, Bot } from "lucide-react"
import { PerimeterLoader } from "./PerimeterLoader"

interface AiSearchWorkspaceProps {
  isOpen: boolean
  onClose: () => void
}

export function AiSearchWorkspace({ isOpen, onClose }: AiSearchWorkspaceProps) {
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setAnimating(true)
      const timer = setTimeout(() => setAnimating(false), 1800)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="w-full transition-all duration-500 ease-in-out my-4">
      <div className="relative w-full rounded-2xl border border-border bg-card p-6 shadow-md transition-all duration-500">
        
        {/* Perimeter Loading Animation (Fires Once on Mount) */}
        {animating && <PerimeterLoader />}

        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <span className="font-semibold text-foreground text-sm md:text-base">
              FrameIQ AI Search & Workspace
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close AI Search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* AI Prompt Input Container */}
        <div className="flex flex-col gap-4">
          <div className="relative flex items-center">
            <input
              type="text"
              autoFocus
              placeholder="Ask AI anything or describe a video scene to search..."
              className="w-full rounded-xl border border-border bg-input px-4 py-3.5 pr-12 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary text-base transition-colors"
            />
            <button
              type="button"
              className="absolute right-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted text-left transition-colors group">
              <span className="text-xs md:text-sm font-medium text-foreground">
                🔍 Find specific code explanation scenes
              </span>
              <Sparkles className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            <button className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted text-left transition-colors group">
              <span className="text-xs md:text-sm font-medium text-foreground">
                🧠 Summarize latest AI video trends
              </span>
              <Sparkles className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}