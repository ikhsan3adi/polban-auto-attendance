import { JSDOM } from 'jsdom'
import { buildReportMessage, sendTelegramMessage } from './telegram'

interface LoginCredential {
  username: string
  password: string
}

interface JadwalKehadiran {
  kodeDosen: string
  dosen: string
  kodeMataKuliah: string
  mataKuliah: string
  tp: 'T' | 'P'
  jamAwal: number
  jamAkhir: number
  jamPerkuliahan: string
  kehadiran: string
  kelas: string
  kuliahPengganti: boolean
}

const userAgent =
  'Mozilla/5.0 (X11; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0'

const baseUrl = 'https://akademik.polban.ac.id'

async function getSessionCookies(
  credentials: LoginCredential,
): Promise<string> {
  const urlLogin = `${baseUrl}/laman/login`

  try {
    console.info(`Login & get session cookie: ${urlLogin}`)

    const initResponse = await fetch(urlLogin, {
      headers: { 'User-Agent': userAgent },
    })

    const initCookie = initResponse.headers.get('Set-Cookie')
    if (!initCookie) throw new Error('Initial Set-Cookie Not Found!')

    const initSession = initCookie.split(';')[0]!

    const body = new URLSearchParams()
    body.append('username', credentials.username)
    body.append('password', credentials.password)
    body.append('submit', 'Sign In')

    const response = await fetch(urlLogin, {
      method: 'POST',
      body: body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
        Referer: urlLogin,
        Origin: baseUrl,
        Cookie: initSession,
      },
    })

    if (response.status !== 302 && !response.ok) {
      throw new Error(`Login failed! status: ${response.status}`)
    }

    const refresh = response.headers.get('Refresh')
    if (!refresh || !refresh.includes('/Mhs')) {
      throw new Error('Login failed: invalid credentials')
    }

    const cookie = response.headers.get('Set-Cookie')

    if (cookie) return cookie

    return initCookie
  } catch (error) {
    console.error('Error occurred:', error)
    process.exit(1)
  }
}

async function scrapeJadwalKehadiranTable(
  session: string,
  tableSelector: string,
  kuliahPengganti = false,
): Promise<JadwalKehadiran[]> {
  const urlAbsen = `${baseUrl}/ajar/${kuliahPengganti ? 'absen_ganti' : 'absen'}`

  try {
    console.info(`Scraping jadwal + kehadiran table from: ${urlAbsen}`)

    const response = await fetch(urlAbsen, {
      headers: {
        Cookie: session,
        'User-Agent': userAgent,
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

    const kls = table.querySelector('#kls')?.getAttribute('value')

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
        kodeDosen: dosen?.at(0) ?? '?',
        dosen: dosen?.at(1) ?? '?',
        kodeMataKuliah: rowData.get('Kode MK:') ?? '?',
        mataKuliah: rowData.get('Nama MK:') ?? '?',
        tp: (rowData.get('Teori/Praktek:') as 'T' | 'P') ?? '?',
        jamAwal: Number(rowData.get('Awal Jam Ke:') ?? '-1'),
        jamAkhir: Number(rowData.get('Akhir Jam Ke:') ?? '-1'),
        jamPerkuliahan: rowData.get('Jam Perkuliahan:') ?? '?',
        kehadiran: rowData.get('Kehadiran:') ?? '?',
        kelas: kls ?? '?',
        kuliahPengganti,
      }

      daftarJadwalKehadiran.push(jadwalKehadiran)
    })

    return daftarJadwalKehadiran
  } catch (error) {
    console.error('Error occurred:', error)
    process.exit(1)
  }
}

async function simpanAwal(
  session: string,
  jadwalKehadiran: JadwalKehadiran,
): Promise<void> {
  const absenPath = jadwalKehadiran.kuliahPengganti ? 'absen_ganti' : 'absen'
  const urlSimpanAwal = `${baseUrl}/ajar/${absenPath}/absensi_awal`

  try {
    console.info(
      `Simpan Awal: ${urlSimpanAwal}; Mata Kuliah: ${jadwalKehadiran.mataKuliah} (${jadwalKehadiran.tp})`,
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

    const response = await fetch(urlSimpanAwal, {
      method: 'POST',
      body: body,
      headers: {
        Cookie: session,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
      },
    })

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
  } catch (error) {
    throw new Error(`Failed to absen ${jadwalKehadiran.mataKuliah}: ${error}`)
  }
}

const username = Bun.env.USERNAME
const password = Bun.env.PASSWORD
const absenPengganti = (Bun.env.KULIAH_PENGGANTI ?? 'true') === 'true'

if (!username || !password) {
  console.error('USERNAME and PASSWORD env variables are required')
  process.exit(1)
}

const cookieString = await getSessionCookies({ username, password })

const session = cookieString.split('; ')[0]!

const daftarJadwal = await scrapeJadwalKehadiranTable(session, '#jadwal')

if (absenPengganti) {
  const jadwalPengganti = await scrapeJadwalKehadiranTable(
    session,
    '#jadwal',
    true,
  )
  daftarJadwal.push(...jadwalPengganti)
}

const belumHadir = daftarJadwal.filter((j) => j.kehadiran !== 'Hadir')

let hasFailure = false

if (belumHadir.length > 0) {
  const results = await Promise.allSettled(
    belumHadir.map((j) => simpanAwal(session, j)),
  )

  const succeeded = results.filter((r) => r.status === 'fulfilled')
  const failed = results.filter((r) => r.status === 'rejected')

  console.info(`Done: ${succeeded.length}/${belumHadir.length} succeeded`)

  if (failed.length > 0) {
    failed.forEach((r) => console.error(r.reason))
    hasFailure = true
  }
} else {
  console.info('No pending attendance found')
}

const verification = await scrapeJadwalKehadiranTable(session, '#jadwal')

if (absenPengganti) {
  const verifikasiPengganti = await scrapeJadwalKehadiranTable(
    session,
    '#jadwal',
    true,
  )
  verification.push(...verifikasiPengganti)
}

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
let trigger = 'Manual (Terminal)'
if (githubEvent === 'schedule') trigger = 'Scheduled Workflow'
if (githubEvent === 'workflow_dispatch') trigger = 'Manual Workflow'

const report = buildReportMessage({
  mode: absenPengganti
    ? 'Kuliah Normal + Kuliah Pengganti'
    : 'Kuliah Normal Only',
  trigger,
  submitted: belumHadir.length,
  hasFailure,
  jadwal: verification,
})

await sendTelegramMessage(report)

if (hasFailure) process.exit(1)
