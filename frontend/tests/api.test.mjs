import assert from "node:assert/strict"
import test from "node:test"

import {
  ApiError,
  searchVideos,
  searchVideosByTitle,
} from "../src/lib/api.ts"


function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  })
}


test("normal search calls the title endpoint with encoded parameters", async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  let requestedUrl
  globalThis.fetch = async (url) => {
    requestedUrl = String(url)
    return jsonResponse({
      query: "Summer Trip",
      count: 1,
      results: [{
        video_id: "video-1",
        video_filename: "video-1.mp4",
        original_filename: "upload.mp4",
        title: "Summer Trip",
        thumbnail_url: "/snapshots/video-1_0s.jpg",
        scene_count: 4,
        duration: "1:20",
      }],
    })
  }

  const response = await searchVideosByTitle("Summer Trip", 7)

  assert.equal(requestedUrl, "/api/videos/search?query=Summer+Trip&limit=7")
  assert.equal(response.results[0].title, "Summer Trip")
})


test("AI search continues to call the semantic vector endpoint", async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  let requestedUrl
  globalThis.fetch = async (url) => {
    requestedUrl = String(url)
    return jsonResponse({ query: "person cooking", count: 0, results: [] })
  }

  await searchVideos("person cooking", 3)

  assert.equal(requestedUrl, "/search?query=person+cooking&limit=3")
})


test("title search preserves the structured backend error contract", async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  globalThis.fetch = async () => jsonResponse({
    error: {
      code: "DATABASE_READ_FAILED",
      message: "The video database could not be read.",
      retryable: true,
      request_id: "request-123",
    },
  }, { status: 503 })

  await assert.rejects(
    searchVideosByTitle("trip"),
    (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.code, "DATABASE_READ_FAILED")
      assert.equal(error.status, 503)
      assert.equal(error.retryable, true)
      assert.equal(error.requestId, "request-123")
      return true
    },
  )
})


test("title search maps a fetch failure to a retryable network error", async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  globalThis.fetch = async () => {
    throw new TypeError("connection refused")
  }

  await assert.rejects(
    searchVideosByTitle("trip"),
    (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.code, "NETWORK_ERROR")
      assert.equal(error.retryable, true)
      return true
    },
  )
})
