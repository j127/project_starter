/** @type {import("prettier").Config} */
export default {
    endOfLine: "lf",
    semi: true,
    singleQuote: false,
    tabWidth: 4,
    trailingComma: "es5",
    arrowParens: "always",
    plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
    overrides: [
        {
            files: "*.astro",
            options: {
                parser: "astro",
            },
        },
        {
            files: ["*.mdx", "*.md", "*.yaml", "*.yml"],
            options: {
                tabWidth: 2,
            },
        },
    ],
};
