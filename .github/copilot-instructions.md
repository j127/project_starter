# AI Coding Agent Instructions

Purpose: Minimal Bun + TypeScript scaffold for an interactive CLI that will add helper/config files to arbitrary target projects. Optimize for: zero build, fast startup, small composable modules.

## Snapshot

- Entry: `index.ts` (current behavior: logs "Hello via Bun!").
- Runtime: Bun executes TS directly (`noEmit`).
- Key deps pre-installed for near-term features: `@inquirer/prompts`, `chalk`, `pino`, `pino-pretty`, `pino-roll`.
- Formatting: `bun run format` (Prettier glob in `package.json`).

## Architectural Intent

- Keep `index.ts` as thin orchestration: parse args → run prompt flow → apply selected templates → summarize.
- Future structure (create only when needed):
  - `src/logger.ts`: singleton pino logger (pretty in TTY).
  - `src/prompts/`: user selection flows.
  - `src/lib/`: pure helpers (e.g. `detectPackageManager`, `writeFileIfMissing`).
  - `templates/`: raw file contents (no logic inside templates).

## Conventions

- ESM only (`type: module`, `module: Preserve`). Avoid implicit extension resolution for non-code assets.
- Prefer dynamic import for optional / heavier modules (e.g. prompts) to keep cold start snappy.
- Idempotent writes: first check existence; never overwrite without explicit user confirmation (design helper: `writeFileIfMissing` returning boolean wrote|skipped).
- Side-effects live at edges; pure functions return data (facilitates later test harness when added).
- Synchronous FS only for quick existence checks; use async for writes/batches.

## Near-Term Roadmap (Incremental)

1. Implement logger factory.
2. Add arg parsing (manual or tiny lib; keep dependency weight low—evaluate before adding).
3. Scaffold first template (e.g. `.editorconfig`) + safe write helper.
4. Interactive multi-select prompt for which templates to apply.
5. Colored summary (added / skipped) using `chalk` and logger.

## Edge / Foresight

- Plan for cross-platform paths (normalize internally to POSIX; defer Windows nuances until real need).
- Keep template rendering simple (string replace / minimal interpolation) until complexity justifies a lib.
- Logging: default pretty in TTY, plain JSON otherwise (paves way for rolling file output later via `pino-roll`).

## Explicit Non-Goals (for now)

- No test framework (will likely adopt `vitest` once logic surface area grows).
- No global install (`bun link`) until CLI flow stabilizes.
- No plugin system; internal modules only.

## Quick Examples

Logger pattern:

```ts
import pino from "pino";
let logger: pino.Logger;
export function getLogger() {
  return (logger ||= pino(
    process.stdout.isTTY ? { transport: { target: "pino-pretty" } } : {}
  ));
}
```

Safe write:

```ts
export async function writeFileIfMissing(p: string, c: string) {
  try {
    await Bun.file(p).text();
    return false;
  } catch {
    await Bun.write(p, c);
    return true;
  }
}
```

## Agent Tips

- Keep PRs small: one capability (logger, arg parsing, first template, etc.).
- Update this file when introducing a new directory-level pattern.
- Prefer adding minimal real code over expanding roadmap text.
