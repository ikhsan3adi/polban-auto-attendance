export interface LoginCredential {
  username: string
  password: string
}

export interface JadwalKehadiran {
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

export interface AbsenReport {
  mode: string
  trigger: string
  submitted: number
  hasFailure: boolean
  jadwal: JadwalKehadiran[]
}
