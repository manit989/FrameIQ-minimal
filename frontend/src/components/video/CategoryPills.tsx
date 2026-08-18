import { CATEGORIES } from "../../data/categories"

interface CategoryPillsProps {
  selectedCategory: string
  onSelectCategory: (category: string) => void
}

export function CategoryPills({ selectedCategory, onSelectCategory }: CategoryPillsProps) {
  return (
    <div className="sticky top-14 z-40 bg-background py-2 flex gap-3 overflow-x-auto no-scrollbar scrollbar-none">
      {CATEGORIES.map((category) => (
        <button
          key={category}
          onClick={() => onSelectCategory(category)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            selectedCategory === category
              ? "bg-foreground text-background"
              : "bg-muted hover:bg-accent text-foreground"
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  )
}