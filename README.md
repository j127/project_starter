# `project_starter`

An interactive CLI script to add helper files to a project.

This program uses [Bun](https://bun.sh/), so install that first.

It can also generate a paired Claude hook/settings option that creates both
`.claude/hooks/no-ai-attribution.sh` and `.claude/settings.json` together.

To link the project to your system, run:

```bash
cd /path/to/project_starter
bun link
```

Then run the script from any directory:

```bash
project_starter
```
