import type { LoginCredential } from './types'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function validateCredentials(creds: LoginCredential): void {
  const { username, password } = creds

  if (!username || typeof username !== 'string') {
    throw new ValidationError('USERNAME is required')
  }

  if (!password || typeof password !== 'string') {
    throw new ValidationError('PASSWORD is required')
  }

  const nimRegex = /^\d{8,10}$/
  if (!nimRegex.test(username)) {
    throw new ValidationError('USERNAME must be 8-10 digits (NIM format)')
  }

  if (password.length < 3) {
    throw new ValidationError('PASSWORD must be at least 3 characters')
  }

  const controlChars = /[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/
  if (controlChars.test(password)) {
    throw new ValidationError('PASSWORD contains invalid control characters')
  }
}

export function sanitizeForLogging(value: string): string {
  if (!value || value.length <= 4) return '***'
  return value.slice(0, 2) + '***' + value.slice(-2)
}
