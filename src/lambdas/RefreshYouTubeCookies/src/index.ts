/**
 * RefreshYouTubeCookies Lambda
 *
 * Refreshes existing YouTube session cookies without performing login.
 * Login is handled by the GitHub Action which has persistent browser state.
 * This Lambda only refreshes existing valid sessions to keep them active.
 *
 * Flow:
 * 1. Read existing cookies from Secrets Manager (set by GitHub Action)
 * 2. Load cookies into browser and navigate to YouTube
 * 3. Visit pages to refresh the session
 * 4. Extract updated cookies and save back to Secrets Manager
 *
 * If no valid session exists, the Lambda reports this and exits.
 * The GitHub Action should be triggered to perform a fresh login.
 *
 * Trigger: CloudWatch Schedule (disabled until working)
 * Input: ScheduledEvent
 * Output: RefreshCookiesResult with cookie count and extraction timestamp
 */
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import chromium from '@sparticuz/chromium'
import {getSecretValue, putSecretValue} from '#lib/vendor/AWS/SecretsManager'
import {getRequiredEnv} from '#lib/system/env'
import {withPowertools} from '#lib/lambda/middleware/powertools'
import {wrapScheduledHandler} from '#lib/lambda/middleware/internal'
import {logDebug, logError, logInfo} from '#lib/system/logging'
import type {RefreshCookiesResult} from '#types/youtube'

// Enable stealth plugin to evade bot detection
puppeteer.use(StealthPlugin())

interface StoredCookieData {
  cookies: string
  extractedAt: string
  cookieCount: number
  browserUsed: string
  userAgent: string
  isAuthenticated: boolean
}

interface PuppeteerCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
}

// Updated user agent matching latest Chrome
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// Authentication indicator cookies - presence of these indicates logged-in state
const AUTH_COOKIE_NAMES = ['SID', 'SSID', 'HSID', 'APISID', 'SAPISID', 'LOGIN_INFO']

// Anti-detection Chrome args
const STEALTH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-site-isolation-trials',
  '--disable-features=BlockInsecurePrivateNetworkRequests'
]

/**
 * Parse Netscape cookie format into Puppeteer cookie objects
 */
function parseNetscapeCookies(netscapeCookies: string): PuppeteerCookie[] {
  const cookies: PuppeteerCookie[] = []
  const lines = netscapeCookies.split('\n')

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || line.trim() === '') {
      continue
    }

    const parts = line.split('\t')
    if (parts.length >= 7) {
      const [domain, , path, secure, expires, name, value] = parts
      cookies.push({
        name,
        value,
        domain: domain.startsWith('.') ? domain : `.${domain}`,
        path,
        expires: parseInt(expires, 10),
        secure: secure === 'TRUE',
        httpOnly: true
      })
    }
  }

  return cookies
}

/**
 * Convert Puppeteer cookies to Netscape format for yt-dlp compatibility
 */
