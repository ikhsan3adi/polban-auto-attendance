import { AttendanceOrchestrator } from './attendance/orchestrator'
import type { LoginCredential } from './config/types'
import { sanitizeForLogging, validateCredentials } from './shared/validation'

function loadCredentials(): LoginCredential {
  const username = Bun.env.USERNAME ?? ''
  const password = Bun.env.PASSWORD ?? ''

  return { username, password }
}

function loadOptions() {
  const includeReplacement = (Bun.env.KULIAH_PENGGANTI ?? 'true') === 'true'
  return { includeReplacement }
}

async function main(): Promise<void> {
  const credentials = loadCredentials()

  try {
    validateCredentials(credentials)
    console.info(
      `Validated credentials for user: ${sanitizeForLogging(credentials.username)}`,
    )
  } catch (error) {
    console.error(
      'Validation error:',
      error instanceof Error ? error.message : 'Unknown error',
    )
    process.exit(1)
  }

  const options = loadOptions()
  const orchestrator = new AttendanceOrchestrator()

  try {
    const result = await orchestrator.run({
      username: credentials.username,
      password: credentials.password,
      includeReplacement: options.includeReplacement,
    })

    if (result.hasFailure) {
      process.exit(1)
    }
  } catch (error) {
    console.error(
      'Fatal error:',
      error instanceof Error ? error.message : 'Unknown error',
    )
    process.exit(1)
  }
}

main()
