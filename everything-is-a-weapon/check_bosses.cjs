const fs = require('fs');
const s = fs.readFileSync('src/entities/EnemyTypes.ts', 'utf8');
const sigMatches = [...s.matchAll(/signature:\s*\{[^}]+name:\s*'([^']+)'/g)];
console.log('signature count:', sigMatches.length);
console.log('unique?', new Set(sigMatches.map(m => m[1])).size === sigMatches.length);
console.log('names:', sigMatches.map(m => m[1]).join(', '));
console.log('piano present?', sigMatches.some(m => m[1].includes('PIANO')));
