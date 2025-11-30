import { promises as fs } from "fs";
import path from "path";
import { renderTemplate } from "./renderTemplate";
import type { Answers, WriteResult } from "../types";

export async function listTemplateFiles(
    templatesDir: string
): Promise<string[]> {
    const entries = await fs.readdir(templatesDir);
    return entries.filter((f) => !f.endsWith(".DS_Store"));
}

export async function readTemplate(templatesDir: string, filename: string) {
    const full = path.join(templatesDir, filename);
    return await fs.readFile(full, "utf8");
}

export async function writeRenderedTemplate(
    templatesDir: string,
    targetDir: string,
    filename: string,
    answers: Answers,
    backupChoice: boolean,
    overwrite: boolean
): Promise<WriteResult> {
    const targetPath = path.join(targetDir, filename);
    try {
        const exists = await fileExists(targetPath);
        if (exists && !overwrite) {
            return { file: filename, action: "skipped" };
        }
        if (exists && overwrite && backupChoice) {
            const backupPath = targetPath + ".bak";
            await fs.copyFile(targetPath, backupPath);
        }
        const raw = await readTemplate(templatesDir, filename);
        const rendered = renderTemplate(raw, answers as any);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, rendered, "utf8");
        return {
            file: filename,
            action: exists ? "overwritten" : "created",
            backup: exists && backupChoice ? filename + ".bak" : undefined,
        };
    } catch (error) {
        return { file: filename, action: "error", error };
    }
}

export async function fileExists(p: string) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}
