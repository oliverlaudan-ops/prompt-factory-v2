/**
 * prompt-variables.test.ts
 *
 * Standalone Node test script — run with:  npx tsx src/lib/__tests__/prompt-variables.test.ts
 * No test framework; uses a tiny hand-rolled assert harness.
 */

import {
  extractVariables,
  hasVariables,
  renderTemplate,
  validateVariableName,
} from "../prompt-variables";

// --- tiny test harness -------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assertEqual<T>(label: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    failures.push(`FAIL  ${label}\n      expected: ${e}\n      actual:   ${a}`);
  }
}

function assertTrue(label: string, condition: boolean): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(`FAIL  ${label}  (expected true, got false)`);
  }
}

function assertFalse(label: string, condition: boolean): void {
  if (!condition) {
    passed++;
  } else {
    failed++;
    failures.push(`FAIL  ${label}  (expected false, got true)`);
  }
}

// --- tests -------------------------------------------------------------------

// 1. extractVariables on a sample with 4 distinct vars, including duplicates
{
  const content =
    "Du bist ein {{TONFALL}} Assistent für {{ZIELGRUPPE}}. " +
    "Thema: {{THEMA}}. Antworte im Stil: {{TONFALL}}. " +
    "Nochmal Thema: {{THEMA}}.";
  const vars = extractVariables(content);
  assertEqual(
    "extractVariables returns 4 unique vars (duplicates collapsed)",
    vars,
    ["THEMA", "TONFALL", "ZIELGRUPPE"]
  );
  assertEqual(
    "extractVariables result has length 3 (not 5)",
    vars.length,
    3
  );
}

// 2. extractVariables is sorted
{
  const content = "{{ZEBRA}} {{ALPHA}} {{MIKE}} {{BRAVO}}";
  const vars = extractVariables(content);
  assertEqual(
    "extractVariables returns sorted result",
    vars,
    ["ALPHA", "BRAVO", "MIKE", "ZEBRA"]
  );
}

// 3. hasVariables true / false
{
  assertTrue(
    "hasVariables true on content with {{FOO}}",
    hasVariables("Hallo {{FOO}} Welt")
  );
  assertTrue(
    "hasVariables true with whitespace inside braces",
    hasVariables("Hallo {{ FOO }} Welt")
  );
  assertFalse(
    "hasVariables false on plain text",
    hasVariables("Hallo Welt ohne Variablen")
  );
  assertFalse(
    "hasVariables false on lowercase {{foo}}",
    hasVariables("Hallo {{foo}} Welt")
  );
  assertFalse(
    "hasVariables false on empty string",
    hasVariables("")
  );
}

// 4a. renderTemplate with full values
{
  const content = "Du bist ein {{TONFALL}} Assistent für {{ZIELGRUPPE}}.";
  const out = renderTemplate(content, {
    TONFALL: "freundlich",
    ZIELGRUPPE: "Anfänger",
  });
  assertEqual(
    "renderTemplate with full values",
    out,
    "Du bist ein freundlich Assistent für Anfänger."
  );
}

// 4b. renderTemplate with partial values — missing placeholder stays
{
  const content = "Du bist ein {{TONFALL}} Assistent für {{ZIELGRUPPE}}.";
  const out = renderTemplate(content, { TONFALL: "freundlich" });
  assertEqual(
    "renderTemplate with partial values keeps {{ZIELGRUPPE}}",
    out,
    "Du bist ein freundlich Assistent für {{ZIELGRUPPE}}."
  );
  // Also verify that the same pattern with whitespace inside braces is preserved.
  const content2 = "Hallo {{ TONFALL }} und {{ZIELGRUPPE}}";
  const out2 = renderTemplate(content2, { ZIELGRUPPE: "Anfänger" });
  assertEqual(
    "renderTemplate preserves whitespace when placeholder stays",
    out2,
    "Hallo {{ TONFALL }} und Anfänger"
  );
}

// 4c. renderTemplate with no values
{
  const content = "Hallo {{A}} und {{B}}";
  const out = renderTemplate(content, {});
  assertEqual(
    "renderTemplate with no values leaves everything",
    out,
    "Hallo {{A}} und {{B}}"
  );
  // And with undefined values map
  const out2 = renderTemplate(content, undefined as unknown as Record<string, string>);
  assertEqual(
    "renderTemplate tolerates undefined values map",
    out2,
    "Hallo {{A}} und {{B}}"
  );
}

// 5. validateVariableName accepts good names, rejects bad ones
{
  assertTrue("validateVariableName accepts 'THEMA'", validateVariableName("THEMA"));
  assertTrue("validateVariableName accepts 'VAR_2'", validateVariableName("VAR_2"));
  assertTrue("validateVariableName accepts 'A'", validateVariableName("A"));
  assertTrue("validateVariableName accepts 'A_B_C_1'", validateVariableName("A_B_C_1"));
  assertTrue("validateVariableName accepts 'X9'", validateVariableName("X9"));

  assertFalse("validateVariableName rejects 'lowercase'", validateVariableName("lowercase"));
  assertFalse("validateVariableName rejects '1FOO'", validateVariableName("1FOO"));
  assertFalse("validateVariableName rejects '_FOO'", validateVariableName("_FOO"));
  assertFalse("validateVariableName rejects 'FOO-BAR'", validateVariableName("FOO-BAR"));
  assertFalse("validateVariableName rejects ''", validateVariableName(""));
  assertFalse("validateVariableName rejects 'FOO.BAR'", validateVariableName("FOO.BAR"));
  assertFalse("validateVariableName rejects 'FOO BAR'", validateVariableName("FOO BAR"));
}

// --- summary -----------------------------------------------------------------

console.log("");
for (const f of failures) console.log(f);
console.log("");
console.log(`Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);

if (failed === 0) {
  console.log("PASS");
  process.exit(0);
} else {
  console.log("FAIL");
  process.exit(1);
}
