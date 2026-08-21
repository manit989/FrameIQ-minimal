import { useState, useCallback, useEffect, useRef } from "react"
import { Navbar } from "./components/layout/navbar/Navbar"
import { Sidebar } from "./components/layout/Sidebar"
import { CategoryPills } from "./components/video/CategoryPills"
import { VideoCard, VideoCardSkeleton } from "./components/video/VideoCard"
import { UploadPage } from "./components/upload/UploadPage"
import { SearchResults } from "./components/search/SearchResults"
import { TitleSearchResults } from "./components/search/TitleSearchResults"
import {
  searchVideos,
  searchVideosByTitle,
  fetchVideos,
  getApiErrorTitle,
  normalizeApiError,
  type ApiError,
  type SearchMode,
  type SearchResultItem,
  type VideoItem,
} from "./lib/api"
import { AlertCircle, Film, RefreshCw, Upload } from "lucide-react"

export type Page = "home" | "upload" | "search"

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentPage, setCurrentPage] = useState<Page>("home")

  // Home feed state
  const [homeVideos, setHomeVideos] = useState<VideoItem[]>([])
  const [homeLoading, setHomeLoading] = useState(true)
  const [homeError, setHomeError] = useState<ApiError | null>(null)

  // Search state — lifted here so NavSearch and main content can share it
  const [searchQuery, setSearchQuery] = useState("")
  const [searchMode, setSearchMode] = useState<SearchMode>("semantic")
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])
  const [titleSearchResults, setTitleSearchResults] = useState<VideoItem[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<ApiError | null>(null)
  const searchRequestId = useRef(0)

  // Fetch analyzed videos on mount and when navigating home
  const loadHomeVideos = useCallback(async () => {
    setHomeLoading(true)
    setHomeError(null)
    try {
      const videos = await fetchVideos()
      setHomeVideos(videos)
    } catch (error) {
      setHomeError(normalizeApiError(error, "Could not load the video library"))
    } finally {
      setHomeLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHomeVideos()
  }, [loadHomeVideos])

  const handleSearch = useCallback(async (query: string, mode: SearchMode) => {
    if (!query.trim()) return

    const requestId = ++searchRequestId.current
    setSearchQuery(query)
    setSearchMode(mode)
    setSearchResults([])
    setTitleSearchResults([])
    setSearchError(null)
    setSearchLoading(true)
    setCurrentPage("search")

    try {
      if (mode === "title") {
        const res = await searchVideosByTitle(query)
        if (requestId === searchRequestId.current) {
          setTitleSearchResults(res.results)
        }
      } else {
        const res = await searchVideos(query)
        if (requestId === searchRequestId.current) {
          setSearchResults(res.results)
        }
      }
    } catch (err) {
      if (requestId === searchRequestId.current) {
        setSearchError(normalizeApiError(
          err,
          mode === "title" ? "Title search failed" : "AI search failed",
        ))
      }
    } finally {
      if (requestId === searchRequestId.current) {
        setSearchLoading(false)
      }
    }
  }, [])

  const handleNavigate = useCallback((page: Page) => {
    setCurrentPage(page)
    // Refresh home feed when navigating back (picks up newly analyzed videos)
    if (page === "home") {
      loadHomeVideos()
    }
    // Clear search state when leaving search page
    if (page !== "search") {
      searchRequestId.current += 1
      setSearchQuery("")
      setSearchResults([])
      setTitleSearchResults([])
      setSearchError(null)
      setSearchLoading(false)
    }
  }, [loadHomeVideos])

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

              {/* Loading skeletons */}
              {homeLoading && (
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 mt-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <VideoCardSkeleton key={i} />
                  ))}
                </div>
              )}

              {!homeLoading && homeError && (
                <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-semibold text-foreground">
                        {getApiErrorTitle(homeError)}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">{homeError.message}</p>
                      <p className="mt-2 text-[11px] font-mono text-muted-foreground/70">
                        {homeError.code}{homeError.requestId ? ` • Request ${homeError.requestId}` : ""}
                      </p>
                    </div>
                    {homeError.retryable && (
                      <button
                        onClick={() => void loadHomeVideos()}
                        className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Real videos */}
              {!homeLoading && homeVideos.length > 0 && (
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 mt-4">
                  {homeVideos.map((video, index) => (
                    <VideoCard
                      key={video.video_id}
                      video={video}
                      index={index}
                    />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!homeLoading && !homeError && homeVideos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-5">
                    <Film className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">
                    No videos yet
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    Upload and analyze your first video to see it appear here.
                  </p>
                  <button
                    onClick={() => handleNavigate("upload")}
                    className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Video
                  </button>
                </div>
              )}
            </div>
          )}

          {currentPage === "upload" && (
            <UploadPage onUploadComplete={loadHomeVideos} />
          )}

          {currentPage === "search" && (
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {searchMode === "title" ? (
                <TitleSearchResults
                  query={searchQuery}
                  results={titleSearchResults}
                  isLoading={searchLoading}
                  error={searchError}
                  onRetry={() => void handleSearch(searchQuery, searchMode)}
                />
              ) : (
                <SearchResults
                  query={searchQuery}
                  results={searchResults}
                  isLoading={searchLoading}
                  error={searchError}
                  onRetry={() => void handleSearch(searchQuery, searchMode)}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
