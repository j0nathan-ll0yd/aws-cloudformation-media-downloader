/**
 * iOS API Client Simulation
 *
 * Simulates the HTTP client behavior of the iOS app for E2E testing.
 * Mirrors the networking patterns used by the actual iOS application.
 */

export interface ApiClientConfig {
  baseUrl: string
  apiKey: string
  timeout?: number
}

export interface ApiResponse<T> {
  body: T
  requestId: string
}

export interface ApiError {
  error: {code: string; message: string}
  requestId: string
}

export interface AuthTokens {
  token: string
  expiresAt: number
  sessionId: string
  userId: string
}

/**
 * Simulates the iOS app's API client with realistic headers and behavior
 */
export class ApiClient {
  private config: ApiClientConfig
  private authToken: string | null = null

  constructor(config: ApiClientConfig) {
    this.config = {timeout: 30000, ...config}
  }

  /**
   * Set the authentication token for subsequent requests
   */
  setAuthToken(token: string): void {
    this.authToken = token
  }

  /**
   * Clear the authentication token
   */
  clearAuthToken(): void {
    this.authToken = null
  }

  /**
   * Get the current auth token
   */
  getAuthToken(): string | null {
    return this.authToken
  }

  /**
   * Build headers that mimic iOS app requests
   */
  private buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'OfflineMediaDownloader/1.0.0 (iOS; iPhone15,2; 17.0)',
      'X-Client-Version': '1.0.0',
      'X-Platform': 'iOS',
      ...additionalHeaders
    }

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    return headers
  }

  /**
   * Build URL with API key query parameter
   */
  private buildUrl(path: string): string {
    const url = new URL(path, this.config.baseUrl)
    url.searchParams.set('ApiKey', this.config.apiKey)
    return url.toString()
  }

  /**
   * Make an HTTP request with iOS-like behavior
   */
  async request<T>(
    method: string,
    path: string,
    options?: {body?: unknown; headers?: Record<string, string>}
  ): Promise<{status: number; data: ApiResponse<T> | ApiError}> {
    const url = this.buildUrl(path)
    const headers = this.buildHeaders(options?.headers)

    const fetchOptions: RequestInit = {method, headers, signal: AbortSignal.timeout(this.config.timeout!)}

    if (options?.body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(options.body)
    }

    const response = await fetch(url, fetchOptions)
    const status = response.status

    // Handle 204 No Content
    if (status === 204) {
      return {status, data: {body: {} as T, requestId: response.headers.get('x-amzn-requestid') || ''}}
    }

    const data = await response.json()
    return {status, data}
  }

  /**
   * GET request
   */
  async get<T>(path: string, headers?: Record<string, string>): Promise<{status: number; data: ApiResponse<T> | ApiError}> {
    return this.request<T>('GET', path, {headers})
  }

  /**
   * POST request
   */
  async post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<{status: number; data: ApiResponse<T> | ApiError}> {
    return this.request<T>('POST', path, {body, headers})
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string, headers?: Record<string, string>): Promise<{status: number; data: ApiResponse<T> | ApiError}> {
    return this.request<T>('DELETE', path, {headers})
  }
}

/**
 * Create a pre-configured API client for LocalStack testing
 */
export function createLocalStackClient(): ApiClient {
  return new ApiClient({
    baseUrl: process.env.E2E_BASE_URL || 'http://localhost:4566/restapis/test-api/prod/_user_request_',
    apiKey: process.env.E2E_API_KEY || 'test-api-key',
    timeout: 10000
  })
}

/**
 * Create a pre-configured API client for remote testing
 */
export function createRemoteClient(baseUrl: string, apiKey: string): ApiClient {
  return new ApiClient({baseUrl, apiKey, timeout: 30000})
}
