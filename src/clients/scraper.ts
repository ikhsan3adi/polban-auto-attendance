import { JSDOM } from 'jsdom'
import type { JadwalKehadiran } from '../config/types'
import { ENDPOINTS, SELECTORS } from '../config/constants'
import type { HttpClient } from './http'

export class Scraper {
  constructor(private http: HttpClient) {}

  async fetchSchedulePage(isReplacement = false): Promise<string> {
    const path = isReplacement ? ENDPOINTS.ABSEN_PENGGANTI : ENDPOINTS.ABSEN
    console.info(`Scraping schedule + attendance table from: ${path}`)
    return this.http.fetchText(path)
  }

  parseScheduleTable(
    html: string,
    selector: string,
    isReplacement = false,
  ): JadwalKehadiran[] {
    const dom = new JSDOM(html)
    const document = dom.window.document

    const table = document.querySelector(selector)
    if (!table) {
      console.info('Table Not Found')
      return []
    }

    const classCode = table
      .querySelector(SELECTORS.KELAS_INPUT)
      ?.getAttribute('value')

    const rows = table.querySelectorAll('tbody > tr')
    const schedules: JadwalKehadiran[] = []

    rows.forEach((row) => {
      const cells = row.querySelectorAll('td')
      const rowData = this.extractRowData(cells)
      const parsed = this.parseRowData(rowData, classCode ?? '?', isReplacement)
      if (parsed) schedules.push(parsed)
    })

    return schedules
  }

  private extractRowData(cells: NodeListOf<Element>): Map<string, string> {
    return new Map(
      Array.from(cells).map((cell, idx) => {
        const links = cell.querySelectorAll('a, button')
        const dataHeader = cell
          .getAttribute('data-header')
          ?.replace(/&nbsp;/g, '')
          .trim()

        let content: string
        if (links.length > 0 && links[0]) {
          content = links[0]?.textContent?.replace(/&nbsp;/g, '').trim() ?? ''
        } else {
          content = cell.innerHTML.replace(/&nbsp;/g, '').trim()
        }

        if (!dataHeader) return [`${idx}`, content]
        return [dataHeader, content]
      }),
    )
  }

  private parseRowData(
    rowData: Map<string, string>,
    classCode: string,
    isReplacement: boolean,
  ): JadwalKehadiran | null {
    const dosen = rowData.get('Dosen:')?.split('-')
    if (!dosen) return null

    return {
      kodeDosen: dosen[0]?.trim() ?? '?',
      dosen: dosen[1]?.trim() ?? '?',
      kodeMataKuliah: rowData.get('Kode MK:')?.trim() ?? '?',
      mataKuliah: rowData.get('Nama MK:')?.trim() ?? '?',
      tp: (rowData.get('Teori/Praktek:')?.trim() as 'T' | 'P') ?? '?',
      jamAwal: Number(rowData.get('Awal Jam Ke:') ?? '-1'),
      jamAkhir: Number(rowData.get('Akhir Jam Ke:') ?? '-1'),
      jamPerkuliahan: rowData.get('Jam Perkuliahan:')?.trim() ?? '?',
      kehadiran: rowData.get('Kehadiran:')?.trim() ?? '?',
      kelas: classCode.trim(),
      kuliahPengganti: isReplacement,
    }
  }
}
