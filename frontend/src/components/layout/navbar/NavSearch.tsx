import { useState, useRef, useEffect, type FormEvent } from "react"
import { Search, Mic, Sparkles, X, ArrowUp, Loader2 } from "lucide-react"
import { PerimeterLoader } from "../../search/PerimeterLoader"
import type { SearchMode } from "../../../lib/api"

interface NavSearchProps {
  onSearch: (query: string, mode: SearchMode) => void
}

export function NavSearch({ onSearch }: NavSearchProps) {
  const [isAiMode, setIsAiMode] = useState(false)
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [animating, setAnimating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const standardInputRef = useRef<HTMLInputElement>(null)

  // Trigger perimeter loading animation on mode transform
  useEffect(() => {
    if (isAiMode) {
      inputRef.current?.focus()
      const timer = setTimeout(() => setAnimating(false), 2200)
      return () => clearTimeout(timer)
    }
  }, [isAiMode])

  const handleOpenAi = () => {
    setAnimating(true)
    setIsAiMode(true)
  }

  const handleCloseAi = () => {
    setIsAiMode(false)
    setQuery("")
    setIsSearching(false)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const searchQuery = isAiMode ? query : (standardInputRef.current?.value || "")
    if (!searchQuery.trim() || isSearching) return

    setIsSearching(true)
    onSearch(searchQuery.trim(), "semantic")

    // Reset searching state after a brief delay (actual loading is handled by parent)
    setTimeout(() => {
      setIsSearching(false)
    }, 500)
  }

  const handleStandardSubmit = (e: FormEvent) => {
    e.preventDefault()
    const searchQuery = standardInputRef.current?.value || ""
    if (!searchQuery.trim()) return
    onSearch(searchQuery.trim(), "title")
  }

  return (
    <div className="flex flex-1 items-center justify-center px-2 md:px-8 max-w-[800px]">

      {!isAiMode ? (
        /* Standard Search Bar */
        <form onSubmit={handleStandardSubmit} className="flex w-full items-center h-10 transition-all duration-300">
          <div className="flex h-full flex-1 items-center rounded-l-full border border-r-0 border-border bg-input px-4 shadow-inner focus-within:border-primary">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <input
              ref={standardInputRef}
              type="text"
              placeholder="Search video titles…"
              className="w-full bg-transparent text-sm md:text-base outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Submit button for standard search */}
          <button
            type="submit"
            aria-label="Search"
            className="flex h-full w-14 shrink-0 items-center justify-center border-y border-border bg-muted hover:bg-accent transition-colors"
          >
            <Search className="h-4 w-4 text-foreground" />
          </button>

          {/* Sparkle Transform Trigger Button */}
          <button
            type="button"
            onClick={handleOpenAi}
            aria-label="Open AI Search"
            className="flex h-full w-14 shrink-0 items-center justify-center rounded-r-full border border-border bg-muted hover:bg-accent text-primary transition-colors group"
          >
            <Sparkles className="h-4 w-4 group-hover:scale-110 transition-transform" />
          </button>

          {/* Voice Search */}
          <button
            type="button"
            aria-label="Search with voice"
            className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"
          >
            <Mic className="h-5 w-5 text-foreground" />
          </button>
        </form>
      ) : (
        /* Transformed AI Search Bar */
        <form
          onSubmit={handleSubmit}
          className="relative flex w-full items-center min-h-[52px] rounded-2xl border border-white/10 bg-card/90 shadow-2xl backdrop-blur-xl px-4 py-2 transition-all duration-300 animate-in fade-in zoom-in-95"
        >
          {/* Perimeter Loader */}
          {animating && <PerimeterLoader />}

          {/* Sparkle Brand Badge */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500 mr-3">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>

          {/* AI Input Area */}
          <div className="flex flex-col flex-1 min-w-0 pr-2">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80">
              FrameIQ AI • Semantic Search
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe a scene — 'person cooking pasta in a modern kitchen'…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-20 transition-all mr-1.5"
          >
            {isSearching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Close (X) Button to Revert back to Normal Search */}
          <button
            type="button"
            onClick={handleCloseAi}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close AI Search"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      )}

    </div>
  )
}
