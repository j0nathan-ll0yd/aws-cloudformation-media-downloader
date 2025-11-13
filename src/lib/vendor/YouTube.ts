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

    // Copy cookies from read-only /opt to writable /tmp
    // yt-dlp needs write access to update cookies after use
    const fs = await import('fs')
    const cookiesSource = '/opt/cookies/youtube-cookies.txt'
    const cookiesDest = '/tmp/youtube-cookies.txt'
    await fs.promises.copyFile(cookiesSource, cookiesDest)

    // Configure yt-dlp with flags to work around restrictions
    // - player_client=default: Use alternate extraction method
    // - no-warnings: Suppress format selection warnings
    // - cookies: Use authentication cookies from /tmp (writable)
    // Note: Node.js runtime detection handled via PATH environment variable
    const ytdlpFlags = [
      '--extractor-args', 'youtube:player_client=default',
      '--no-warnings',
      '--cookies', cookiesDest
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

  // Filter for formats with both video and audio AND a known filesize
  // Exclude HLS/DASH streaming formats (they have manifests, not direct files)
  const directDownloadFormats = info.formats.filter(f =>
    f.vcodec && f.vcodec !== 'none' &&
    f.acodec && f.acodec !== 'none' &&
    f.url &&
    f.filesize && f.filesize > 0 &&  // Must have known filesize
    !f.url.includes('manifest') &&    // Exclude HLS/DASH manifests
    !f.url.includes('.m3u8')          // Exclude m3u8 playlists
  )

  if (directDownloadFormats.length === 0) {
    logDebug('No direct download formats found, trying combined formats')
    // Fallback to combined formats even without filesize
    const combinedFormats = info.formats.filter(f =>
      f.vcodec && f.vcodec !== 'none' &&
      f.acodec && f.acodec !== 'none' &&
      f.url &&
      !f.url.includes('manifest') &&
      !f.url.includes('.m3u8')
    )

    if (combinedFormats.length === 0) {
      throw new UnexpectedError('No suitable download formats available - all formats are streaming manifests')
    }

    // Sort by bitrate as filesize may not be available
    const sorted = combinedFormats.sort((a, b) => {
      if (a.tbr && b.tbr) return b.tbr - a.tbr
      return 0
    })

    logDebug('chooseVideoFormat (no filesize) =>', {
      formatId: sorted[0].format_id,
      tbr: sorted[0].tbr,
      ext: sorted[0].ext
    })

    return sorted[0]
  }

  // Sort by filesize (best quality = largest file)
  const sorted = directDownloadFormats.sort((a, b) => {
    return (b.filesize || 0) - (a.filesize || 0)
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
