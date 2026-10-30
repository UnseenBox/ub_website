const fs = require('fs');
const p = 'src/entities/EnemyTypes.ts';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
const out = [];
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  const prevTrimmed = out.length ? out[out.length - 1].trim() : '';
  if ((trimmed.startsWith('signature:') || trimmed.startsWith('death:')) && prevTrimmed === trimmed) {
    continue; // skip exact duplicate
  }
  out.push(lines[i]);
}
fs.writeFileSync(p, out.join('\n'), 'utf8');
console.log('dedup done, lines:', out.length);
