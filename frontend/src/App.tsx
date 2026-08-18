import { Navbar } from "./components/layout/Navbar"
import { Sidebar } from "./components/layout/Sidebar"

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      <Navbar />

      <div className="flex">

        <Sidebar />

        <main className="flex-1 p-6">

          <h1 className="text-2xl font-bold mb-6">
            Home
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            <div className="aspect-video rounded-xl bg-muted" />
            <div className="aspect-video rounded-xl bg-muted" />
            <div className="aspect-video rounded-xl bg-muted" />

            <div className="aspect-video rounded-xl bg-muted" />
            <div className="aspect-video rounded-xl bg-muted" />
            <div className="aspect-video rounded-xl bg-muted" />

          </div>

        </main>

      </div>

    </div>
  )
}

export default App