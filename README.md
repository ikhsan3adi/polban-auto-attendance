# polban-auto-attendance

Automated attendance submission for POLBAN students on `akademik.polban.ac.id`.

## How It Works

1. Login to akademik portal using NIM & password to get session cookie
2. Scrape today's schedule from the attendance page (normal + kuliah pengganti)
3. Submit attendance for courses not yet marked "Hadir"
4. Re-scrape and print a verification table
5. Send a summary report via Telegram (optional)

## Setup (for development or local usage)

```bash
bun install
```

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in `.env`:

```sh
USERNAME=24xxxxxxx        # MANDATORY, your NIM
PASSWORD=yourpassword     # MANDATORY

KULIAH_PENGGANTI=true     # optional, also process replacement lectures (default: true)

TELEGRAM_BOT_TOKEN=       # optional, from @BotFather
TELEGRAM_CHAT_ID=         # optional, from @userinfobot
```

## Usage

```bash
bun start
```

## Scheduled GitHub Actions

The workflow runs automatically **Mon-Fri at 07:00 WIB**.

To set it up:

1. Push/Fork this repo to GitHub
2. Go to **Settings > Secrets and variables > Actions**
3. Add secrets: `USERNAME`, `PASSWORD`
4. (Optional) Add secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
5. (Optional) Add variable: `KULIAH_PENGGANTI`

> Manual trigger available via **Actions** tab

## Tech Stack

- [Bun](https://bun.sh) -- Runtime
- [jsdom](https://github.com/jsdom/jsdom) -- HTML parsing
- [Telegram Bot API](https://core.telegram.org/bots/api) -- Notifications

## Disclaimer

> **USE AT YOUR OWN RISK**. This tool is for educational purposes only.

Risks of using this tool include, but are not limited to:

- **Absen tanpa hadir fisik** -- Dosen dapat mengecek kehadiran secara manual (absen panggil, dll). Jika tercatat "Hadir" di sistem tapi tidak hadir di kelas, kamu bisa langsung ketahuan.
- **Pola absen tidak wajar** -- Absen otomatis tepat jam 07:00 setiap hari bisa terlihat mencurigakan di log server, terutama jika dosen atau admin memeriksa timestamp kehadiran.
- **Sanksi akademik** -- Pemalsuan kehadiran termasuk pelanggaran akademik yang dapat berakibat teguran, pengurangan nilai, hingga skorsing sesuai peraturan POLBAN.
- **Perubahan sistem** -- Website akademik dapat berubah sewaktu-waktu tanpa pemberitahuan, menyebabkan script gagal atau berperilaku tidak terduga.

**Penulis/Developer tidak bertanggung jawab atas segala konsekuensi yang timbul dari penggunaan tool ini.**
