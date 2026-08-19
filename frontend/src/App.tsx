import { useState, useCallback } from "react"
import { Navbar } from "./components/layout/navbar/Navbar"
import { Sidebar } from "./components/layout/Sidebar"
import { CategoryPills } from "./components/video/CategoryPills"
import { VideoCard } from "./components/video/VideoCard"
import { UploadPage } from "./components/upload/UploadPage"
import { SearchResults } from "./components/search/SearchResults"
import { searchVideos, type SearchResultItem } from "./lib/api"

export type Page = "home" | "upload" | "search"

// Synthetic demo data for the home feed
const DEMO_VIDEOS = [
  { title: "Cinematic Mountain Sunrise — 4K Drone Footage", channelName: "frameiq", views: "1.2M", likes: "89K", duration: "12:34", gradient: "from-rose-900/60 via-amber-900/40 to-orange-950/80" },
  { title: "Urban Night Timelapse — Tokyo Neon Lights", channelName: "cityframes", views: "890K", likes: "62K", duration: "8:17", gradient: "from-indigo-900/60 via-violet-900/40 to-purple-950/80" },
  { title: "Deep Sea Exploration — Bioluminescence", channelName: "oceanlens", views: "540K", likes: "41K", duration: "15:02", gradient: "from-cyan-900/60 via-teal-900/40 to-emerald-950/80" },
  { title: "Formula 1 Onboard — Monaco Grand Prix", channelName: "speediq", views: "2.1M", likes: "156K", duration: "6:45", gradient: "from-red-900/60 via-orange-900/40 to-yellow-950/80" },
  { title: "Northern Lights Over Iceland — Real-Time Capture", channelName: "aurorahd", views: "3.4M", likes: "245K", duration: "20:11", gradient: "from-green-900/60 via-emerald-900/40 to-teal-950/80" },
  { title: "Wildlife Safari — Serengeti Migration", channelName: "naturevault", views: "1.8M", likes: "132K", duration: "18:30", gradient: "from-amber-900/60 via-yellow-900/40 to-lime-950/80" },
  { title: "Street Photography Masterclass — Golden Hour", channelName: "photoiq", views: "670K", likes: "48K", duration: "22:15", gradient: "from-orange-900/60 via-rose-900/40 to-pink-950/80" },
  { title: "Abstract Fluid Art — Macro Ink in Water", channelName: "artframes", views: "420K", likes: "35K", duration: "5:22", gradient: "from-fuchsia-900/60 via-pink-900/40 to-rose-950/80" },
  { title: "Architectural Marvels — Modern Skyscrapers", channelName: "buildiq", views: "310K", likes: "24K", duration: "14:08", gradient: "from-slate-800/60 via-zinc-800/40 to-neutral-900/80" },
  { title: "Space Documentary — Mars Rover Footage", channelName: "cosmosview", views: "5.6M", likes: "412K", duration: "32:45", gradient: "from-orange-950/60 via-red-950/40 to-rose-950/80" },
  { title: "Cooking Masterclass — Italian Pasta Making", channelName: "chefstudio", views: "980K", likes: "71K", duration: "16:22", gradient: "from-amber-800/60 via-orange-800/40 to-red-900/80" },
  { title: "Music Production Tutorial — Synthwave Beats", channelName: "beatlab", views: "750K", likes: "53K", duration: "28:10", gradient: "from-violet-900/60 via-purple-900/40 to-indigo-950/80" },
]

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentPage, setCurrentPage] = useState<Page>("home")

  // Search state — lifted here so NavSearch and main content can share it
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) return

    setSearchQuery(query)
    setSearchResults([])
    setSearchError(null)
    setSearchLoading(true)
    setCurrentPage("search")

    try {
      const res = await searchVideos(query)
      setSearchResults(res.results)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handleNavigate = useCallback((page: Page) => {
    setCurrentPage(page)
    // Clear search state when leaving search page
    if (page !== "search") {
      setSearchQuery("")
      setSearchResults([])
      setSearchError(null)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Sticky Navbar */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <Navbar
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onSearch={handleSearch}
          onNavigateHome={() => handleNavigate("home")}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — collapsible */}
        <Sidebar
          isOpen={sidebarOpen}
          currentPage={currentPage}
          onNavigate={handleNavigate}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          {currentPage === "home" && (
            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <CategoryPills
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 mt-4">
                {DEMO_VIDEOS.map((video, index) => (
                  <VideoCard
                    key={index}
                    title={video.title}
                    channelName={video.channelName}
                    views={video.views}
                    likes={video.likes}
                    duration={video.duration}
                    gradient={video.gradient}
                    index={index}
                  />
                ))}
              </div>
            </div>
          )}

          {currentPage === "upload" && <UploadPage />}

          {currentPage === "search" && (
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <SearchResults
                query={searchQuery}
                results={searchResults}
                isLoading={searchLoading}
                error={searchError}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}