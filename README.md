# absen-mhs-polban-otomatis

Automated attendance submission for POLBAN students via `akademik.polban.ac.id`.

## How It Works

1. Login to akademik portal using NIM & password
2. Scrape today's schedule from the attendance page
3. Submit attendance for courses not yet marked "Hadir"
4. Re-scrape and print a verification table

## Setup

```bash
bun install
```

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```
USERNAME=24xxxxxxx
PASSWORD=yourpassword
```

## Usage

```bash
bun run index.ts
```

## GitHub Actions (Scheduled)

The workflow runs automatically **Mon-Fri at 07:00 WIB**.

To set it up:

1. Push this repo to GitHub (private recommended)
2. Go to **Settings > Secrets and variables > Actions**
3. Add repository secrets: `USERNAME` and `PASSWORD`
4. The workflow also supports manual trigger via the **Actions** tab

## Tech Stack

- [Bun](https://bun.sh) - Runtime
- [jsdom](https://github.com/jsdom/jsdom) - HTML parsing
