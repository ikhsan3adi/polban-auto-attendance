import { JSDOM } from 'jsdom'
import {
  BASE_URL,
  ENDPOINTS,
  HTTP_STATUS,
  KEHADIRAN_STATUS,
  REFRESH_SUCCESS_INDICATOR,
  SELECTORS,
  USER_AGENT,
} from './constants'
import { RateLimiter } from './rateLimiter'
import { buildReportMessage, sendTelegramMessage } from './telegram'
import type { JadwalKehadiran, LoginCredential } from './types'
import { sanitizeForLogging, validateCredentials } from './validation'

const rateLimiter = new RateLimiter(2)

async function getSessionCookies(
  credentials: LoginCredential,
): Promise<string> {
  const urlLogin = `${BASE_URL}${ENDPOINTS.LOGIN}`

  try {
    console.info(`Login & get session cookie: ${urlLogin}`)
    await rateLimiter.throttle()

    const initResponse = await fetch(urlLogin, {
      headers: { 'User-Agent': USER_AGENT },
    })

    const initCookie = initResponse.headers.get('Set-Cookie')
    if (!initCookie) throw new Error('Initial Set-Cookie Not Found!')

    const initSession = initCookie.split(';')[0]
    if (!initSession) throw new Error('Failed to extract initial session')

    const body = new URLSearchParams()
    body.append('username', credentials.username)
    body.append('password', credentials.password)
    body.append('submit', 'Sign In')

    await rateLimiter.throttle()
    const response = await fetch(urlLogin, {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
        Referer: urlLogin,
        Origin: BASE_URL,
        Cookie: initSession,
      },
    })

    if (response.status !== HTTP_STATUS.REDIRECT && !response.ok) {
      throw new Error(`Login failed! status: ${response.status}`)
    }

    const refresh = response.headers.get('Refresh')
    if (!refresh || !refresh.includes(REFRESH_SUCCESS_INDICATOR)) {
      throw new Error('Login failed: invalid credentials')
    }

    const cookie = response.headers.get('Set-Cookie')

    return cookie || initCookie
  } catch (error) {
    console.error(
      'Login error:',
      error instanceof Error ? error.message : 'Unknown error',
    )
    process.exit(1)
  }
}

async function scrapeJadwalKehadiranTable(
  session: string,
  tableSelector: string,
  kuliahPengganti = false,
): Promise<JadwalKehadiran[]> {
  const absenPath = kuliahPengganti
    ? ENDPOINTS.ABSEN_PENGGANTI
    : ENDPOINTS.ABSEN
  const urlAbsen = `${BASE_URL}${absenPath}`

  try {
    console.info(`Scraping schedule + attendance table from: ${urlAbsen}`)
    await rateLimiter.throttle()

    const response = await fetch(urlAbsen, {
      headers: {
        Cookie: session,
        'User-Agent': USER_AGENT,
      },
    })

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const html = await response.text()

    const dom = new JSDOM(html)
    const document = dom.window.document

    const table = document.querySelector(tableSelector)
    if (!table) {
      console.info('Table Not Found')
      return []
    }

    const daftarJadwalKehadiran: JadwalKehadiran[] = []

    const kls = table
      .querySelector(SELECTORS.KELAS_INPUT)
      ?.getAttribute('value')

    const rows = table.querySelectorAll('tbody > tr')
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td')

      const rowData = new Map(
        cells.values().map((cell, idx) => {
          const links = cell.querySelectorAll('a, button')
          const dataHeader = cell
            .getAttribute('data-header')
            ?.replace(/&nbsp;/g, '')
            .trim()

          let content: string
          if (links.length > 0 && links[0]) {
            content = links[0]?.textContent.replace(/&nbsp;/g, '').trim()
          } else {
            content = cell.innerHTML.replace(/&nbsp;/g, '').trim()
          }

          if (!dataHeader) return [`${idx}`, content]
          return [dataHeader, content]
        }),
      )

      const dosen = rowData.get('Dosen:')?.split('-')

      const jadwalKehadiran: JadwalKehadiran = {
        kodeDosen: dosen?.[0]?.trim() ?? '?',
        dosen: dosen?.[1]?.trim() ?? '?',
        kodeMataKuliah: rowData.get('Kode MK:')?.trim() ?? '?',
        mataKuliah: rowData.get('Nama MK:')?.trim() ?? '?',
        tp: (rowData.get('Teori/Praktek:')?.trim() as 'T' | 'P') ?? '?',
        jamAwal: Number(rowData.get('Awal Jam Ke:') ?? '-1'),
        jamAkhir: Number(rowData.get('Akhir Jam Ke:') ?? '-1'),
        jamPerkuliahan: rowData.get('Jam Perkuliahan:')?.trim() ?? '?',
        kehadiran: rowData.get('Kehadiran:')?.trim() ?? '?',
        kelas: kls?.trim() ?? '?',
        kuliahPengganti,
      }

      daftarJadwalKehadiran.push(jadwalKehadiran)
    })

    return daftarJadwalKehadiran
  } catch (error) {
    console.error(
      'Scraping error:',
      error instanceof Error ? error.message : 'Unknown error',
    )
    process.exit(1)
  }
}

