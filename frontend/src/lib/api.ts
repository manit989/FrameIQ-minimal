// API types matching the backend Pydantic models

export interface SceneCaption {
  start_time: number
  end_time: number
  visual_description: string
  detected_objects: string[]
  recognized_figures: string[]
  activity_type: string
  setting: string
  visual_cues: string[]
  audio_genre_and_mood: string
  semantic_intent: string
  search_tags: string[]
  snapshot_url: string | null
}

export interface VideoAnalysisResponse {
  video_filename: string
  total_scenes: number
  scenes: SceneCaption[]
}

export interface SearchResultItem {
  video_id: string
  video_filename?: string
  title: string
  start_time: number
  end_time: number
  text: string
  thumbnail_url: string
  similarity_score: number
}

export interface SearchResponse {
  query: string
  count: number
  results: SearchResultItem[]
}

// --- API Functions ---

const API_BASE = ""  // Uses Vite proxy, no base needed

/**
 * POST /api/analyze — Upload a video file for AI analysis
 */
export async function analyzeVideo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<VideoAnalysisResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append("file", file)

    xhr.open("POST", `${API_BASE}/api/analyze`)

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error("Failed to parse response"))
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText)
          reject(new Error(err.detail || `Upload failed (${xhr.status})`))
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }
    })

    xhr.addEventListener("error", () => reject(new Error("Network error")))
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")))

    xhr.send(formData)
  })
}

/**
 * GET /search — Semantic search across analyzed videos
 */
export async function searchVideos(
  query: string,
  limit: number = 10
): Promise<SearchResponse> {
  const params = new URLSearchParams({ query, limit: String(limit) })
  const res = await fetch(`${API_BASE}/search?${params}`)

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Search failed (${res.status})`)
  }

  return res.json()
}

// --- Home feed ---

export interface VideoItem {
  video_id: string
  video_filename: string
  title: string
  thumbnail_url: string
  scene_count: number
  duration: string
}

/**
 * GET /api/videos — List all analyzed videos
 */
export async function fetchVideos(): Promise<VideoItem[]> {
  const res = await fetch(`${API_BASE}/api/videos`)

  if (!res.ok) {
    throw new Error(`Failed to fetch videos (${res.status})`)
  }

  const data = await res.json()
  return data.videos ?? []
}