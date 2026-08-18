import { NavLeft } from "./NavLeft"
import { NavSearch } from "./NavSearch"
import { NavActions } from "./NavActions"

interface NavbarProps {
  onToggleAiSearch: () => void
}

export function Navbar({ onToggleAiSearch }: NavbarProps) {
  return (
    <header className="flex h-14 items-center justify-between bg-background px-4 text-foreground border-b border-transparent">
      <NavLeft />
      <NavSearch onToggleAiSearch={onToggleAiSearch} />
      <NavActions />
    </header>
  )
}