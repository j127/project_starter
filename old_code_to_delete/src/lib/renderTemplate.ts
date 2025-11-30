/*
 Simple mini-templating supporting:
  - {% if var %} ... {% endif %}
  - {% if var == "value" %} / != value (string/number)
  - {% else %}
  - Variable interpolation: {{ var }} and {% var %}
 This is intentionally tiny – not a full parser; good enough for current templates.
*/

const IF_BLOCK_RE = /{%\s*if\s+([^%]+?)%}([\s\S]*?){%\s*endif\s*%}/g;

interface Ctx {
    [k: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function evalCond(expr: string, ctx: Ctx): boolean {
    const trimmed = expr.trim();
    // Support: var, var == value, var != value
    const m = trimmed.match(/^(\w+)(?:\s*(==|!=)\s*(.+))?$/);
    if (!m) return false;
    const [, varName, op, rhsRaw] = m as [string, string, string?, string?];
    const lhs = (ctx as Record<string, unknown>)[varName];
    if (!op) return Boolean(lhs);
    let rhs: any = rhsRaw?.trim() ?? ""; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (
        (rhs.startsWith('"') && rhs.endsWith('"')) ||
        (rhs.startsWith("'") && rhs.endsWith("'"))
    ) {
        rhs = rhs.slice(1, -1);
    } else if (/^\d+$/.test(rhs)) {
        rhs = Number(rhs);
    }
    if (op === "==") return lhs === rhs;
    if (op === "!=") return lhs !== rhs;
    return false;
}

export function renderTemplate(raw: string, context: Ctx): string {
    // First, resolve if/else blocks iteratively until none left (nested not expected now).
    let output = raw;
    let safety = 0;
    while (IF_BLOCK_RE.test(output) && safety < 50) {
        safety++;
        output = output.replace(
            IF_BLOCK_RE,
            (_substring: string, expr: string, body: string) => {
                const parts = body.split(/{%\s*else\s*%}/);
                const truthy = evalCond(expr, context);
                const chosen = truthy ? parts[0] : (parts[1] ?? "");
                return chosen as string; // ensure string
            }
        );
    }

    // Variable substitution {{ var }}
    output = output.replace(
        /{{\s*(\w+)\s*}}/g,
        (_match: string, name: string) => {
            const v = (context as Record<string, unknown>)[name];
            return v === undefined || v === null ? "" : String(v);
        }
    );
    // Also allow {% var %} (non-control) tokens – avoid if/else/endif
    output = output.replace(
        /{%\s*(\w+)\s*%}/g,
        (_match: string, name: string) => {
            if (["if", "else", "endif"].includes(name)) return ""; // control markers removed
            const v = (context as Record<string, unknown>)[name];
            return v === undefined || v === null ? "" : String(v);
        }
    );
    return output.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n"; // collapse excessive blank lines & ensure trailing newline
}
