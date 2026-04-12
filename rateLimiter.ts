export class RateLimiter {
  private lastRequestTime: number = 0
  private minIntervalMs: number

  constructor(requestsPerSecond: number = 2) {
    this.minIntervalMs = 1000 / requestsPerSecond
  }

  async throttle(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.minIntervalMs) {
      const delayMs = this.minIntervalMs - timeSinceLastRequest
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    this.lastRequestTime = Date.now()
  }
}
