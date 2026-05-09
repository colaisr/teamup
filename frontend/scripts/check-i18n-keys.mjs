import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const i18nPath = resolve(process.cwd(), "lib", "i18n.ts");
const baselinePath = resolve(process.cwd(), "scripts", "i18n-key-baseline.json");
const source = readFileSync(i18nPath, "utf8");

function extractDictBlock(name, nextAnchor) {
  const startAnchor = `const ${name}: Dict = {`;
  const start = source.indexOf(startAnchor);
  if (start === -1) {
    throw new Error(`Cannot find dictionary start for ${name}`);
  }
  const end = source.indexOf(nextAnchor, start);
  if (end === -1) {
    throw new Error(`Cannot find dictionary end anchor for ${name}`);
  }
  return source.slice(start + startAnchor.length, end);
}

function extractKeys(block) {
  const keyRegex = /^\s*"([^"]+)":/gm;
  const keys = new Set();
  let match = keyRegex.exec(block);
  while (match) {
    keys.add(match[1]);
    match = keyRegex.exec(block);
  }
  return keys;
}

const ruBlock = extractDictBlock("ru", "\n\nconst en: Dict = {");
const enBlock = extractDictBlock("en", "\n\nconst dictionaries:");

const ruKeys = extractKeys(ruBlock);
const enKeys = extractKeys(enBlock);

const missingInEn = [...ruKeys].filter((key) => !enKeys.has(key)).sort();
const missingInRu = [...enKeys].filter((key) => !ruKeys.has(key)).sort();

const writeBaseline = process.argv.includes("--write-baseline");
if (writeBaseline) {
  writeFileSync(
    baselinePath,
    `${JSON.stringify({ missingInEn, missingInRu }, null, 2)}\n`,
    "utf8"
  );
  console.log(`i18n key baseline written to ${baselinePath}`);
  process.exit(0);
}

let baseline = { missingInEn: [], missingInRu: [] };
if (existsSync(baselinePath)) {
  try {
    const parsed = JSON.parse(readFileSync(baselinePath, "utf8"));
    baseline = {
      missingInEn: Array.isArray(parsed.missingInEn) ? parsed.missingInEn : [],
      missingInRu: Array.isArray(parsed.missingInRu) ? parsed.missingInRu : [],
    };
  } catch (error) {
    console.error(`Failed to parse i18n baseline file: ${baselinePath}`);
    console.error(error);
    process.exit(1);
  }
}

const baselineMissingInEn = new Set(baseline.missingInEn);
const baselineMissingInRu = new Set(baseline.missingInRu);
const unexpectedMissingInEn = missingInEn.filter((key) => !baselineMissingInEn.has(key));
const unexpectedMissingInRu = missingInRu.filter((key) => !baselineMissingInRu.has(key));
const resolvedInEn = baseline.missingInEn.filter((key) => !missingInEn.includes(key));
const resolvedInRu = baseline.missingInRu.filter((key) => !missingInRu.includes(key));

if (
  unexpectedMissingInEn.length === 0 &&
  unexpectedMissingInRu.length === 0 &&
  resolvedInEn.length === 0 &&
  resolvedInRu.length === 0
) {
  console.log("i18n key parity check passed: no new dictionary drift vs baseline.");
  process.exit(0);
}

console.error("i18n key parity check failed.");
if (unexpectedMissingInEn.length > 0) {
  console.error(`New missing in en (${unexpectedMissingInEn.length}):`);
  for (const key of unexpectedMissingInEn) console.error(`  - ${key}`);
}
if (unexpectedMissingInRu.length > 0) {
  console.error(`New missing in ru (${unexpectedMissingInRu.length}):`);
  for (const key of unexpectedMissingInRu) console.error(`  - ${key}`);
}
if (resolvedInEn.length > 0 || resolvedInRu.length > 0) {
  console.error("Some baseline gaps were resolved. Refresh baseline:");
  console.error("  npm run i18n:baseline");
}
process.exit(1);
