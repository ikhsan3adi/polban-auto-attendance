export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'

export const BASE_URL = 'https://akademik.polban.ac.id'

export const SELECTORS = {
  JADWAL_TABLE: '#jadwal',
  KELAS_INPUT: '#kls',
} as const

export const ENDPOINTS = {
  LOGIN: '/laman/login',
  ABSEN: '/ajar/absen',
  ABSEN_PENGGANTI: '/ajar/absen_ganti',
  SIMPAN_AWAL: '/ajar/absen/absensi_awal',
  SIMPAN_AWAL_PENGGANTI: '/ajar/absen_ganti/absensi_awal',
} as const

export const KEHADIRAN_STATUS = {
  HADIR_NEW: 'Hadir [NEW]',
  HADIR: 'Hadir',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  ALPHA: 'Alpha',
} as const

export const TELEGRAM_API = 'https://api.telegram.org'

export const REFRESH_SUCCESS_INDICATOR = '/Mhs'

export const HTTP_STATUS = {
  REDIRECT: 302,
} as const
