import { NavLeft } from "./NavLeft"
import { NavSearch } from "./NavSearch"
import { NavActions } from "./NavActions"

export function Navbar() {
  return (
    <header className="flex h-14 items-center justify-between bg-background px-4 text-foreground border-b border-transparent">
      <NavLeft />
      <NavSearch />
      <NavActions />
    </header>
  )
}