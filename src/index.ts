import { checkbox, input, select } from "@inquirer/prompts";
import chalk from "chalk";
import fs from "fs/promises";
import nunjucks from "nunjucks";
import path from "path";
import pino from "pino";
import pinoPretty from "pino-pretty";

const logger = pino(
  pinoPretty({
    colorize: true,
    ignore: "pid,hostname",
    translateTime: "SYS:standard",
  })
);

async function main() {
  logger.info("Welcome to the Project Starter CLI!");

  const templatesDir = path.join(import.meta.dir, "../templates");

  let templateFiles: string[] = [];
  try {
    templateFiles = await fs.readdir(templatesDir);
    // Filter out .DS_Store
    templateFiles = templateFiles.filter((f) => f !== ".DS_Store");
  } catch (error) {
    logger.error({ err: error }, "Failed to read templates directory");
    process.exit(1);
  }

  if (templateFiles.length === 0) {
    logger.warn("No templates found.");
    return;
  }

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

  // const maxLineLength = await input({
  //   message: "Max line length",
  //   default: "80",
  //   validate: (value) => !isNaN(Number(value)) || "Please enter a number",
  // });

  const selectedFiles = await checkbox({
    message: "Select files to add",
    choices: templateFiles.map((file) => ({ name: file, value: file })),
  });

  if (selectedFiles.length === 0) {
    logger.info("No files selected. Exiting.");
    return;
  }

  for (const file of selectedFiles) {
    const templatePath = path.join(templatesDir, file);
    const targetPath = path.join(process.cwd(), file);

    try {
      const templateContent = await fs.readFile(templatePath, "utf-8");

      // Configure nunjucks
      nunjucks.configure({ autoescape: false });
      const rendered = nunjucks.renderString(templateContent, {
        indent_style: indentStyle,
        indent_size: indentSize,
        // max_line_length: maxLineLength,
      });

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
