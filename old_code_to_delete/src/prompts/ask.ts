import path from "path";
import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { listTemplateFiles } from "../lib/fsHelpers";
import type { Answers } from "../types";

export async function askQuestions(): Promise<Answers> {
    const targetDir = process.cwd();
    const templatesDir = path.resolve(__dirname, "../../templates");
    const files = await listTemplateFiles(templatesDir);

    const chosenFiles = await checkbox<string>({
        message: "Select template files to generate",
        choices: files.map((f) => ({ name: f, value: f, checked: true })),
        loop: false,
    });

    const package_manager = await select<Answers["package_manager"]>({
        message: "Package manager?",
        default: "bun",
        choices: ["bun", "pnpm", "yarn", "npm"],
    });

    const indent_style = await select<Answers["indent_style"]>({
        message: "Indent style?",
        default: "space",
        choices: ["space", "tab"],
    });

    const indent_sizeStr = await select<string>({
        message: "Indent size?",
        default: "2",
        choices: ["2", "4"].map((v) => ({ value: v })),
    });
    const indent_size = Number(indent_sizeStr) as 2 | 4;

    const max_line_lengthStr = await input({
        message: "Max line length (flake8)?",
        default: "200",
        validate: (v) => (/^\d+$/.test(v) ? true : "Enter a number"),
    });
    const max_line_length = Number(max_line_lengthStr);

    const prettier_plugin_astro = await confirm({
        message: "Include prettier-plugin-astro?",
        default: false,
    });
    const prettier_plugin_tailwindcss = await confirm({
        message: "Include prettier-plugin-tailwindcss?",
        default: false,
    });

    return {
        package_manager,
        max_line_length,
        indent_style,
        indent_size,
        prettier_plugin_astro,
        prettier_plugin_tailwindcss,
        files: chosenFiles,
        targetDir,
    };
}

export interface OverwriteDecision {
    overwrite: boolean;
    backup: boolean;
}

export async function askOverwrite(
    filename: string
): Promise<OverwriteDecision> {
    const overwrite = await confirm({
        message: `File ${filename} exists. Overwrite?`,
        default: false,
    });
    let backup = false;
    if (overwrite) {
        backup = await confirm({
            message: "Backup existing file (.bak)?",
            default: true,
        });
    }
    return { overwrite, backup };
}

export async function askInstall(need: boolean): Promise<boolean> {
    if (!need) return false;
    return await confirm({
        message: "Install selected Prettier plugins now?",
        default: true,
    });
}
