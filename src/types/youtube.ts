/**
 * yt-dlp video information types
 */

export interface YtDlpVideoInfo {
  id: string
  title: string
  formats: YtDlpFormat[]
  thumbnail: string
  duration: number
  description?: string
  uploader?: string
  upload_date?: string
  view_count?: number
  filesize?: number
  /** Unix timestamp when video becomes available (for scheduled content) */
  release_timestamp?: number
  /** Whether this is a livestream */
  is_live?: boolean
  /** Current live status */
  live_status?: 'is_live' | 'is_upcoming' | 'was_live' | 'not_live'
  /** Video availability status */
  availability?: 'public' | 'unlisted' | 'private' | 'needs_auth' | 'subscriber_only'
}

export interface YtDlpFormat {
  format_id: string
  url: string
  ext: string
  filesize?: number
  width?: number
  height?: number
  fps?: number
  vcodec?: string
  acodec?: string
  abr?: number
  vbr?: number
  tbr?: number
}
