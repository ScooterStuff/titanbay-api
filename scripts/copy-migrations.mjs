import { cpSync, mkdirSync } from 'node:fs';
// Copy migration .sql files into the compiled output so `node dist/src/...` finds them.
const dest = 'dist/src/db/migrations';
mkdirSync(dest, { recursive: true });
cpSync('src/db/migrations', dest, { recursive: true });
console.log('[build] copied migrations ->', dest);
