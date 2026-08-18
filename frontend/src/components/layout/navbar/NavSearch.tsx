import { Mic, Sparkles } from "lucide-react"

interface NavSearchProps {
  onToggleAiSearch: () => void
}

export function NavSearch({ onToggleAiSearch }: NavSearchProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 md:px-12 max-w-[720px]">
      <div className="flex w-full items-center h-10">
        
        {/* Input Area */}
        <div className="flex h-full flex-1 items-center rounded-l-full border border-r-0 border-border bg-input px-4 shadow-inner focus-within:border-primary">
          <input
            type="text"
            placeholder="Search"
            className="w-full bg-transparent text-sm md:text-base outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* AI Action Button */}
        <button
          type="button"
          onClick={onToggleAiSearch}
          aria-label="Expand AI Search Workspace"
          className="flex h-full w-16 shrink-0 items-center justify-center rounded-r-full border border-border bg-muted hover:bg-accent text-primary transition-colors group"
        >
          <Sparkles className="h-5 w-5 group-hover:scale-110 transition-transform" />
        </button>

      </div>

      {/* Voice Search Button */}
      <button
        type="button"
        aria-label="Search with voice"
        className="ml-3 md:ml-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors"
      >
        <Mic className="h-5 w-5 text-foreground" />
      </button>
    </div>
  )
}