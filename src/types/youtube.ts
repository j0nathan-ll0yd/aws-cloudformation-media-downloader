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
  release_timestamp?: number
  is_live?: boolean
  live_status?: string
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
