export interface Answers {
    package_manager: "npm" | "yarn" | "pnpm" | "bun";
    max_line_length: number;
    indent_style: "tab" | "space";
    indent_size: 2 | 4;
    prettier_plugin_astro: boolean;
    prettier_plugin_tailwindcss: boolean;
    files: string[]; // selected template filenames
    targetDir: string; // absolute path where files are written
}

export interface WriteResult {
    file: string;
    action: "created" | "skipped" | "overwritten" | "error";
    backup?: string;
    error?: unknown;
}
