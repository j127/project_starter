#!/usr/bin/env bun
import { checkbox, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import fs from "fs/promises";
import nunjucks from "nunjucks";
import path from "path";
import pino from "pino";
import pinoPretty from "pino-pretty";
import prettier from "prettier";

export const CLAUDE_NO_AI_ATTRIBUTION_PAIR =
  "__claude_no_ai_attribution_pair__";
export const GEMINI_SETTINGS = "__gemini_settings__";

export type TemplateTarget = {
  displayPath: string;
  executable?: boolean;
  targetPath: string;
  templatePath: string;
};

type FileSystem = Pick<
  typeof fs,
  "access" | "chmod" | "mkdir" | "readFile" | "readdir" | "unlink" | "writeFile"
>;

type Logger = Pick<typeof logger, "error" | "info" | "warn">;
type RenderContext = Record<string, boolean | number | string>;

type GenerateFilesOptions = {
  destinationDir: string;
  fileSystem?: FileSystem;
  logger?: Logger;
  renderContext: RenderContext;
  selectedFiles: string[];
  templatesDir: string;
};

type PreparedTemplate = {
  rendered: string;
  target: TemplateTarget;
};

class ProjectStarterError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProjectStarterError";
  }
}

const logger = pino(
  pinoPretty({
    colorize: true,
    ignore: "pid,hostname",
    translateTime: "SYS:standard",
  })
);

