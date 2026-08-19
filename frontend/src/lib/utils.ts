import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Clean raw scene text from the DB embedding format.
 * Input:  "[SCENE] A close-up shot of creamy spaghetti... | Activity: cooking tutorial | Setting: home kitchen | ..."
 * Output: "A close-up shot of creamy spaghetti..."
 *
 * Extracts just the visual description (first segment before the first pipe).
 */
export function cleanSceneText(raw: string): string {
  if (!raw) return ""

  // Remove [SCENE] or [AUDIO] prefix
  let cleaned = raw.replace(/^\[(SCENE|AUDIO)\]\s*/i, "")

  // Take only the first segment (the visual/audio description before " | ")
  const pipeIndex = cleaned.indexOf(" | ")
  if (pipeIndex > 0) {
    cleaned = cleaned.substring(0, pipeIndex)
  }

  return cleaned.trim()
}
