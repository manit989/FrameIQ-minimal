import { Plus, Bell } from "lucide-react"

export function NavActions() {
  return (
    <div className="flex items-center gap-3 pr-2">
      

      

      {/* Profile Avatar */}
      <button className="ml-2 h-8 w-8 overflow-hidden rounded-full">
        <img
          src="https://github.com/shadcn.png" 
          alt="Profile"
          className="h-full w-full object-cover"
        />
      </button>
    </div>
  )
}