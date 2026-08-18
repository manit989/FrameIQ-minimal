import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react"
import { Sparkles, ArrowUp, X, Sparkle, Film, Code2, PlayCircle, Loader2 } from "lucide-react"
import { PerimeterLoader } from "./PerimeterLoader"

interface AiSearchWorkspaceProps {
  isOpen: boolean
  onClose: () => void
}

const QUICK_PROMPTS = [
  { icon: Film, label: "Find timestamp for code explanation", prompt: "Find the exact timestamp where the author explains React 19 server actions." },
  { icon: Code2, label: "Extract code snippet from video", prompt: "Extract the Tailwind CSS grid code shown on screen." },
  { icon: Sparkle, label: "Summarize main takeaways", prompt: "Give me a 3-bullet summary of the key concepts in this video feed." }
]

export function AiSearchWorkspace({ isOpen, onClose }: AiSearchWorkspaceProps) {
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [animating, setAnimating] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Trigger perimeter loading animation on mount
  useEffect(() => {
    if (isOpen) {
      setAnimating(true)
      const timer = setTimeout(() => setAnimating(false), 2200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Focus input on open
  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  const handleSearch = (textToSearch: string) => {
    if (!textToSearch.trim() || isSearching) return
    setIsSearching(true)
    setResult(null)

    // Simulate AI scene search / reasoning latency
    setTimeout(() => {
      setIsSearching(false)
      setResult(`Found 3 video scenes matching "${textToSearch}":`)
    }, 1800)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSearch(query)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSearch(query)
    }
  }

  const handleQuickPrompt = (promptText: string) => {
    setQuery(promptText)
    handleSearch(promptText)
  }

  return (
    <section className="relative w-full rounded-2xl border border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl p-5 my-3 transition-all duration-300">
      
      {/* Perimeter Loading Animation */}
      {animating && <PerimeterLoader />}

      {/* Header Bar */}
      <header className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/10 text-red-500">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            FrameIQ Scene Engine
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close AI Search"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Main GPT Input Form */}
      <form onSubmit={handleSubmit} className="relative flex flex-col gap-3">
        <div className="relative flex items-end rounded-xl border border-white/10 bg-input/40 focus-within:border-white/20 transition-all p-2">
          <textarea
            ref={inputRef}
            rows={2}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI or describe a video scene (e.g. 'Show me where the speaker writes the backend API')..."
            className="w-full resize-none bg-transparent px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
          />

          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-20 transition-all"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Quick Suggestion Pills */}
        {!result && !isSearching && (
          <div className="flex flex-wrap gap-2 pt-1">
            {QUICK_PROMPTS.map((item, idx) => {
              const Icon = item.icon
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickPrompt(item.prompt)}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-all"
                >
                  <Icon className="h-3.5 w-3.5 text-red-400" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </form>

      {/* Search Result Output View */}
      {result && (
        <article className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-3 animate-in fade-in duration-300">
          <p className="text-xs font-medium text-muted-foreground">{result}</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[1, 2, 3].map((id) => (
              <div key={id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/15 cursor-pointer transition-colors group">
                <PlayCircle className="h-5 w-5 text-red-500 shrink-0 group-hover:scale-110 transition-transform" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate">Scene Match #{id}</span>
                  <span className="text-[10px] text-muted-foreground">Timestamp 04:12 - 05:40</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

    </section>
  )
}