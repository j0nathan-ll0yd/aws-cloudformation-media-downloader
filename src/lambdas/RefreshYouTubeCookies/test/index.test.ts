import {afterAll, afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {createMockContext} from '#util/vitest-setup'
import {createScheduledEvent} from '#test/helpers/event-factories'
import {PutSecretValueCommand} from '@aws-sdk/client-secrets-manager'
import {createSecretsManagerMock, resetAllAwsMocks} from '#test/helpers/aws-sdk-mock'

// Create SecretsManager mock using helper - injects into vendor client factory
const secretsManagerMock = createSecretsManagerMock()

// Set required env vars for handler
process.env.YOUTUBE_COOKIES_SECRET_ID = 'test-secret-id'
process.env.YOUTUBE_EMAIL = 'test@example.com'
process.env.YOUTUBE_PASSWORD = 'test-password'

// Mock Puppeteer types for test
interface MockCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
}

interface MockPage {
  goto: ReturnType<typeof vi.fn>
  $: ReturnType<typeof vi.fn>
  evaluate: ReturnType<typeof vi.fn>
  waitForNavigation: ReturnType<typeof vi.fn>
  waitForSelector: ReturnType<typeof vi.fn>
  type: ReturnType<typeof vi.fn>
  click: ReturnType<typeof vi.fn>
  url: ReturnType<typeof vi.fn>
  title: ReturnType<typeof vi.fn>
  cookies: ReturnType<typeof vi.fn>
  setUserAgent: ReturnType<typeof vi.fn>
  setViewport: ReturnType<typeof vi.fn>
  setExtraHTTPHeaders: ReturnType<typeof vi.fn>
  emulateTimezone: ReturnType<typeof vi.fn>
}

interface MockBrowser {
  newPage: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

// Use vi.hoisted() to define mock classes before vi.mock hoists
const {mockBrowser, mockPage, mockLaunch, mockExecutablePath} = vi.hoisted(() => {
  const mockPage: MockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    $: vi.fn().mockResolvedValue(null),
    evaluate: vi.fn().mockResolvedValue(''),
    waitForNavigation: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue('https://www.youtube.com'),
    title: vi.fn().mockResolvedValue('YouTube'),
    cookies: vi.fn().mockResolvedValue([]),
    setUserAgent: vi.fn().mockResolvedValue(undefined),
    setViewport: vi.fn().mockResolvedValue(undefined),
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
    emulateTimezone: vi.fn().mockResolvedValue(undefined)
  }

  const mockBrowser: MockBrowser = {newPage: vi.fn().mockResolvedValue(mockPage), close: vi.fn().mockResolvedValue(undefined)}

  const mockLaunch = vi.fn().mockResolvedValue(mockBrowser)
  const mockExecutablePath = vi.fn().mockResolvedValue('/opt/chromium')

  return {mockBrowser, mockPage, mockLaunch, mockExecutablePath}
})

// Mock puppeteer-extra (includes stealth plugin support)
vi.mock('puppeteer-extra', () => ({
  default: {
    launch: mockLaunch,
    use: vi.fn() // Stealth plugin is called at module load time
  }
}))

// Mock puppeteer-extra-plugin-stealth
vi.mock('puppeteer-extra-plugin-stealth', () => ({default: vi.fn(() => ({}))}))

// Mock @sparticuz/chromium
vi.mock('@sparticuz/chromium',
  () => ({
    default: {
      args: ['--disable-gpu', '--single-process'],
      executablePath: mockExecutablePath,
      defaultViewport: {width: 1920, height: 1080},
      setHeadlessMode: 'shell',
      setGraphicsMode: false
    }
  }))

// Mock SecretsManager vendor
vi.mock('#lib/vendor/AWS/SecretsManager', () => ({putSecretValue: vi.fn()}))

const {handler} = await import('./../src')
import {putSecretValue} from '#lib/vendor/AWS/SecretsManager'

// Create fake YouTube cookies with at least 3 auth cookies (SID, SSID, HSID, LOGIN_INFO, etc)
const fakeYouTubeCookies: MockCookie[] = [
  {name: 'VISITOR_INFO1_LIVE', value: 'abc123', domain: '.youtube.com', path: '/', expires: Date.now() / 1000 + 86400, httpOnly: true, secure: true},
  {name: 'LOGIN_INFO', value: 'xyz789', domain: '.youtube.com', path: '/', expires: Date.now() / 1000 + 86400, httpOnly: true, secure: true},
  {name: 'SID', value: 'sid123', domain: '.google.com', path: '/', expires: Date.now() / 1000 + 86400, httpOnly: true, secure: true},
  {name: 'SSID', value: 'ssid456', domain: '.google.com', path: '/', expires: Date.now() / 1000 + 86400, httpOnly: true, secure: true},
  {name: 'HSID', value: 'hsid789', domain: '.google.com', path: '/', expires: Date.now() / 1000 + 86400, httpOnly: true, secure: true}
]

