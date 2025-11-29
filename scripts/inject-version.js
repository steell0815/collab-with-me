import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const version = process.env.APP_VERSION || '0.0.0-local';
const distDir = resolve(process.cwd(), 'dist');
mkdirSync(distDir, { recursive: true });
const outPath = resolve(distDir, 'version.json');

writeFileSync(outPath, JSON.stringify({ version }, null, 2), 'utf-8');
console.log(`Wrote version ${version} to ${outPath}`);
