#!/usr/bin/env bun
import { checkbox, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import fs from "fs/promises";
import nunjucks from "nunjucks";
import path from "path";
import pino from "pino";
import pinoPretty from "pino-pretty";
import prettier from "prettier";

const CLAUDE_NO_AI_ATTRIBUTION_PAIR = "__claude_no_ai_attribution_pair__";
const GEMINI_SETTINGS = "__gemini_settings__";

type TemplateTarget = {
  displayPath: string;
  executable?: boolean;
  targetPath: string;
  templatePath: string;
};

const logger = pino(
  pinoPretty({
    colorize: true,
    ignore: "pid,hostname",
    translateTime: "SYS:standard",
  })
);

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function renderTemplate(
  file: string,
  templatePath: string,
  context: Record<string, boolean | number | string>
) {
  const templateContent = await fs.readFile(templatePath, "utf-8");

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

async function main() {
  logger.info("Welcome to the Project Starter CLI!");

  const templatesDir = path.join(import.meta.dir, "../templates");

  let templateFiles: string[] = [];
  try {
    const templateEntries = await fs.readdir(templatesDir, {
      withFileTypes: true,
    });
    templateFiles = templateEntries
      .filter((entry) => entry.isFile() && entry.name !== ".DS_Store")
      .map((entry) => entry.name);
  } catch (error) {
    logger.error({ err: error }, "Failed to read templates directory");
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

  const claudePairTargets: TemplateTarget[] = [
    {
      displayPath: ".claude/hooks/no-ai-attribution.sh",
      executable: true,
      targetPath: path.join(
        process.cwd(),
        ".claude/hooks/no-ai-attribution.sh"
      ),
      templatePath: path.join(
        templatesDir,
        ".claude/hooks/no-ai-attribution.sh"
      ),
    },
    {
      displayPath: ".claude/settings.json",
      targetPath: path.join(process.cwd(), ".claude/settings.json"),
      templatePath: path.join(templatesDir, ".claude/settings.json"),
    },
  ];

  const subdirTargets: Record<string, TemplateTarget> = {
    [GEMINI_SETTINGS]: {
      displayPath: ".gemini/settings.json",
      targetPath: path.join(process.cwd(), ".gemini/settings.json"),
      templatePath: path.join(templatesDir, ".gemini/settings.json"),
    },
  };

  if (selectedFiles.includes(CLAUDE_NO_AI_ATTRIBUTION_PAIR)) {
    const existingPairFiles: string[] = [];

    for (const target of claudePairTargets) {
      if (await exists(target.targetPath)) {
        existingPairFiles.push(target.displayPath);
      }
    }

    if (existingPairFiles.length > 0) {
      logger.error(
        `Cannot create .claude no-AI-attribution hook pair because these files already exist: ${existingPairFiles.join(", ")}`
      );
      process.exit(1);
    }
  }

  for (const file of selectedFiles) {
    try {
      if (file === CLAUDE_NO_AI_ATTRIBUTION_PAIR) {
        for (const target of claudePairTargets) {
          const rendered = await renderTemplate(
            target.displayPath,
            target.templatePath,
            renderContext
          );

          await fs.mkdir(path.dirname(target.targetPath), { recursive: true });
          await fs.writeFile(target.targetPath, rendered);

          if (target.executable) {
            await fs.chmod(target.targetPath, 0o755);
          }

          logger.info(`Created ${chalk.green(target.displayPath)}`);
        }

        continue;
      }

      if (file in subdirTargets) {
        const target = subdirTargets[file];
        const rendered = await renderTemplate(
          target.displayPath,
          target.templatePath,
          renderContext
        );

        await fs.mkdir(path.dirname(target.targetPath), { recursive: true });
        await fs.writeFile(target.targetPath, rendered);
        logger.info(`Created ${chalk.green(target.displayPath)}`);

        continue;
      }

      const templatePath = path.join(templatesDir, file);
      const targetPath = path.join(process.cwd(), file);
      const rendered = await renderTemplate(file, templatePath, renderContext);

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, rendered);
      logger.info(`Created ${chalk.green(file)}`);
    } catch (error) {
      logger.error({ err: error, file }, "Failed to process file");
    }
  }

  logger.info("Done!");
}

main().catch((err) => {
  logger.error({ err }, "Unexpected error");
  process.exit(1);
});
