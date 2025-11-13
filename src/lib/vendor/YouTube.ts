import YTDlpWrap from 'yt-dlp-wrap'
import {logDebug, logError} from '../../util/lambda-helpers'
import {UnexpectedError} from '../../util/errors'
import {assertIsError} from '../../util/transformers'

const YTDLP_BINARY_PATH = process.env.YTDLP_BINARY_PATH || '/opt/bin/yt-dlp_linux'

// yt-dlp video info types
interface YtDlpVideoInfo {
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
}

interface YtDlpFormat {
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

/**
 * Fetch video information using yt-dlp
 * @param uri - YouTube video URL
 * @returns Video information including formats and metadata
 */
export async function fetchVideoInfo(uri: string): Promise<YtDlpVideoInfo> {
  logDebug('fetchVideoInfo =>', {uri, binaryPath: YTDLP_BINARY_PATH})

  try {
    const ytDlp = new YTDlpWrap(YTDLP_BINARY_PATH)

    // Configure yt-dlp with flags to work around restrictions
    // - player_client=default: Use alternate extraction method
    // - no-warnings: Suppress format selection warnings
    // Note: Node.js runtime detection handled via PATH environment variable
    const ytdlpFlags = [
      '--extractor-args', 'youtube:player_client=default',
      '--no-warnings'
    ]

    // Get video info in JSON format
    const info = await ytDlp.getVideoInfo([uri, ...ytdlpFlags]) as YtDlpVideoInfo

    logDebug('fetchVideoInfo <=', {
      id: info.id,
      title: info.title,
      formatCount: info.formats?.length || 0
    })

    return info
  } catch (error) {
    assertIsError(error)
    logError('fetchVideoInfo error', error)
    throw new UnexpectedError(`Failed to fetch video info: ${error.message}`)
  }
}

/**
 * Choose the best video format from available formats
 * @param info - Video information from yt-dlp
 * @returns Selected video format
 */
export function chooseVideoFormat(info: YtDlpVideoInfo): YtDlpFormat {
  if (!info.formats || info.formats.length === 0) {
    throw new UnexpectedError('No formats available for video')
  }

  // Filter for formats with both video and audio
  const combinedFormats = info.formats.filter(f =>
    f.vcodec && f.vcodec !== 'none' &&
    f.acodec && f.acodec !== 'none' &&
    f.url
  )

  if (combinedFormats.length === 0) {
    // Fallback to any format with a URL
    logDebug('No combined formats found, using first available format')
    return info.formats.find(f => f.url) || info.formats[0]
  }

  // Sort by filesize (best quality typically = largest file)
  // If filesize not available, sort by bitrate
  const sorted = combinedFormats.sort((a, b) => {
    if (a.filesize && b.filesize) {
      return b.filesize - a.filesize
    }
    if (a.tbr && b.tbr) {
      return b.tbr - a.tbr
    }
    return 0
  })

  logDebug('chooseVideoFormat =>', {
    formatId: sorted[0].format_id,
    filesize: sorted[0].filesize,
    ext: sorted[0].ext
  })

  return sorted[0]
}

/**
 * Extract video ID from YouTube URL
 * @param url - YouTube video URL
 * @returns Video ID
 */
export function getVideoID(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  throw new UnexpectedError('Invalid YouTube URL format')
}