// Mock avatar button for logged-in detection
const mockAvatarButton = {boundingBox: vi.fn().mockResolvedValue({x: 100, y: 100, width: 50, height: 30})}

describe('#RefreshYouTubeCookies', () => {
  const event = createScheduledEvent()
  const context = createMockContext()

  beforeEach(() => {
    vi.clearAllMocks()
    secretsManagerMock.on(PutSecretValueCommand).resolves({})
    // Reset mock implementations
    mockPage.cookies.mockResolvedValue(fakeYouTubeCookies)
    mockPage.goto.mockResolvedValue(undefined)
    mockPage.url.mockReturnValue('https://www.youtube.com')
    mockPage.title.mockResolvedValue('YouTube')
    mockPage.$.mockResolvedValue(null)
    mockPage.evaluate.mockResolvedValue('')
    mockLaunch.mockResolvedValue(mockBrowser)
    // Default: not logged in, will trigger login flow
    mockAvatarButton.boundingBox.mockResolvedValue(null)
  })

  afterEach(() => {
    secretsManagerMock.reset()
  })

  afterAll(() => {
    resetAllAwsMocks()
  })

  describe('#SuccessfulExtraction', () => {
    test('should extract cookies and store in Secrets Manager when already logged in', async () => {
      // Simulate already logged in (avatar button visible)
      mockPage.$.mockImplementation(async (selector: string) => {
        if (selector === 'button#avatar-btn') {
          return mockAvatarButton
        }
        return null
      })
      mockAvatarButton.boundingBox.mockResolvedValue({x: 100, y: 100, width: 50, height: 30})

      vi.mocked(putSecretValue).mockResolvedValue({} as never)

      const result = await handler(event, context)

      expect(result.success).toBe(true)
      expect(result.cookieCount).toBe(5)
      expect(result.errors).toHaveLength(0)
      expect(result.extractedAt).toBeDefined()
      expect(result.isAuthenticated).toBe(true)
      expect(result.browserUsed).toBe('chromium-stealth')

      // Verify puppeteer-extra was called with stealth args
      expect(mockLaunch).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.arrayContaining(['--disable-blink-features=AutomationControlled']),
          executablePath: '/opt/chromium',
          headless: true
        })
      )

      // Verify user agent was set
      expect(mockPage.setUserAgent).toHaveBeenCalledWith(expect.stringContaining('Chrome/131'))

      // Verify timezone was set
      expect(mockPage.emulateTimezone).toHaveBeenCalledWith('America/Los_Angeles')

      // Verify extra headers were set
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({'Accept-Language': 'en-US,en;q=0.9'})

      // Verify Secrets Manager was called
      expect(putSecretValue).toHaveBeenCalledWith({SecretId: 'test-secret-id', SecretString: expect.stringContaining('cookies')})

      // Verify browser was closed
      expect(mockBrowser.close).toHaveBeenCalled()
    })

    test('should attempt login flow when not already logged in', async () => {
      // Not logged in - avatar not found, but URL shows challenge which fails login
      mockPage.$.mockResolvedValue(null)
      mockPage.url.mockReturnValue('https://accounts.google.com/signin/challenge/...')

      vi.mocked(putSecretValue).mockResolvedValue({} as never)

      const result = await handler(event, context)

      // Login failed due to challenge, but login flow was attempted
      expect(result.success).toBe(false)
      expect(mockPage.goto).toHaveBeenCalledWith('https://accounts.google.com/signin/v2/identifier?service=youtube', expect.any(Object))
    })

    test('should convert cookies to Netscape format with stealth header', async () => {
      mockPage.$.mockImplementation(async (selector: string) => {
        if (selector === 'button#avatar-btn') {
          return mockAvatarButton
        }
        return null
      })
      mockAvatarButton.boundingBox.mockResolvedValue({x: 100, y: 100, width: 50, height: 30})

      vi.mocked(putSecretValue).mockResolvedValue({} as never)

      await handler(event, context)

      // Verify the secret contains Netscape format with stealth header
      const putCall = vi.mocked(putSecretValue).mock.calls[0][0]
      const secretContent = JSON.parse(putCall.SecretString as string)

      expect(secretContent.cookies).toContain('# Netscape HTTP Cookie File')
      expect(secretContent.cookies).toContain('stealth plugin')
      expect(secretContent.cookies).toContain('.youtube.com')
      expect(secretContent.cookies).toContain('VISITOR_INFO1_LIVE')
      expect(secretContent.browserUsed).toBe('chromium-stealth')
    })

    test('should handle consent dialog when present', async () => {
      const mockConsentButton = {
        boundingBox: vi.fn().mockResolvedValue({x: 100, y: 100, width: 50, height: 30}),
        click: vi.fn().mockResolvedValue(undefined)
      }

      mockPage.$.mockImplementation(async (selector: string) => {
        if (selector === 'button#avatar-btn') {
          return mockAvatarButton
        }
        if (selector.includes('Accept')) {
          return mockConsentButton
        }
        return null
      })
      mockAvatarButton.boundingBox.mockResolvedValue({x: 100, y: 100, width: 50, height: 30})

      vi.mocked(putSecretValue).mockResolvedValue({} as never)

      const result = await handler(event, context)

      expect(result.success).toBe(true)
      expect(mockConsentButton.click).toHaveBeenCalled()
    })
  })

  describe('#ErrorHandling', () => {
    test('should handle browser launch failure', async () => {
      mockLaunch.mockRejectedValue(new Error('Browser launch failed'))

      const result = await handler(event, context)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Browser launch failed')
    })

    test('should handle video page navigation failure gracefully', async () => {
      mockPage.$.mockImplementation(async (selector: string) => {
        if (selector === 'button#avatar-btn') {
          return mockAvatarButton
        }
        return null
      })
      mockAvatarButton.boundingBox.mockResolvedValue({x: 100, y: 100, width: 50, height: 30})

      // First navigations succeed, video page fails
      mockPage.goto.mockResolvedValueOnce(undefined) // YouTube homepage
        .mockResolvedValueOnce(undefined) // Subscriptions refresh
        .mockRejectedValueOnce(new Error('Navigation timeout')) // Video page

      vi.mocked(putSecretValue).mockResolvedValue({} as never)

      const result = await handler(event, context)

      // Should still succeed if login cookies are extracted
      expect(result.success).toBe(true)
      expect(result.cookieCount).toBe(5)
    })

    test('should handle empty cookies gracefully', async () => {
      mockPage.$.mockImplementation(async (selector: string) => {
        if (selector === 'button#avatar-btn') {
          return mockAvatarButton
        }
        return null
      })
      mockAvatarButton.boundingBox.mockResolvedValue({x: 100, y: 100, width: 50, height: 30})
      mockPage.cookies.mockResolvedValue([])

      const result = await handler(event, context)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('No cookies extracted')
    })

    test('should handle Secrets Manager failure', async () => {
      mockPage.$.mockImplementation(async (selector: string) => {
        if (selector === 'button#avatar-btn') {
          return mockAvatarButton
        }
        return null
      })
      mockAvatarButton.boundingBox.mockResolvedValue({x: 100, y: 100, width: 50, height: 30})

      vi.mocked(putSecretValue).mockRejectedValue(new Error('Access denied'))

      const result = await handler(event, context)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Access denied')
    })

    test('should close browser even on error', async () => {
      mockPage.$.mockImplementation(async (selector: string) => {
        if (selector === 'button#avatar-btn') {
          return mockAvatarButton
        }
        return null
      })
      mockAvatarButton.boundingBox.mockResolvedValue({x: 100, y: 100, width: 50, height: 30})
      mockPage.cookies.mockRejectedValue(new Error('Cookie extraction failed'))

      await handler(event, context)

      expect(mockBrowser.close).toHaveBeenCalled()
    })

    test('should fail when login fails due to challenge', async () => {
      // Not logged in, login will be attempted
      mockPage.$.mockResolvedValue(null)

      // Simulate challenge page URL
      mockPage.url.mockReturnValue('https://accounts.google.com/signin/challenge/...')

      const result = await handler(event, context)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Google login failed')
    })

    test('should fail when cookies do not indicate authenticated session', async () => {
      mockPage.$.mockImplementation(async (selector: string) => {
        if (selector === 'button#avatar-btn') {
          return mockAvatarButton
        }
        return null
      })
      mockAvatarButton.boundingBox.mockResolvedValue({x: 100, y: 100, width: 50, height: 30})

      // Return cookies without enough auth cookies (needs at least 3)
      mockPage.cookies.mockResolvedValue([
        {name: 'VISITOR_INFO1_LIVE', value: 'abc123', domain: '.youtube.com', path: '/', expires: Date.now() / 1000 + 86400, httpOnly: true, secure: true},
        {name: 'SID', value: 'sid123', domain: '.google.com', path: '/', expires: Date.now() / 1000 + 86400, httpOnly: true, secure: true}
      ])

      vi.mocked(putSecretValue).mockResolvedValue({} as never)

      const result = await handler(event, context)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Cookies do not indicate authenticated session')
    })

    test('should detect URL-based challenge during login', async () => {
      // Not logged in, URL indicates challenge
      mockPage.$.mockResolvedValue(null)
      mockPage.url.mockReturnValue('https://accounts.google.com/signin/challenge/something')

      const result = await handler(event, context)

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('Google login failed')
    })

    test('should detect title-based verification challenge', async () => {
      // Not logged in, page title indicates verification
      mockPage.$.mockResolvedValue(null)
      mockPage.url.mockReturnValue('https://accounts.google.com/signin')
      mockPage.title.mockResolvedValue('Verify your identity')

      const result = await handler(event, context)

      expect(result.success).toBe(false)
    })
  })

  describe('#CookieFiltering', () => {
    test('should filter to only YouTube, Google, and googlevideo cookies', async () => {
      mockPage.$.mockImplementation(async (selector: string) => {
        if (selector === 'button#avatar-btn') {
          return mockAvatarButton
        }
        return null
      })
      mockAvatarButton.boundingBox.mockResolvedValue({x: 100, y: 100, width: 50, height: 30})

      const mixedCookies: MockCookie[] = [
        ...fakeYouTubeCookies,
        {name: 'video_cookie', value: 'value', domain: '.googlevideo.com', path: '/', expires: 0, httpOnly: false, secure: true},
        {name: 'other_cookie', value: 'value', domain: '.example.com', path: '/', expires: 0, httpOnly: false, secure: false}
      ]
      mockPage.cookies.mockResolvedValue(mixedCookies)

      vi.mocked(putSecretValue).mockResolvedValue({} as never)

      const result = await handler(event, context)

      // Should count YouTube/Google/googlevideo cookies (6), not example.com
      expect(result.cookieCount).toBe(6)
    })
  })

  describe('#StealthFeatures', () => {
    test('should include anti-detection Chrome args', async () => {
      mockPage.$.mockImplementation(async (selector: string) => {
        if (selector === 'button#avatar-btn') {
          return mockAvatarButton
        }
        return null
      })
      mockAvatarButton.boundingBox.mockResolvedValue({x: 100, y: 100, width: 50, height: 30})

      vi.mocked(putSecretValue).mockResolvedValue({} as never)

      await handler(event, context)

      expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({
        args: expect.arrayContaining([
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox'
        ])
      }))
    })

    test('should set timezone for consistent fingerprint', async () => {
      mockPage.$.mockImplementation(async (selector: string) => {
        if (selector === 'button#avatar-btn') {
          return mockAvatarButton
        }
        return null
      })
      mockAvatarButton.boundingBox.mockResolvedValue({x: 100, y: 100, width: 50, height: 30})

      vi.mocked(putSecretValue).mockResolvedValue({} as never)

      await handler(event, context)

      expect(mockPage.emulateTimezone).toHaveBeenCalledWith('America/Los_Angeles')
    })

    test('should set Accept-Language header', async () => {
      mockPage.$.mockImplementation(async (selector: string) => {
        if (selector === 'button#avatar-btn') {
          return mockAvatarButton
        }
        return null
      })
      mockAvatarButton.boundingBox.mockResolvedValue({x: 100, y: 100, width: 50, height: 30})

      vi.mocked(putSecretValue).mockResolvedValue({} as never)

      await handler(event, context)

      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({'Accept-Language': 'en-US,en;q=0.9'})
    })
  })

  describe('#EdgeCases', () => {
    test('should handle missing secret ID environment variable', async () => {
      const originalSecretId = process.env.YOUTUBE_COOKIES_SECRET_ID
      delete process.env.YOUTUBE_COOKIES_SECRET_ID

      // Re-import handler to pick up missing env var
      vi.resetModules()

      // This should throw due to getRequiredEnv
      await expect(import('./../src').then((m) => m.handler(event, context))).rejects.toThrow()

      process.env.YOUTUBE_COOKIES_SECRET_ID = originalSecretId
    })
  })
})
