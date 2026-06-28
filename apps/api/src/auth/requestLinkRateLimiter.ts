export type RateLimitRequest = {
  email: string;
  clientIp: string;
  nowMs?: number;
};

export type RequestLinkRateLimiter = {
  tryConsume(request: RateLimitRequest): boolean;
};

const requestLinkRateLimitWindowMs = 15 * 60 * 1000;
const requestLinkRateLimitMaxAttempts = 3;

/**Limits repeated magic-link requests per email and client IP within a single runtime instance. */
export class InMemoryRequestLinkRateLimiter implements RequestLinkRateLimiter {
  private readonly attemptsByKey = new Map<string, number[]>();

  constructor(
    private readonly windowMs = requestLinkRateLimitWindowMs,
    private readonly maxAttempts = requestLinkRateLimitMaxAttempts
  ) {}

  /**Returns true when the request is under both the email and IP attempt limits. */
  tryConsume(request: RateLimitRequest): boolean {
    const nowMs = request.nowMs ?? Date.now();
    const keys = this.buildRateLimitKeys(request);

    if (keys.some(key => this.isOverLimit(key, nowMs))) {
      return false;
    }

    keys.forEach(key => this.recordAttempt(key, nowMs));

    return true;
  }

  private buildRateLimitKeys(request: RateLimitRequest): string[] {
    return [`email:${request.email}`, `ip:${request.clientIp || "unknown"}`];
  }

  private isOverLimit(key: string, nowMs: number): boolean {
    return this.countRecentAttempts(key, nowMs) >= this.maxAttempts;
  }

  private countRecentAttempts(key: string, nowMs: number): number {
    const recentAttempts = this.getRecentAttempts(key, nowMs);
    this.attemptsByKey.set(key, recentAttempts);

    return recentAttempts.length;
  }

  private recordAttempt(key: string, nowMs: number): void {
    const recentAttempts = this.getRecentAttempts(key, nowMs);
    recentAttempts.push(nowMs);
    this.attemptsByKey.set(key, recentAttempts);
  }

  private getRecentAttempts(key: string, nowMs: number): number[] {
    const windowStartMs = nowMs - this.windowMs;

    return (this.attemptsByKey.get(key) ?? []).filter(attemptMs => attemptMs > windowStartMs);
  }
}

export const defaultRequestLinkRateLimiter = new InMemoryRequestLinkRateLimiter();
