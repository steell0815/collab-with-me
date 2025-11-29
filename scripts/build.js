import { cpSync, rmSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const distDir = resolve(root, 'dist');

try {
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });
  cpSync(publicDir, distDir, { recursive: true });
  console.log(`Copied public -> dist`);
} catch (err) {
  console.error('Build failed', err);
  process.exit(1);
}
