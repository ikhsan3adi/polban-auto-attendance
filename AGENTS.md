# Agent Instructions for polban-auto-attendance

## Development

- Run application: `bun start` (executes `src/main.ts`)
- Code formatting: Prettier `bun run prettier --write .`
- Type checking: Uses Bun's built-in TypeScript support (no separate typecheck step)

## Notes

- Entrypoint: `src/main.ts`
- No test suite currently exists
- GitHub Actions workflow runs Mon-Fri at 07:17 WIB (uses 00:17 UTC to avoid scheduling queue congestion)
- Uses Bun runtime, jsdom for HTML parsing, Telegram Bot API for notifications

## Code Style

1. No emoji (except telegram message text)
2. Use english if possible
3. No unnecessary comments, only critical & meaningful one
4. Don't too verbose
5. Embrace modularity with simplicity
