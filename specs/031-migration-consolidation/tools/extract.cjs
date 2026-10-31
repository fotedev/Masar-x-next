// Extract the first string value from a Management API query result and
// append it to the target baseline fragment file. Fails loudly on errors.
const fs = require("fs");
const [resultFile, targetFile, sectionTitle] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(resultFile, "utf8"));
const row = Array.isArray(r) ? r[0] : r;
if (!row || row.error || (row.message && !Object.values(row).some((v) => typeof v === "string" && v.length > 0))) {
  console.error("FAILED", resultFile, JSON.stringify(row).slice(0, 300));
  process.exit(1);
}
const val = Object.values(row).find((v) => typeof v === "string");
if (val === undefined) {
  console.error("NO-STRING", resultFile, JSON.stringify(row).slice(0, 300));
  process.exit(1);
}
fs.appendFileSync(targetFile, `\n-- ===== ${sectionTitle} =====\n` + val + "\n");
console.log("OK", sectionTitle, val.length, "chars");
