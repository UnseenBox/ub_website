// Fails the CrazyGames build if the single-file bundle grows past the budget.
// Usage: node scripts/check-bundle-size.mjs [file] [failBytes] [warnBytes]
import { statSync } from 'node:fs';

const file = process.argv[2] ?? 'dist-crazygames/index.html';
const fail = Number(process.argv[3] ?? 3_000_000);
const warn = Number(process.argv[4] ?? 2_600_000);

let size;
try {
  size = statSync(file).size;
} catch (error) {
  console.error(`check-bundle-size: cannot read ${file}: ${error.message}`);
  process.exit(2);
}
const mb = (size / 1e6).toFixed(2);
if (size > fail) {
  console.error(`check-bundle-size: ${file} is ${mb} MB, over the ${(fail / 1e6).toFixed(2)} MB budget`);
  process.exit(1);
}
if (size > warn) console.warn(`check-bundle-size: ${file} is ${mb} MB (warn above ${(warn / 1e6).toFixed(2)} MB)`);
else console.log(`check-bundle-size: ${file} is ${mb} MB, within budget`);
