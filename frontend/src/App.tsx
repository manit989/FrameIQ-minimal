import { useState } from "react"
import { Navbar } from "./components/layout/navbar/Navbar"
import { Sidebar } from "./components/layout/Sidebar"
import { CategoryPills } from "./components/video/CategoryPills"
import { VideoCard } from "./components/video/VideoCard"
import { AiSearchWorkspace } from "./components/search/AiSearchWorkspace"

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [isAiSearchOpen, setIsAiSearchOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Sticky Navbar */}
      <div className="sticky top-0 z-40 bg-background">
        <Navbar onToggleAiSearch={() => setIsAiSearchOpen((prev) => !prev)} />
      </div>

      <div className="flex flex-1">
        {/* Sidebar remains untouched */}
        <Sidebar />

        {/* Main Feed Container */}
        <main className="flex-1 px-4 md:px-6 py-2 overflow-x-hidden">
          
          {/* Expanded AI Search Workspace (Pushes content down cleanly) */}
          <AiSearchWorkspace
            isOpen={isAiSearchOpen}
            onClose={() => setIsAiSearchOpen(false)}
          />

          <CategoryPills
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-8 mt-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <VideoCard key={index} />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}