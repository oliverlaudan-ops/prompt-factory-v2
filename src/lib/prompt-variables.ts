/**
 * prompt-variables.ts
 *
 * Pure-function library for detecting and rendering `{{VARIABLE}}` placeholders
 * in prompt content.
 *
 * Variable syntax:
 *   {{NAME}}
 *   - NAME matches /^[A-Z][A-Z0-9_]*$/  (SCREAMING_SNAKE_CASE, must start with a letter)
 *   - No lowercase, no leading digits, no hyphens, no dots, no other punctuation
 *   - Whitespace inside the braces is allowed and ignored: `{{ NAME }}` is
 *     treated as `NAME`. This is intentionally lenient so authors can write
 *     `{{ TONFALL }}` for readability without breaking detection.
 *
 * Edge cases deliberately NOT handled (per spec — keep it simple):
 *   - Nested braces: `{{{FOO}}}` is not a real variable, the inner `{{FOO}}` is
 *     matched by the regex but the outer braces stay in the output.
 *   - Escaped braces: `\{\{FOO\}\}` is not specially treated.
 *   - Mismatched braces: `{{FOO`, `FOO}}`, `{{FOO` are all ignored.
 *
 * No external dependencies — uses only built-in String/RegExp/Array methods.
 */

// Shared pattern. Single source of truth for what counts as a variable token.
// The captured group is the bare name (whitespace already stripped by \s*).
const VARIABLE_PATTERN = /\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g;

// Validation pattern (no anchors inside, callers add their own).
const VALID_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * Extract all variable names from a prompt's content.
 *
 * @returns Sorted, unique, non-empty variable names (without the `{{` / `}}` wrappers).
 *          Duplicates are collapsed; order is lexicographic (deterministic).
 */
export function extractVariables(content: string): string[] {
  if (!content) return [];

  const seen = new Set<string>();
  // Reset lastIndex defensively — global regexes are stateful when reused.
  VARIABLE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = VARIABLE_PATTERN.exec(content)) !== null) {
    const name = match[1];
    if (name) seen.add(name);
  }

  return Array.from(seen).sort();
}

/**
 * Quick check: does this content contain at least one variable?
 * Cheaper than calling `extractVariables(...).length > 0` for short-circuit checks.
 */
export function hasVariables(content: string): boolean {
  if (!content) return false;
  // Use a non-global instance to avoid touching the shared regex's lastIndex.
  return /\{\{\s*[A-Z][A-Z0-9_]*\s*\}\}/.test(content);
}

/**
 * Replace `{{NAME}}` placeholders with the provided values.
 *
 * - Single regex pass.
 * - If a variable has no entry in `values`, the original `{{...}}` substring
 *   is left untouched in the output (including any inner whitespace).
 * - This never throws on missing keys; the caller decides whether missing
 *   variables are an error.
 *
 * @param content - The prompt template text.
 * @param values  - Map of variable name → replacement string.
 */
export function renderTemplate(
  content: string,
  values: Record<string, string>
): string {
  if (!content) return content ?? "";

  // Use a local regex so we don't disturb the module-level pattern's state.
  return content.replace(
    /\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g,
    (_full, name: string) => {
      // `in` covers the "present but undefined" case as missing; that matches
      // the spec ("if a variable has no value, leave the placeholder").
      if (values && Object.prototype.hasOwnProperty.call(values, name)) {
        const v = values[name];
        if (typeof v === "string") return v;
      }
      // No value → keep the original `{{ NAME }}` (with any whitespace) intact.
      return _full;
    }
  );
}

/**
 * Returns true if `name` is a syntactically valid variable name:
 * starts with a capital letter, followed by capital letters, digits, or underscores.
 */
export function validateVariableName(name: string): boolean {
  if (typeof name !== "string" || name.length === 0) return false;
  return VALID_NAME_PATTERN.test(name);
}
