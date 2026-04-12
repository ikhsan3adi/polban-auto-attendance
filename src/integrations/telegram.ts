import { KEHADIRAN_STATUS, TELEGRAM_API } from '../config/constants'
import type { AbsenReport, JadwalKehadiran } from '../config/types'

export class TelegramNotifier {
  private token: string | undefined
  private chatId: string | undefined

  constructor() {
    this.token = Bun.env.TELEGRAM_BOT_TOKEN
    this.chatId = Bun.env.TELEGRAM_CHAT_ID
  }

  async sendReport(report: AbsenReport): Promise<void> {
    const message = this.buildMessage(report)
    await this.send(message)
  }

  private buildMessage(report: AbsenReport): string {
    const lines: string[] = []

    const date = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    lines.push(
      '\u{1F4CA} <b>Auto Attendance Report</b>\n',
      `\u{1F4C5} ${date}`,
      `\u{2699}\u{FE0F} Mode: ${report.mode}`,
      `\u{1F680} Trigger: ${report.trigger}\n`,
    )

    if (report.submitted > 0) {
      const icon = report.hasFailure ? '\u{26A0}\u{FE0F}' : '\u{2705}'
      lines.push(`${icon} Submitted: ${report.submitted} item(s)`)
    } else {
      lines.push('\u{2705} No pending attendance')
    }

    if (report.jadwal.length > 0) {
      lines.push('', '\u{1F4DD} <b>Jadwal Hari Ini</b>')
      for (const j of report.jadwal) {
        lines.push(...this.formatScheduleLine(j))
      }
    }

    return lines.join('\n')
  }

  private formatScheduleLine(j: JadwalKehadiran): string[] {
    const icon = this.getAttendanceIcon(j.kehadiran)
    const tag = j.kuliahPengganti ? ' \u{1F504}' : ''

    return [
      `<b>${j.mataKuliah}</b> (${j.tp})${tag}`,
      `      \u{1F468}\u{200D}\u{1F3EB} ${j.dosen}`,
      `      \u{1F552} ${j.jamPerkuliahan}`,
      `      ${icon} ${j.kehadiran}`,
    ]
  }

  private getAttendanceIcon(status: string): string {
    if (status === KEHADIRAN_STATUS.HADIR_NEW) return '\u{2705} \u{1F195}'
    if (status === KEHADIRAN_STATUS.HADIR) return '\u{2705}'
    return '\u{274C}'
  }

  private async send(text: string): Promise<void> {
    if (!this.token || !this.chatId) {
      console.info('Telegram not configured, skipping notification')
      return
    }

    const url = `${TELEGRAM_API}/bot${this.token}/sendMessage`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: text,
          parse_mode: 'HTML',
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      console.info(`Telegram message sent successfully to chat ${this.chatId}`)
    } catch (error) {
      console.error(
        'Failed to send Telegram message:',
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }
}
