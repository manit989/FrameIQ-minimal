import { useState } from "react"
import { Navbar } from "./components/layout/navbar/Navbar"
import { Sidebar } from "./components/layout/Sidebar"
import { CategoryPills } from "./components/video/CategoryPills"
import { VideoCard } from "./components/video/VideoCard"

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState("All")

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Sticky Navbar */}
      <div className="sticky top-0 z-40 bg-background">
        <Navbar />
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Feed Container */}
        <main className="flex-1 px-3 sm:px-6 py-2 overflow-x-hidden">
          {/* Category Filter Pills */}
          <CategoryPills
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {/* Instagram Reels Style Explore Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2 mt-3">
            {Array.from({ length: 12 }).map((_, index) => (
              <VideoCard key={index} />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}