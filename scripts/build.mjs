import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');
const esmDir = resolve(dist, 'esm');
const cjsDir = resolve(dist, 'cjs');

function ensureDistRoot() {
  if (!existsSync(dist)) mkdirSync(dist, { recursive: true });
}

function writePackageJson() {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const out = {
    name: pkg.name,
    version: pkg.version,
    type: 'module',
    main: './index.cjs',
    module: './index.mjs',
    types: './index.d.ts',
  };
  writeFileSync(resolve(dist, 'package.json'), JSON.stringify(out, null, 2));
}

function moveArtifacts() {
  // Move compiled JS entry points to dist root
  copyFileSync(resolve(esmDir, 'index.js'), resolve(dist, 'index.mjs'));
  copyFileSync(resolve(cjsDir, 'index.js'), resolve(dist, 'index.cjs'));
}

function copyTypes() {
  // copy generated d.ts from ESM build
  copyFileSync(resolve(esmDir, 'index.d.ts'), resolve(dist, 'index.d.ts'));
}

function main() {
  ensureDistRoot();
  writePackageJson();
  moveArtifacts();
  copyTypes();
}

main();

