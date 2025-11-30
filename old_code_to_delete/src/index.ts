import path from "path";
import chalk from "chalk";
import { getLogger } from "./logger";
import { askQuestions, askInstall, askOverwrite } from "./prompts/ask";
import { fileExists, writeRenderedTemplate } from "./lib/fsHelpers";
import type { Answers, WriteResult } from "./types";
import { spawn } from "bun";

async function maybeInstallPlugins(ans: Answers) {
    const plugins: string[] = [];
    if (ans.prettier_plugin_astro) plugins.push("prettier-plugin-astro");
    if (ans.prettier_plugin_tailwindcss)
        plugins.push("prettier-plugin-tailwindcss");
    if (!plugins.length) return;
    const consent = await askInstall(true);
    if (!consent) return;
    const pm = ans.package_manager;
    const argsMap: Record<string, string[]> = {
        bun: ["add", "-d", ...plugins],
        pnpm: ["add", "-D", ...plugins],
        yarn: ["add", "-D", ...plugins],
        npm: ["install", "-D", ...plugins],
    };
    const args = argsMap[pm]!; // pm is constrained to keys
    getLogger().info({ pm, plugins }, "installing prettier plugins");
    const proc = spawn({
        cmd: [pm, ...args],
        cwd: ans.targetDir,
        stdout: "inherit",
        stderr: "inherit",
    });
    await proc.exited;
}

async function run() {
    const logger = getLogger();
    logger.info("Starting interactive project starter CLI");
    const answers = await askQuestions();
    const templatesDir = path.resolve(__dirname, "../templates");
    const results: WriteResult[] = [];
    for (const file of answers.files) {
        const targetPath = path.join(answers.targetDir, file);
        let overwrite = false;
        let backup = false;
        if (await fileExists(targetPath)) {
            const decision = await askOverwrite(file);
            overwrite = decision.overwrite;
            backup = decision.backup;
        }
        const res = await writeRenderedTemplate(
            templatesDir,
            answers.targetDir,
            file,
            answers,
            backup,
            overwrite
        );
        results.push(res);
    }
    await maybeInstallPlugins(answers);

    // Summary
    const grouped = results.reduce<Record<string, WriteResult[]>>((acc, r) => {
        (acc[r.action] ||= []).push(r);
        return acc;
    }, {});
    const lines: string[] = [];
    for (const action of ["created", "overwritten", "skipped", "error"]) {
        const list = grouped[action];
        if (!list || !list.length) continue;
        const color =
            action === "created"
                ? chalk.green
                : action === "overwritten"
                  ? chalk.yellow
                  : action === "skipped"
                    ? chalk.gray
                    : chalk.red;
        lines.push(color(`${action}: ${list.map((l) => l.file).join(", ")}`));
    }
    console.log("\n" + chalk.bold("Summary:"));
    console.log(lines.join("\n"));
    logger.info("Done");
}

run().catch((err) => {
    getLogger().error({ err }, "CLI failed");
    process.exit(1);
});
