import { createContext, useContext, useState, type ReactNode } from "react"

interface SearchContextType {
  isOverlayOpen: boolean
  openOverlay: () => void
  closeOverlay: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)

  return (
    <SearchContext.Provider
      value={{
        isOverlayOpen,
        openOverlay: () => setIsOverlayOpen(true),
        closeOverlay: () => setIsOverlayOpen(false)
      }}
    >
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (!context) {
    throw new Error("useSearch must be used within a SearchProvider")
  }
  return context
}