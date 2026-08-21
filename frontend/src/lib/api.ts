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
  original_filename: string
  title: string
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

export type SearchMode = "title" | "semantic"

export interface TitleSearchResponse {
  query: string
  count: number
  results: VideoItem[]
}

export interface ApiErrorOptions {
  code: string
  message: string
  status?: number
  retryable?: boolean
  requestId?: string
  details?: unknown
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly retryable: boolean
  readonly requestId?: string
  readonly details?: unknown

  constructor(options: ApiErrorOptions) {
    super(options.message)
    this.name = "ApiError"
    this.code = options.code
    this.status = options.status ?? 0
    this.retryable = options.retryable ?? false
    this.requestId = options.requestId
    this.details = options.details
  }
}

export function normalizeApiError(error: unknown, fallbackMessage = "Request failed"): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof Error) {
    return new ApiError({
      code: "CLIENT_ERROR",
      message: error.message || fallbackMessage,
    })
  }
  return new ApiError({ code: "UNKNOWN_ERROR", message: fallbackMessage })
}

export function getApiErrorTitle(error: ApiError): string {
  if (error.code === "NETWORK_ERROR") return "Server unavailable"
  if (error.code.includes("TIMEOUT")) return "Request timed out"
  if (/^(GEMINI|GROQ|EMBEDDING)_/.test(error.code)) return "AI service error"
  if (/^(AUDIO|VIDEO|MEDIA|FFMPEG|SNAPSHOT)_/.test(error.code)) return "Video processing failed"
  if (error.code.startsWith("DATABASE_")) return "Database error"
  if (/^(FILE_STORAGE|STORAGE)_/.test(error.code)) return "Storage error"
  if (/^(INVALID_|UNSUPPORTED_|UPLOAD_|REQUEST_VALIDATION)/.test(error.code)) return "Check your request"
  if (error.status >= 500) return "Server error"
  return "Request failed"
}

// --- API Functions ---

const API_BASE = ""  // Uses Vite proxy, no base needed

/**
 * POST /api/analyze — Upload a video file for AI analysis
 */
export async function analyzeVideo(
  file: File,
  title: string,
  onProgress?: (percent: number) => void
): Promise<VideoAnalysisResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append("file", file)
    formData.append("title", title)

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
          reject(new ApiError({
            code: "INVALID_RESPONSE",
            message: "The server returned an invalid upload response.",
            status: xhr.status,
          }))
        }
      } else {
        reject(apiErrorFromText(
          xhr.status,
          xhr.responseText,
          xhr.getResponseHeader("X-Request-ID") ?? undefined,
        ))
      }
    })

    xhr.addEventListener("error", () => reject(new ApiError({
      code: "NETWORK_ERROR",
      message: "The server could not be reached. Check that the backend is running.",
      retryable: true,
    })))
    xhr.addEventListener("abort", () => reject(new ApiError({
      code: "UPLOAD_CANCELLED",
      message: "The upload was cancelled.",
      retryable: true,
    })))
    xhr.addEventListener("timeout", () => reject(new ApiError({
      code: "UPLOAD_TIMEOUT",
      message: "The upload request timed out.",
      status: 504,
      retryable: true,
    })))

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
  const res = await fetchFromApi(`${API_BASE}/search?${params}`)

  if (!res.ok) {
    throw await apiErrorFromResponse(res)
  }

  return parseSuccessResponse<SearchResponse>(res, "search")
}

/**
 * GET /api/videos/search — Case-insensitive title search across analyzed videos
 */
export async function searchVideosByTitle(
  query: string,
  limit: number = 10
): Promise<TitleSearchResponse> {
  const params = new URLSearchParams({ query, limit: String(limit) })
  const res = await fetchFromApi(`${API_BASE}/api/videos/search?${params}`)

  if (!res.ok) {
    throw await apiErrorFromResponse(res)
  }

  return parseSuccessResponse<TitleSearchResponse>(res, "title search")
}

// --- Home feed ---

export interface VideoItem {
  video_id: string
  video_filename: string
  original_filename: string
  title: string
  thumbnail_url: string
  scene_count: number
  duration: string
}

/**
 * GET /api/videos — List all analyzed videos
 */
export async function fetchVideos(): Promise<VideoItem[]> {
  const res = await fetchFromApi(`${API_BASE}/api/videos`)

  if (!res.ok) {
    throw await apiErrorFromResponse(res)
  }

  const data = await parseSuccessResponse<{ videos?: VideoItem[] }>(res, "video library")
  const videos: VideoItem[] = data.videos ?? []

  return videos.map((video) => ({
    ...video,
    original_filename: video.original_filename || video.title || video.video_filename,
  }))
}

async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("X-Request-ID") ?? undefined
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Non-JSON failures still receive a stable client-side error below.
  }
  return apiErrorFromBody(response.status, body, requestId)
}

async function fetchFromApi(url: string): Promise<Response> {
  try {
    return await fetch(url)
  } catch {
    throw new ApiError({
      code: "NETWORK_ERROR",
      message: "The server could not be reached. Check that the backend is running.",
      retryable: true,
    })
  }
}

function apiErrorFromText(status: number, text: string, requestId?: string): ApiError {
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    // Leave body null and use the HTTP fallback.
  }
  return apiErrorFromBody(status, body, requestId)
}

function apiErrorFromBody(status: number, body: unknown, requestId?: string): ApiError {
  if (isRecord(body) && isRecord(body.error)) {
    const error = body.error
    return new ApiError({
      code: readString(error.code) ?? `HTTP_${status}`,
      message: readString(error.message) ?? `Request failed (${status}).`,
      status,
      retryable: typeof error.retryable === "boolean"
        ? error.retryable
        : status === 429 || status >= 500,
      requestId: readString(error.request_id) ?? requestId,
      details: error.details,
    })
  }

  const legacyDetail = isRecord(body) ? legacyDetailMessage(body.detail) : undefined
  return new ApiError({
    code: `HTTP_${status}`,
    message: legacyDetail ?? `Request failed (${status}).`,
    status,
    retryable: status === 429 || status >= 500,
    requestId,
  })
}

async function parseSuccessResponse<T>(response: Response, resource: string): Promise<T> {
  try {
    return await response.json() as T
  } catch {
    throw new ApiError({
      code: "INVALID_RESPONSE",
      message: `The server returned an invalid ${resource} response.`,
      status: response.status,
    })
  }
}

function legacyDetailMessage(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => isRecord(item) ? readString(item.msg) : undefined)
      .filter((message): message is string => Boolean(message))
    return messages.length > 0 ? messages.join("; ") : undefined
  }
  if (isRecord(detail)) return readString(detail.message)
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}
