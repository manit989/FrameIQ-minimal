import { NavLeft } from "./NavLeft"
import { NavSearch } from "./NavSearch"
import { NavActions } from "./NavActions"

interface NavbarProps {
  onToggleSidebar: () => void
  onSearch: (query: string) => void
  onNavigateHome: () => void
}

export function Navbar({ onToggleSidebar, onSearch, onNavigateHome }: NavbarProps) {
  return (
    <header className="flex h-14 items-center justify-between px-4 gap-2">
      <NavLeft onToggleSidebar={onToggleSidebar} onNavigateHome={onNavigateHome} />
      <NavSearch onSearch={onSearch} />
      <NavActions />
    </header>
  )
}