#!/usr/bin/env bun
// Thin root entry so package.json "module" can stay as index.ts while real code lives in src/
import { main } from "./src/index.ts";

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
