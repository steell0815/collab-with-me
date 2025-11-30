import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const fallback = '0.0.0-local';
let version = process.env.APP_VERSION || fallback;
try {
  const txtPath = resolve(process.cwd(), 'dist', 'version.txt');
  if ((!process.env.APP_VERSION || process.env.APP_VERSION === fallback) && existsSync(txtPath)) {
    version = readFileSync(txtPath, 'utf-8').trim() || version;
  }
} catch {
  // ignore
}
const distDir = resolve(process.cwd(), 'dist');
mkdirSync(distDir, { recursive: true });
const outPath = resolve(distDir, 'version.json');

writeFileSync(outPath, JSON.stringify({ version }, null, 2), 'utf-8');
console.log(`Wrote version ${version} to ${outPath}`);
