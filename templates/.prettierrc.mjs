/** @type {import("prettier").Config} */
export default {
    endOfLine: "lf",
    semi: true,
    singleQuote: false,
    tabWidth: {{ indent_size }},
    trailingComma: "es5",
    arrowParens: "always",
    plugins: [
        {% if prettier_plugin_astro %}
        "prettier-plugin-astro",
        {% endif %}
        {% if prettier_plugin_tailwindcss %}
        "prettier-plugin-tailwindcss",
        {% endif %}
    ],
    overrides: [
        {% if prettier_plugin_astro %}
        {
            files: "*.astro",
            options: {
                parser: "astro",
            },
        },
        {% endif %}
        {% if indent_size != 2 %}
        {
            files: ["*.mdx", "*.md", "*.yaml", "*.yml"],
            options: {
                tabWidth: 2,
            },
        },
        {% endif %}
    ],
};
