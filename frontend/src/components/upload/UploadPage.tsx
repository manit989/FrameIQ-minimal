import { useState, useRef, useCallback } from "react"
import {
  Upload,
  FileVideo,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Clock,
  Eye,
  Tag,
  MapPin,
  Music,
  Brain,
  Film,
} from "lucide-react"
import {
  analyzeVideo,
  ApiError,
  getApiErrorTitle,
  normalizeApiError,
  type VideoAnalysisResponse,
  type SceneCaption,
} from "../../lib/api"

type UploadState = "idle" | "selected" | "uploading" | "analyzing" | "done" | "error"

interface UploadPageProps {
  onUploadComplete: () => void | Promise<void>
}

export function UploadPage({ onUploadComplete }: UploadPageProps) {
  const [state, setState] = useState<UploadState>("idle")
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<VideoAnalysisResponse | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    const extension = f.name.split(".").pop()?.toLowerCase()
    const supportedExtensions = ["mp4", "mov", "avi", "webm", "mkv", "m4v"]
    if (!f.type.startsWith("video/") && !supportedExtensions.includes(extension ?? "")) {
      setError(new ApiError({
        code: "UNSUPPORTED_VIDEO_TYPE",
        message: "Please select an MP4, MOV, AVI, WebM, MKV, or M4V video.",
        status: 415,
      }))
      setState("error")
      return
    }
    setFile(f)
    setTitle("")
    setError(null)
    setState("selected")
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const handleUpload = async () => {
    const normalizedTitle = title.trim()
    if (!file || !normalizedTitle) return

    setTitle(normalizedTitle)
    setError(null)
    setState("uploading")
    setProgress(0)

    try {
      const res = await analyzeVideo(file, normalizedTitle, (p) => {
        setProgress(p)
        if (p >= 100) setState("analyzing")
      })
      setResult(res)
      setState("done")
      void onUploadComplete()
    } catch (err) {
      setError(normalizeApiError(err, "Upload failed"))
      setState("selected")
    }
  }

  const handleReset = () => {
    setState("idle")
    setFile(null)
    setTitle("")
    setProgress(0)
    setResult(null)
    setError(null)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Upload & Analyze
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a video and let FrameIQ's AI extract scenes, objects, and semantic meaning.
        </p>
      </div>

      {/* Upload Zone */}
      {(state === "idle" || state === "error") && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-2xl border-2 border-dashed
            transition-all duration-300 p-12 sm:p-16 text-center
            ${dragOver
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/30"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />

          <div className={`
            mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-5
            transition-all duration-300
            ${dragOver
              ? "bg-primary/10 text-primary scale-110"
              : "bg-muted/60 text-muted-foreground"
            }
          `}>
            <Upload className="h-7 w-7" />
          </div>

          <p className="text-base font-medium text-foreground">
            {dragOver ? "Drop your video here" : "Drag & drop a video, or click to browse"}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            MP4, MOV, AVI, WebM — up to 500MB
          </p>

          {error && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error.message}
            </div>
          )}
        </div>
      )}

      {/* Selected File Preview */}
      {state === "selected" && file && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleUpload()
          }}
          className="rounded-2xl border border-border/60 bg-card p-6 animate-fade-in-up"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileVideo className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatSize(file.size)} • {file.type.split("/")[1]?.toUpperCase()}
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              aria-label="Remove selected video"
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5">
            <label htmlFor="video-title" className="block text-sm font-medium text-foreground mb-2">
              Video title
            </label>
            <input
              id="video-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your video"
              maxLength={200}
              required
              autoFocus
              className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-colors focus:border-primary"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              This title will be shown in your library and search results.
            </p>
          </div>

          {error && (
            <ApiErrorNotice error={error} />
          )}

          <button
            type="submit"
            disabled={!title.trim()}
            className="mt-5 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 transition-opacity"
          >
            <Sparkles className="h-4 w-4" />
            {error?.retryable ? "Try analysis again" : "Analyze with AI"}
          </button>
        </form>
      )}

      {/* Upload Progress / Analyzing */}
      {(state === "uploading" || state === "analyzing") && file && (
        <div className="rounded-2xl border border-border/60 bg-card p-6 animate-fade-in-up">
          <div className="flex items-center gap-4 mb-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {state === "uploading" ? (
                <Upload className="h-6 w-6" />
              ) : (
                <Sparkles className="h-6 w-6 animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {state === "uploading"
                  ? `Uploading… ${progress}%`
                  : "AI is analyzing your video — extracting scenes, objects & semantics…"
                }
              </p>
            </div>
            {state === "analyzing" && (
              <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`
                h-full rounded-full transition-all duration-500 ease-out
                ${state === "analyzing"
                  ? "bg-gradient-to-r from-primary via-primary/70 to-primary w-full animate-shimmer"
                  : "bg-primary"
                }
              `}
              style={state === "uploading" ? { width: `${progress}%` } : undefined}
            />
          </div>

          {state === "analyzing" && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              This may take a minute depending on video length…
            </p>
          )}
        </div>
      )}

      {/* Analysis Results */}
      {state === "done" && result && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Success banner */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex items-center gap-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                Analysis complete — {result.total_scenes} scene{result.total_scenes !== 1 && "s"} detected
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {result.title} • {result.original_filename} • Your video is now searchable via AI
              </p>
            </div>
            <button
              onClick={handleReset}
              className="shrink-0 px-4 py-2 rounded-lg bg-muted hover:bg-accent text-sm font-medium transition-colors"
            >
              Upload Another
            </button>
          </div>

          {/* Scene cards */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Detected Scenes</h2>
            {result.scenes.map((scene, idx) => (
              <SceneCard key={idx} scene={scene} index={idx} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ApiErrorNotice({ error }: { error: ApiError }) {
  return (
    <div role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{getApiErrorTitle(error)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
          <p className="mt-2 text-[11px] font-mono text-muted-foreground/70">
            {error.code}{error.requestId ? ` • Request ${error.requestId}` : ""}
          </p>
          {error.retryable && (
            <p className="mt-2 text-xs text-muted-foreground">
              This error may be temporary. You can retry without selecting the file again.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function SceneCard({ scene, index }: { scene: SceneCaption; index: number }) {
  const [expanded, setExpanded] = useState(false)

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${min}:${sec.toString().padStart(2, "0")}`
  }

  return (
    <div
      className={`
        rounded-xl border border-border/60 bg-card overflow-hidden
        transition-all duration-300 animate-fade-in-up stagger-${(index % 12) + 1}
      `}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        {/* Thumbnail or scene number */}
        {scene.snapshot_url ? (
          <img
            src={scene.snapshot_url}
            alt={`Scene ${index + 1}`}
            className="h-16 w-28 rounded-lg object-cover shrink-0 ring-1 ring-white/10"
          />
        ) : (
          <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
            <Film className="h-5 w-5" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
              Scene {index + 1}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(scene.start_time)} — {formatTime(scene.end_time)}
            </span>
          </div>
          <p className="text-sm text-foreground line-clamp-1">{scene.visual_description}</p>
        </div>

        <div className={`shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border/30 space-y-3 animate-fade-in-up">
          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <DetailItem icon={<Eye className="h-3.5 w-3.5" />} label="Activity" value={scene.activity_type} />
            <DetailItem icon={<MapPin className="h-3.5 w-3.5" />} label="Setting" value={scene.setting} />
            <DetailItem icon={<Music className="h-3.5 w-3.5" />} label="Audio / Mood" value={scene.audio_genre_and_mood} />
            <DetailItem icon={<Brain className="h-3.5 w-3.5" />} label="Intent" value={scene.semantic_intent} />
          </div>

          {/* Objects */}
          {scene.detected_objects.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Detected Objects</p>
              <div className="flex flex-wrap gap-1.5">
                {scene.detected_objects.map((obj, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-muted text-foreground/80">
                    {obj}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search tags */}
          {scene.search_tags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Tag className="h-3 w-3" /> Search Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {scene.search_tags.map((tag, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Visual cues */}
          {scene.visual_cues.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Visual Cues</p>
              <div className="flex flex-wrap gap-1.5">
                {scene.visual_cues.map((cue, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-accent/60 text-foreground/70">
                    {cue}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="shrink-0 mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-foreground/90 text-sm">{value}</p>
      </div>
    </div>
  )
}
