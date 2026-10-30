const fs = require('fs');
const p = 'src/entities/EnemyTypes.ts';
let s = fs.readFileSync(p, 'utf8');
const regex = /(    signature: \{[^}]+\},\n    death: \{[^}]+\},)\n    signature: \{[^}]+\},\n    death: \{[^}]+\},/g;
s = s.replace(regex, '$1');
fs.writeFileSync(p, s, 'utf8');
console.log('replaced duplicates');
