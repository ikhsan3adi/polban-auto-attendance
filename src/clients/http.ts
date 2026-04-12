import {
  BASE_URL,
  ENDPOINTS,
  HTTP_STATUS,
  REFRESH_SUCCESS_INDICATOR,
  USER_AGENT,
} from '../config/constants'
import { RateLimiter } from '../shared/rateLimiter'

export class HttpClient {
  private rateLimiter: RateLimiter
  private sessionCookie: string | null = null

  constructor(requestsPerSecond = 2) {
    this.rateLimiter = new RateLimiter(requestsPerSecond)
  }

  async login(username: string, password: string): Promise<void> {
    const urlLogin = `${BASE_URL}${ENDPOINTS.LOGIN}`

    console.info(`Login & get session cookie: ${urlLogin}`)
    await this.rateLimiter.throttle()

    const initResponse = await fetch(urlLogin, {
      headers: { 'User-Agent': USER_AGENT },
    })

    const initCookie = initResponse.headers.get('Set-Cookie')
    if (!initCookie) throw new Error('Initial Set-Cookie Not Found!')

    const initSession = initCookie.split(';')[0]
    if (!initSession) throw new Error('Failed to extract initial session')

    const body = new URLSearchParams()
    body.append('username', username)
    body.append('password', password)
    body.append('submit', 'Sign In')

    await this.rateLimiter.throttle()
    const response = await fetch(urlLogin, {
      method: 'POST',
      body: body,
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
        Referer: urlLogin,
        Origin: BASE_URL,
        Cookie: initSession,
      },
    })

    if (response.status !== HTTP_STATUS.REDIRECT && !response.ok) {
      throw new Error(`Login failed! status: ${response.status}`)
    }

    const refresh = response.headers.get('Refresh')
    if (!refresh || !refresh.includes(REFRESH_SUCCESS_INDICATOR)) {
      throw new Error('Login failed: invalid credentials')
    }

    const cookie = response.headers.get('Set-Cookie')
    this.sessionCookie = cookie || initCookie
  }

  getSession(): string {
    if (!this.sessionCookie) throw new Error('Not authenticated')
    return this.sessionCookie.split('; ')[0]!
  }

  async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    await this.rateLimiter.throttle()

    const url = `${BASE_URL}${path}`
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Cookie: this.getSession(),
      ...(options.headers as Record<string, string>),
    }

    return fetch(url, { ...options, headers })
  }

  async fetchText(path: string, options: RequestInit = {}): Promise<string> {
    const response = await this.fetch(path, options)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.text()
  }

  async postForm(
    path: string,
    data: Record<string, string>,
  ): Promise<Response> {
    const body = new URLSearchParams(data)
    return this.fetch(path, {
      method: 'POST',
      body: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  }
}
