#!/usr/bin/env node
/**
 * Semantic Versioning Manager for Whisper Desktop (Windows & Linux Tauri v2)
 * Keeps package.json, src-tauri/Cargo.toml, src-tauri/tauri.conf.json, and VERSION in sync.
 *
 * Usage:
 *   npm run version:patch   (1.0.0 -> 1.0.1)
 *   npm run version:minor   (1.0.0 -> 1.1.0)
 *   npm run version:major   (1.0.0 -> 2.0.0)
 *   node scripts/bump-version.mjs 1.2.3
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const pkgPath = path.join(rootDir, 'package.json');
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
const versionFilePath = path.join(rootDir, 'VERSION');

const arg = process.argv[2] || 'patch';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = (pkg.version || '1.0.0').trim();
const parts = currentVersion.split('.').map((n) => parseInt(n, 10) || 0);

let nextVersion = currentVersion;
if (arg === 'patch') {
  nextVersion = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
} else if (arg === 'minor') {
  nextVersion = `${parts[0]}.${parts[1] + 1}.0`;
} else if (arg === 'major') {
  nextVersion = `${parts[0] + 1}.0.0`;
} else if (/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(arg)) {
  nextVersion = arg;
} else {
  console.error(`Invalid version argument: ${arg}. Use patch, minor, major, or X.Y.Z`);
  process.exit(1);
}

// 1. Update package.json
pkg.version = nextVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// 2. Update src-tauri/tauri.conf.json
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = nextVersion;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');

// 3. Update src-tauri/Cargo.toml
let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(
  /^(version\s*=\s*")[^"]+(")/m,
  `$1${nextVersion}$2`
);
fs.writeFileSync(cargoTomlPath, cargoToml, 'utf8');

// 4. Update VERSION file
fs.writeFileSync(versionFilePath, `${nextVersion}\n`, 'utf8');

console.log(`Synchronized version v${nextVersion} across:`);
console.log(`  - package.json`);
console.log(`  - src-tauri/tauri.conf.json`);
console.log(`  - src-tauri/Cargo.toml`);
console.log(`  - VERSION`);

if (process.argv.includes('--tag')) {
  try {
    execSync('git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml VERSION', {
      stdio: 'inherit',
    });
    execSync(`git commit -m "chore(release): v${nextVersion}"`, { stdio: 'inherit' });
    execSync(`git tag -a v${nextVersion} -m "Release v${nextVersion}"`, {
      stdio: 'inherit',
    });
    console.log(`Created git commit and tag v${nextVersion}. Run: git push --follow-tags`);
  } catch (err) {
    console.warn('Updated files on disk (git commit/tag skipped).');
  }
}
