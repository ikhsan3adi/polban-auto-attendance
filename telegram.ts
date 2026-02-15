const TELEGRAM_API = 'https://api.telegram.org'

interface JadwalReport {
  mataKuliah: string
  tp: string
  dosen: string
  jamPerkuliahan: string
  kehadiran: string
  kuliahPengganti: boolean
}

interface AbsenReport {
  mode: string
  submitted: number
  hasFailure: boolean
  jadwal: JadwalReport[]
}

export function buildReportMessage(report: AbsenReport): string {
  const date = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const lines: string[] = [
    '\u{1F4CA} <b>Auto Absen Report</b>\n',
    `\u{1F4C5} ${date}`,
    `\u{2699}\u{FE0F} Mode: ${report.mode}\n`,
  ]

  if (report.submitted > 0) {
    const icon = report.hasFailure ? '\u{26A0}\u{FE0F}' : '\u{2705}'
    lines.push(`${icon} Submitted: ${report.submitted} item(s)`)
  } else {
    lines.push('\u{2705} No pending attendance')
  }

  if (report.jadwal.length > 0) {
    lines.push('', '\u{1F4DD} <b>Jadwal Hari Ini</b>')
    for (const j of report.jadwal) {
      const icon = j.kehadiran === 'Hadir' ? '\u{2705}' : '\u{274C}'
      const tag = j.kuliahPengganti ? ' \u{1F504}' : ''
      lines.push(
        `<b>${j.mataKuliah}</b> (${j.tp})${tag}`,
        `      \u{1F468}\u{200D}\u{1F3EB} ${j.dosen}`,
        `      \u{1F552} ${j.jamPerkuliahan}`,
        `      ${icon} ${j.kehadiran}`,
      )
    }
  }

  return lines.join('\n')
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const token = Bun.env.TELEGRAM_BOT_TOKEN
  const chatId = Bun.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) return

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error(`Telegram send failed (${response.status}): ${body}`)
    }
  } catch (error) {
    console.error('Telegram notification error:', error)
  }
}