async function exists(filePath: string, fileSystem: FileSystem = fs) {
  try {
    await fileSystem.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function renderTemplate(
  file: string,
  templatePath: string,
  context: RenderContext,
  fileSystem: FileSystem = fs
) {
  const templateContent = await fileSystem.readFile(templatePath, "utf-8");

  let rendered = nunjucks.renderString(templateContent, context);

  if (file.endsWith(".mjs")) {
    rendered = await prettier.format(rendered, {
      parser: "babel",
    });
  }

  if (file === ".editorconfig") {
    // Remove multiple blank lines, leaving max 1
    rendered = rendered.replace(/\n{3,}/g, "\n\n");
  }

  return rendered;
}

export async function listStandaloneTemplateFiles(
  templatesDir: string,
  fileSystem: FileSystem = fs
) {
  try {
    const templateEntries = await fileSystem.readdir(templatesDir, {
      withFileTypes: true,
    });
    return templateEntries
      .filter((entry) => entry.isFile() && entry.name !== ".DS_Store")
      .map((entry) => entry.name);
  } catch (error) {
    throw new ProjectStarterError("Failed to read templates directory", {
      cause: error,
    });
  }
}

function getClaudePairTargets(
  templatesDir: string,
  destinationDir: string
): TemplateTarget[] {
  return [
    {
      displayPath: ".claude/hooks/no-ai-attribution.sh",
      executable: true,
      targetPath: path.join(
        destinationDir,
        ".claude/hooks/no-ai-attribution.sh"
      ),
      templatePath: path.join(
        templatesDir,
        ".claude/hooks/no-ai-attribution.sh"
      ),
    },
    {
      displayPath: ".claude/settings.json",
      targetPath: path.join(destinationDir, ".claude/settings.json"),
      templatePath: path.join(templatesDir, ".claude/settings.json"),
    },
  ];
}

function getSubdirTargets(
  templatesDir: string,
  destinationDir: string
): Record<string, TemplateTarget> {
  return {
    [GEMINI_SETTINGS]: {
      displayPath: ".gemini/settings.json",
      targetPath: path.join(destinationDir, ".gemini/settings.json"),
      templatePath: path.join(templatesDir, ".gemini/settings.json"),
    },
  };
}

export function buildTemplateTargets({
  destinationDir,
  selectedFiles,
  templatesDir,
}: Pick<
  GenerateFilesOptions,
  "destinationDir" | "selectedFiles" | "templatesDir"
>): TemplateTarget[] {
  const claudePairTargets = getClaudePairTargets(templatesDir, destinationDir);
  const subdirTargets = getSubdirTargets(templatesDir, destinationDir);
  const targets: TemplateTarget[] = [];

  for (const file of selectedFiles) {
    if (file === CLAUDE_NO_AI_ATTRIBUTION_PAIR) {
      targets.push(...claudePairTargets);
      continue;
    }

    const subdirTarget = subdirTargets[file];
    if (subdirTarget) {
      targets.push(subdirTarget);
      continue;
    }

    const relativeTargetPath = file === "clean.sh" ? "scripts/clean.sh" : file;
    targets.push({
      displayPath: relativeTargetPath,
      executable: file === "clean.sh",
      targetPath: path.join(destinationDir, relativeTargetPath),
      templatePath: path.join(templatesDir, file),
    });
  }

  return targets;
}

async function assertTargetsDoNotExist(
  targets: TemplateTarget[],
  fileSystem: FileSystem
) {
  const existingTargets: string[] = [];

  for (const target of targets) {
    if (await exists(target.targetPath, fileSystem)) {
      existingTargets.push(target.displayPath);
    }
  }

  if (existingTargets.length > 0) {
    throw new ProjectStarterError(
      `Cannot create files because these files already exist: ${existingTargets.join(", ")}`
    );
  }
}

async function prepareTemplates(
  targets: TemplateTarget[],
  renderContext: RenderContext,
  fileSystem: FileSystem
): Promise<PreparedTemplate[]> {
  const preparedTemplates: PreparedTemplate[] = [];

  for (const target of targets) {
    const rendered = await renderTemplate(
      target.displayPath,
      target.templatePath,
      renderContext,
      fileSystem
    );
    preparedTemplates.push({ rendered, target });
  }

  return preparedTemplates;
}

async function rollbackWrittenTargets(
  writtenTargets: TemplateTarget[],
  fileSystem: FileSystem,
  generationLogger: Logger
) {
  for (const target of [...writtenTargets].reverse()) {
    try {
      await fileSystem.unlink(target.targetPath);
    } catch (error) {
      generationLogger.error(
        { err: error, file: target.displayPath },
        "Failed to rollback file"
      );
    }
  }
}

export async function generateSelectedFiles({
  destinationDir,
  fileSystem = fs,
  logger: generationLogger = logger,
  renderContext,
  selectedFiles,
  templatesDir,
}: GenerateFilesOptions) {
  const targets = buildTemplateTargets({
    destinationDir,
    selectedFiles,
    templatesDir,
  });

  await assertTargetsDoNotExist(targets, fileSystem);

  const preparedTemplates = await prepareTemplates(
    targets,
    renderContext,
    fileSystem
  );
  const writtenTargets: TemplateTarget[] = [];

  try {
    for (const { rendered, target } of preparedTemplates) {
      await fileSystem.mkdir(path.dirname(target.targetPath), {
        recursive: true,
      });
      await fileSystem.writeFile(target.targetPath, rendered);
      writtenTargets.push(target);

      if (target.executable) {
        await fileSystem.chmod(target.targetPath, 0o755);
      }

      generationLogger.info(`Created ${chalk.green(target.displayPath)}`);
    }
  } catch (error) {
    await rollbackWrittenTargets(writtenTargets, fileSystem, generationLogger);
    throw new ProjectStarterError("Failed to generate files", {
      cause: error,
    });
  }

  return targets;
}

function getTemplatesDir() {
  return path.join(import.meta.dir, "../templates");
}

export async function main() {
  logger.info("Welcome to the Project Starter CLI!");

  const templatesDir = getTemplatesDir();

  let templateFiles: string[] = [];
  try {
    templateFiles = await listStandaloneTemplateFiles(templatesDir);
  } catch (error) {
    logger.error(
      { err: error },
      error instanceof Error ? error.message : "Failed to read templates directory"
    );
    process.exit(1);
  }

  if (templateFiles.length === 0) {
    logger.warn("No standalone templates found.");
  }

  nunjucks.configure({
    autoescape: false,
    trimBlocks: true,
    lstripBlocks: true,
  });

  const indentStyle = await select({
    message: "Indentation style",
    choices: [
      { name: "Space", value: "space" },
      { name: "Tab", value: "tab" },
    ],
    default: "space",
  });

  const indentSize = await select({
    message: "Indentation size",
    choices: [
      { name: "2", value: 2 },
      { name: "4", value: 4 },
    ],
    default: 2,
  });

  const maxLineLength = await input({
    message: "Max line length",
    default: "200",
    validate: (value) => !isNaN(Number(value)) || "Please enter a number",
  });

  const selectedFiles = await checkbox({
    message: "Select files to add",
    choices: [
      ...templateFiles.map((file) => ({ name: file, value: file })),
      {
        name: ".claude no-AI-attribution hook pair",
        value: CLAUDE_NO_AI_ATTRIBUTION_PAIR,
      },
      {
        name: ".gemini/settings.json",
        value: GEMINI_SETTINGS,
      },
    ],
  });

  if (selectedFiles.length === 0) {
    logger.info("No files selected. Exiting.");
    return;
  }

  let prettierPluginAstro = false;
  let prettierPluginTailwindcss = false;

  if (selectedFiles.includes(".prettierrc.mjs")) {
    const plugins = await checkbox({
      message: "Select Prettier plugins",
      choices: [
        { name: "prettier-plugin-astro", value: "astro" },
        { name: "prettier-plugin-tailwindcss", value: "tailwindcss" },
      ],
    });
    prettierPluginAstro = plugins.includes("astro");
    prettierPluginTailwindcss = plugins.includes("tailwindcss");
  }

  const renderContext = {
    indent_style: indentStyle,
    indent_size: indentSize,
    max_line_length: maxLineLength,
    prettier_plugin_astro: prettierPluginAstro,
    prettier_plugin_tailwindcss: prettierPluginTailwindcss,
  };

  try {
    await generateSelectedFiles({
      destinationDir: process.cwd(),
      logger,
      renderContext,
      selectedFiles,
      templatesDir,
    });
  } catch (error) {
    logger.error(
      { err: error },
      error instanceof Error ? error.message : "Failed to generate files"
    );
    process.exit(1);
  }

  logger.info("Done!");
}

if (import.meta.main) {
  main().catch((err) => {
    logger.error({ err }, "Unexpected error");
    process.exit(1);
  });
}