async function simpanAwal(
  session: string,
  jadwalKehadiran: JadwalKehadiran,
): Promise<void> {
  const absenPath = jadwalKehadiran.kuliahPengganti
    ? ENDPOINTS.SIMPAN_AWAL_PENGGANTI
    : ENDPOINTS.SIMPAN_AWAL
  const urlSimpanAwal = `${BASE_URL}${absenPath}`

  try {
    console.info(
      `Submit: ${jadwalKehadiran.mataKuliah} (${jadwalKehadiran.tp})`,
    )

    const data = {
      ja: jadwalKehadiran.jamAwal.toString(),
      jb: jadwalKehadiran.jamAkhir.toString(),
      mk: jadwalKehadiran.kodeMataKuliah,
      dsn: jadwalKehadiran.kodeDosen,
      tp: jadwalKehadiran.tp,
      kls: jadwalKehadiran.kelas,
    }

    const body = new URLSearchParams(data)

    await rateLimiter.throttle()
    const response = await fetch(urlSimpanAwal, {
      method: 'POST',
      body: body,
      headers: {
        Cookie: session,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
    })

    if (!response.ok) {
      const status = response.status
      throw new Error(`HTTP error! status: ${status}`)
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(
      `Failed to absen ${jadwalKehadiran.mataKuliah}: ${errorMsg}`,
    )
  }
}

const rawUsername = Bun.env.USERNAME
const rawPassword = Bun.env.PASSWORD
const absenPengganti = (Bun.env.KULIAH_PENGGANTI ?? 'true') === 'true'

const credentials: LoginCredential = {
  username: rawUsername ?? '',
  password: rawPassword ?? '',
}

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

const cookieString = await getSessionCookies(credentials)

const session = cookieString.split('; ')[0]
if (!session) {
  console.error('Failed to extract session from cookie')
  process.exit(1)
}

const daftarJadwal = await scrapeJadwalKehadiranTable(
  session,
  SELECTORS.JADWAL_TABLE,
)

if (absenPengganti) {
  const jadwalPengganti = await scrapeJadwalKehadiranTable(
    session,
    SELECTORS.JADWAL_TABLE,
    true,
  )
  daftarJadwal.push(...jadwalPengganti)
}

const notYetPresent = daftarJadwal.filter(
  (j) => j.kehadiran !== KEHADIRAN_STATUS.HADIR,
)

let hasFailure = false
const succeededKeys = new Set<string>()

const getScheduleKey = (j: JadwalKehadiran) =>
  `${j.kodeMataKuliah}|${j.kodeDosen}|${j.jamAwal}`

if (notYetPresent.length > 0) {
  await Promise.allSettled(
    notYetPresent.map((j) =>
      simpanAwal(session, j).then(
        () => {
          succeededKeys.add(getScheduleKey(j))
        },
        (error) => {
          console.error(
            `Submit failed for ${j.mataKuliah}:`,
            error instanceof Error ? error.message : String(error),
          )
          hasFailure = true
        },
      ),
    ),
  )

  console.info(
    `${succeededKeys.size}/${notYetPresent.length} submissions succeeded`,
  )
} else {
  console.info('No pending attendance')
}

const verification = daftarJadwal.map((j) =>
  succeededKeys.has(getScheduleKey(j))
    ? { ...j, kehadiran: KEHADIRAN_STATUS.HADIR_NEW }
    : j,
)

if (verification.length > 0) {
  console.table(
    verification.map((j) => ({
      Dosen: `(${j.kodeDosen}) ${j.dosen}`,
      'Mata Kuliah': `(${j.kodeMataKuliah}) ${j.mataKuliah} (${j.tp})`,
      Jam: j.jamPerkuliahan,
      Kehadiran: j.kehadiran,
      Pengganti: j.kuliahPengganti,
    })),
  )
}

const githubEvent = Bun.env.GITHUB_EVENT_NAME
let trigger = 'Manual'
if (githubEvent === 'schedule') trigger = 'Scheduled Workflow'
if (githubEvent === 'workflow_dispatch') trigger = 'Workflow Dispatch'

const report = buildReportMessage({
  mode: absenPengganti ? 'Normal + Replacement Classes' : 'Normal Classes Only',
  trigger,
  submitted: notYetPresent.length,
  hasFailure,
  jadwal: verification,
})

await sendTelegramMessage(report)

if (hasFailure) process.exit(1)
