import { afterEach, describe, expect, it, mock } from "bun:test";
import fs from "fs/promises";
import os from "os";
import path from "path";

mock.module("@inquirer/prompts", () => ({
  checkbox: async () => [],
  input: async () => "",
  select: async () => "",
}));

mock.module("chalk", () => ({
  default: {
    green(value: string) {
      return value;
    },
  },
}));

mock.module("nunjucks", () => ({
  default: {
    configure() {},
    renderString(template: string) {
      return template;
    },
  },
}));

mock.module("pino", () => ({
  default: () => ({
    error() {},
    info() {},
    warn() {},
  }),
}));

mock.module("pino-pretty", () => ({
  default: () => ({}),
}));

mock.module("prettier", () => ({
  default: {
    async format(value: string) {
      return value;
    },
  },
}));

const { CLAUDE_NO_AI_ATTRIBUTION_PAIR, generateSelectedFiles } = await import(
  "./index"
);

const templatesDir = path.join(import.meta.dir, "../templates");
const renderContext = {
  indent_size: 2,
  indent_style: "space",
  max_line_length: "200",
  prettier_plugin_astro: false,
  prettier_plugin_tailwindcss: false,
} as const;

const silentLogger = {
  error() {},
  info() {},
  warn() {},
};

const tempDirs: string[] = [];

async function makeTempDir() {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "project-starter-test-")
  );
  tempDirs.push(tempDir);
  return tempDir;
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).reverse().map((tempDir) =>
      fs.rm(tempDir, { force: true, recursive: true })
    )
  );
});

describe("generateSelectedFiles", () => {
  it("writes a justfile that points at scripts/clean.sh", async () => {
    const destinationDir = await makeTempDir();

    await generateSelectedFiles({
      destinationDir,
      logger: silentLogger,
      renderContext,
      selectedFiles: ["justfile", "clean.sh"],
      templatesDir,
    });

    const justfile = await fs.readFile(
      path.join(destinationDir, "justfile"),
      "utf-8"
    );

    expect(justfile).toContain("./scripts/clean.sh");
    expect(await fileExists(path.join(destinationDir, "scripts/clean.sh"))).toBe(
      true
    );
  });

  it("fails before writing when any selected target already exists", async () => {
    const destinationDir = await makeTempDir();
    const gitignorePath = path.join(destinationDir, ".gitignore");
    await fs.writeFile(gitignorePath, "keep me\n");

    await expect(
      generateSelectedFiles({
        destinationDir,
        logger: silentLogger,
        renderContext,
        selectedFiles: [".gitignore", "justfile"],
        templatesDir,
      })
    ).rejects.toThrow(
      "Cannot create files because these files already exist: .gitignore"
    );

    expect(await fs.readFile(gitignorePath, "utf-8")).toBe("keep me\n");
    expect(await fileExists(path.join(destinationDir, "justfile"))).toBe(false);
  });

  it("rolls back files and rejects when a write fails mid-generation", async () => {
    const destinationDir = await makeTempDir();
    let writeAttempts = 0;

    const failingFs = {
      access: fs.access,
      chmod: fs.chmod,
      mkdir: fs.mkdir,
      readFile: fs.readFile,
      readdir: fs.readdir,
      unlink: fs.unlink,
      async writeFile(...args: Parameters<typeof fs.writeFile>) {
        writeAttempts += 1;
        if (writeAttempts === 2) {
          throw new Error("disk full");
        }

        return fs.writeFile(...args);
      },
    };

    await expect(
      generateSelectedFiles({
        destinationDir,
        fileSystem: failingFs,
        logger: silentLogger,
        renderContext,
        selectedFiles: [CLAUDE_NO_AI_ATTRIBUTION_PAIR],
        templatesDir,
      })
    ).rejects.toThrow("Failed to generate files");

    expect(
      await fileExists(
        path.join(destinationDir, ".claude/hooks/no-ai-attribution.sh")
      )
    ).toBe(false);
    expect(
      await fileExists(path.join(destinationDir, ".claude/settings.json"))
    ).toBe(false);
  });
});
