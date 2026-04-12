import type { JadwalKehadiran } from '../config/types'
import { ENDPOINTS, KEHADIRAN_STATUS } from '../config/constants'
import type { HttpClient } from '../clients/http'

export interface SubmissionResult {
  success: boolean
  schedule: JadwalKehadiran
  error?: Error
}

export class AttendanceSubmitter {
  constructor(private http: HttpClient) {}

  async submit(schedule: JadwalKehadiran): Promise<void> {
    const path = schedule.kuliahPengganti
      ? ENDPOINTS.SIMPAN_AWAL_PENGGANTI
      : ENDPOINTS.SIMPAN_AWAL

    console.info(`Submit: ${schedule.mataKuliah} (${schedule.tp})`)

    const data = {
      ja: schedule.jamAwal.toString(),
      jb: schedule.jamAkhir.toString(),
      mk: schedule.kodeMataKuliah,
      dsn: schedule.kodeDosen,
      tp: schedule.tp,
      kls: schedule.kelas,
    }

    const response = await this.http.postForm(path, data)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
  }

  async submitAll(schedules: JadwalKehadiran[]): Promise<SubmissionResult[]> {
    const results = await Promise.allSettled(
      schedules.map(async (schedule) => {
        await this.submit(schedule)
        return schedule
      }),
    )

    return results.map((result, idx) => ({
      success: result.status === 'fulfilled',
      schedule: schedules[idx]!,
      error:
        result.status === 'rejected' ? (result.reason as Error) : undefined,
    }))
  }
}

export function getScheduleKey(schedule: JadwalKehadiran): string {
  return `${schedule.kodeMataKuliah}|${schedule.kodeDosen}|${schedule.jamAwal}`
}

export function updateAttendanceStatus(
  schedules: JadwalKehadiran[],
  succeededKeys: Set<string>,
): JadwalKehadiran[] {
  return schedules.map((s) =>
    succeededKeys.has(getScheduleKey(s))
      ? { ...s, kehadiran: KEHADIRAN_STATUS.HADIR_NEW }
      : s,
  )
}