function convertToNetscapeFormat(cookies: PuppeteerCookie[]): string {
  const lines = ['# Netscape HTTP Cookie File', '# Refreshed by RefreshYouTubeCookies Lambda', '']
  for (const cookie of cookies) {
    const domain = cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`
    const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE'
    const secure = cookie.secure ? 'TRUE' : 'FALSE'
    const expiry = cookie.expires > 0 ? Math.floor(cookie.expires) : '0'
    lines.push(`${domain}\t${includeSubdomains}\t${cookie.path}\t${secure}\t${expiry}\t${cookie.name}\t${cookie.value}`)
  }
  return lines.join('\n')
}

/**
 * Check if cookies indicate an authenticated session
 */
function isAuthenticatedSession(cookies: PuppeteerCookie[]): boolean {
  const cookieNames = cookies.map((c) => c.name)
  const authCookiesFound = AUTH_COOKIE_NAMES.filter((name) => cookieNames.includes(name))
  logInfo('Auth cookies check', {found: authCookiesFound.length, required: 3})
  return authCookiesFound.length >= 3
}

/**
 * Check if already logged into YouTube by looking for avatar button
 */
async function checkExistingLogin(page: import('puppeteer-core').Page): Promise<boolean> {
  try {
    const avatarButton = await page.$('button#avatar-btn')
    if (avatarButton) {
      const isVisible = await avatarButton.boundingBox()
      return isVisible !== null
    }
    return false
  } catch {
    return false
  }
}

/**
 * Refresh YouTube session using existing cookies.
 * Does NOT perform login - that's handled by GitHub Action.
 *
 * {@label REFRESH_YOUTUBE_COOKIES_HANDLER}
 * @returns RefreshCookiesResult with extraction details
 */
export const handler = withPowertools(wrapScheduledHandler(async (): Promise<RefreshCookiesResult> => {
  const result: RefreshCookiesResult = {
    success: false,
    cookieCount: 0,
    extractedAt: new Date().toISOString(),
    errors: [],
    isAuthenticated: false,
    browserUsed: 'chromium-stealth',
    sessionRefreshed: false,
    requiresLogin: false
  }

  const secretId = getRequiredEnv('YOUTUBE_COOKIES_SECRET_ID')

  let browser: import('puppeteer-core').Browser | null = null

  try {
    // Step 1: Read existing cookies from Secrets Manager
    logInfo('Reading existing cookies from Secrets Manager')
    let existingCookies: PuppeteerCookie[] = []

    try {
      const secretResponse = await getSecretValue({SecretId: secretId})
      if (secretResponse.SecretString) {
        const storedData: StoredCookieData = JSON.parse(secretResponse.SecretString)
        logInfo('Found existing cookies', {cookieCount: storedData.cookieCount, extractedAt: storedData.extractedAt, browserUsed: storedData.browserUsed})
        existingCookies = parseNetscapeCookies(storedData.cookies)
      }
    } catch (secretError) {
      logInfo('No existing cookies found in Secrets Manager', {error: secretError instanceof Error ? secretError.message : String(secretError)})
    }

    // Check if we have valid auth cookies
    if (existingCookies.length === 0 || !isAuthenticatedSession(existingCookies)) {
      logInfo('No valid authenticated session found - login required via GitHub Action')
      result.requiresLogin = true
      result.errors.push('No valid session cookies. Run GitHub Action to login.')
      return result
    }

    // Step 2: Launch browser with stealth
    logInfo('Launching Chromium browser with stealth plugin')
    chromium.setHeadlessMode = 'shell'
    chromium.setGraphicsMode = false

    const executablePath = await chromium.executablePath()
    const args = [...chromium.args, ...STEALTH_ARGS]

    browser = await puppeteer.launch({args, defaultViewport: {width: 1920, height: 1080}, executablePath, headless: true})

    if (!browser) {
      throw new Error('Failed to launch browser')
    }

    const page = await browser.newPage()

    // Set user agent and locale
    await page.setUserAgent(USER_AGENT)
    await page.setViewport({width: 1920, height: 1080})
    await page.setExtraHTTPHeaders({'Accept-Language': 'en-US,en;q=0.9'})
    await page.emulateTimezone('America/Los_Angeles')

    // Step 3: Load existing cookies into browser
    logInfo('Loading existing cookies into browser', {count: existingCookies.length})
    await page.setCookie(...existingCookies)

    // Step 4: Navigate to YouTube to refresh session
    logInfo('Navigating to YouTube to refresh session')
    await page.goto('https://www.youtube.com', {waitUntil: 'networkidle0', timeout: 60000})

    // Check if session is valid
    const isLoggedIn = await checkExistingLogin(page)
    if (!isLoggedIn) {
      logInfo('Session cookies expired or invalid - login required via GitHub Action')
      result.requiresLogin = true
      result.errors.push('Session expired. Run GitHub Action to login.')
      return result
    }

    logInfo('Session valid, refreshing by visiting pages')

    // Visit subscriptions to refresh session
    await page.goto('https://www.youtube.com/feed/subscriptions', {waitUntil: 'networkidle0', timeout: 30000})

    // Visit a video to ensure all cookies are refreshed
    try {
      await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', {waitUntil: 'networkidle0', timeout: 30000})
    } catch {
      logInfo('Video navigation timeout, continuing')
    }

    // Step 5: Extract refreshed cookies
    logInfo('Extracting refreshed cookies')
    const cookies = (await page.cookies()) as PuppeteerCookie[]

    if (cookies.length === 0) {
      throw new Error('No cookies extracted after session refresh')
    }

    // Filter to relevant domains
    const relevantDomains = ['.youtube.com', '.google.com', '.googlevideo.com', 'youtube.com', 'google.com']
    const youtubeCookies = cookies.filter((c) => relevantDomains.some((d) => c.domain.endsWith(d) || c.domain === d.slice(1) || c.domain === d))
    logInfo('Filtered cookies', {count: youtubeCookies.length})

    // Verify session is still authenticated
    const isAuthenticated = isAuthenticatedSession(youtubeCookies)
    result.isAuthenticated = isAuthenticated

    if (!isAuthenticated) {
      result.requiresLogin = true
      result.errors.push('Session lost during refresh. Run GitHub Action to login.')
      return result
    }

    // Step 6: Save refreshed cookies to Secrets Manager
    const netscapeCookies = convertToNetscapeFormat(youtubeCookies)

    logInfo('Saving refreshed cookies to Secrets Manager')
    await putSecretValue({
      SecretId: secretId,
      SecretString: JSON.stringify({
        cookies: netscapeCookies,
        extractedAt: result.extractedAt,
        cookieCount: youtubeCookies.length,
        userAgent: USER_AGENT,
        isAuthenticated,
        browserUsed: result.browserUsed
      })
    })

    result.success = true
    result.cookieCount = youtubeCookies.length
    result.sessionRefreshed = true
    logInfo('Session refreshed successfully', result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logError('RefreshYouTubeCookies failed', {error: message})
    result.errors.push(message)
  } finally {
    if (browser) {
      await browser.close()
      logDebug('Browser closed')
    }
  }

  return result
}))
