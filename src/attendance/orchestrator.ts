import { HttpClient } from '../clients/http'
import { Scraper } from '../clients/scraper'
import { KEHADIRAN_STATUS } from '../config/constants'
import type { JadwalKehadiran } from '../config/types'
import { TelegramNotifier } from '../integrations/telegram'
import {
  AttendanceSubmitter,
  getScheduleKey,
  updateAttendanceStatus,
  type SubmissionResult,
} from './submitter'

export interface RunOptions {
  username: string
  password: string
  includeReplacement: boolean
}

export interface RunResult {
  hasFailure: boolean
  schedules: JadwalKehadiran[]
  pendingCount: number
  succeededCount: number
}

export class AttendanceOrchestrator {
  private http: HttpClient
  private scraper: Scraper
  private submitter: AttendanceSubmitter
  private telegram: TelegramNotifier

  constructor() {
    this.http = new HttpClient(2)
    this.scraper = new Scraper(this.http)
    this.submitter = new AttendanceSubmitter(this.http)
    this.telegram = new TelegramNotifier()
  }

  async run(options: RunOptions): Promise<RunResult> {
    await this.http.login(options.username, options.password)

    const schedules = await this.fetchAllSchedules(options.includeReplacement)
    const pending = this.filterPending(schedules)

    let hasFailure = false
    const succeededKeys = new Set<string>()

    if (pending.length > 0) {
      const results = await this.submitPending(pending)
      hasFailure = results.some((r) => !r.success)
      this.collectSucceededKeys(results, succeededKeys)

      console.info(
        `${succeededKeys.size}/${pending.length} submissions succeeded`,
      )
    } else {
      console.info('No pending attendance')
    }

    const verified = updateAttendanceStatus(schedules, succeededKeys)
    this.printVerificationTable(verified)

    await this.sendReport(options, verified, pending.length, hasFailure)

    return {
      hasFailure,
      schedules: verified,
      pendingCount: pending.length,
      succeededCount: succeededKeys.size,
    }
  }

  private async fetchAllSchedules(
    includeReplacement: boolean,
  ): Promise<JadwalKehadiran[]> {
    const html = await this.scraper.fetchSchedulePage(false)
    const schedules = this.scraper.parseScheduleTable(html, '#jadwal', false)

    if (includeReplacement) {
      const replacementHtml = await this.scraper.fetchSchedulePage(true)
      const replacementSchedules = this.scraper.parseScheduleTable(
        replacementHtml,
        '#jadwal',
        true,
      )
      schedules.push(...replacementSchedules)
    }

    return schedules
  }

  private filterPending(schedules: JadwalKehadiran[]): JadwalKehadiran[] {
    return schedules.filter((s) => s.kehadiran !== KEHADIRAN_STATUS.HADIR)
  }

  private async submitPending(
    pending: JadwalKehadiran[],
  ): Promise<SubmissionResult[]> {
    const results = await this.submitter.submitAll(pending)

    results.forEach((result) => {
      if (!result.success && result.error) {
        console.error(
          `Submit failed for ${result.schedule.mataKuliah}:`,
          result.error instanceof Error
            ? result.error.message
            : String(result.error),
        )
      }
    })

    return results
  }

  private collectSucceededKeys(
    results: SubmissionResult[],
    keys: Set<string>,
  ): void {
    results.forEach((result) => {
      if (result.success) {
        keys.add(getScheduleKey(result.schedule))
      }
    })
  }

  private printVerificationTable(schedules: JadwalKehadiran[]): void {
    if (schedules.length === 0) return

    console.table(
      schedules.map((s) => ({
        Dosen: `(${s.kodeDosen}) ${s.dosen}`,
        'Mata Kuliah': `(${s.kodeMataKuliah}) ${s.mataKuliah} (${s.tp})`,
        Jam: s.jamPerkuliahan,
        Kehadiran: s.kehadiran,
        Pengganti: s.kuliahPengganti,
      })),
    )
  }

  private async sendReport(
    options: RunOptions,
    schedules: JadwalKehadiran[],
    submitted: number,
    hasFailure: boolean,
  ): Promise<void> {
    const mode = options.includeReplacement
      ? 'Kuliah Normal + Kuliah Pengganti'
      : 'Kuliah Normal Only'

    const trigger = this.detectTrigger()

    await this.telegram.sendReport({
      mode,
      trigger,
      submitted,
      hasFailure,
      jadwal: schedules,
    })
  }

  private detectTrigger(): string {
    const githubEvent = process.env.GITHUB_EVENT_NAME
    if (githubEvent === 'schedule') return 'Scheduled Workflow'
    if (githubEvent === 'workflow_dispatch') return 'Workflow Dispatch'
    return 'Manual'
  }
}
