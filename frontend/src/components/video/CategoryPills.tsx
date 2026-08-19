import { useRef, useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CATEGORIES } from "../../data/categories"

interface CategoryPillsProps {
  selectedCategory: string
  onSelectCategory: (category: string) => void
}

export function CategoryPills({ selectedCategory, onSelectCategory }: CategoryPillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(true)

  const updateArrows = () => {
    const el = scrollRef.current
    if (!el) return
    setShowLeft(el.scrollLeft > 8)
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }

  useEffect(() => {
    updateArrows()
    const el = scrollRef.current
    el?.addEventListener("scroll", updateArrows, { passive: true })
    window.addEventListener("resize", updateArrows)
    return () => {
      el?.removeEventListener("scroll", updateArrows)
      window.removeEventListener("resize", updateArrows)
    }
  }, [])

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" })
  }

  return (
    <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md py-2.5 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="relative">
        {/* Left fade + arrow */}
        {showLeft && (
          <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center">
            <div className="absolute left-0 w-20 h-full bg-gradient-to-r from-background/95 to-transparent pointer-events-none" />
            <button
              onClick={() => scroll("left")}
              className="relative z-20 flex h-8 w-8 items-center justify-center rounded-full bg-accent/90 hover:bg-accent text-foreground shadow-md transition-all duration-200 hover:scale-105"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Pills row */}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth px-1"
        >
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className={`
                px-4 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap
                transition-all duration-200 shrink-0 select-none
                ${selectedCategory === category
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted/80 hover:bg-accent text-foreground/80 hover:text-foreground"
                }
              `}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Right fade + arrow */}
        {showRight && (
          <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center">
            <div className="absolute right-0 w-20 h-full bg-gradient-to-l from-background/95 to-transparent pointer-events-none" />
            <button
              onClick={() => scroll("right")}
              className="relative z-20 ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-accent/90 hover:bg-accent text-foreground shadow-md transition-all duration-200 hover:scale-105"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}