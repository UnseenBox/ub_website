const fs = require('fs');
const s = fs.readFileSync('src/entities/EnemyTypes.ts', 'utf8');
const idx = s.indexOf('piano: {');
console.log('index', idx);
console.log(s.substring(idx, idx + 800));
