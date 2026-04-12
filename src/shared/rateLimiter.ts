export class RateLimiter {
  private lastRequestTime: number
  private minIntervalMs: number

  constructor(requestsPerSecond: number) {
    this.lastRequestTime = 0
    this.minIntervalMs = 1000 / requestsPerSecond
  }

  async throttle(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    const waitTime = Math.max(0, this.minIntervalMs - elapsed)

    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    this.lastRequestTime = Date.now()
  }
}
