import { writeFileSync } from 'fs';
import { resolve } from 'path';

const version = process.env.APP_VERSION || '0.0.0-local';
const outPath = resolve(process.cwd(), 'public', 'version.json');

writeFileSync(outPath, JSON.stringify({ version }, null, 2), 'utf-8');
console.log(`Wrote version ${version} to ${outPath}`);
