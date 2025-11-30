# AI Coding Agent Instructions

I'm building a CLI tool that will add helper/config files to arbitrary target projects. Optimize for: zero build, fast startup, small composable modules.

- Runtime: Bun executes TS directly
- Key deps pre-installed for near-term features: `@inquirer/prompts`, `chalk`, `pino`, `pino-pretty`, `pino-roll`.
- Formatting: `bun run format` (Prettier glob in `package.json`).

The CLI will ask a few questions and then add relevant templates to the project.

The templates aren't in final shape at the moment. Another AI coding agent made a mess with them. The old code is in the `old_code_to_delete` folder, and it will be deleted.
