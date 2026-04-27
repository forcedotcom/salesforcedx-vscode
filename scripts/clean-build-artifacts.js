#!/usr/bin/env node
/**
 * Removes compiled outputs and Wireit caches across the repo without deleting
 * node_modules, without `git clean`, and without unlinking npm-linked packages.
 * For full reset (including deps), use `npm run clean`.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

function rmPath(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (err) {
    console.error(`Failed to remove ${p}:`, err.message);
    process.exitCode = 1;
  }
}

function rmIfExists(p) {
  if (fs.existsSync(p)) {
    rmPath(p);
  }
}

function rmVsixInDir(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name.endsWith('.vsix')) {
      rmIfExists(path.join(dir, name));
    }
  }
}

function rmTgzInDir(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name.endsWith('.tgz')) {
      rmIfExists(path.join(dir, name));
    }
  }
}

/** Default outputs matching workspace `clean` scripts minus node_modules. */
function cleanPackageStandard(pkgRoot) {
  for (const d of ['out', 'dist', 'lib', 'coverage', '.nyc_output', '.wireit']) {
    rmIfExists(path.join(pkgRoot, d));
  }
  for (const f of ['.eslintcache', '.circular-deps.json']) {
    rmIfExists(path.join(pkgRoot, f));
  }
  rmVsixInDir(pkgRoot);
  rmIfExists(path.join(pkgRoot, 'tsconfig.tsbuildinfo'));
}

function cleanGithubActionsLib() {
  const actionsRoot = path.join(repoRoot, '.github', 'actions');
  if (!fs.existsSync(actionsRoot)) {
    return;
  }
  for (const name of fs.readdirSync(actionsRoot)) {
    rmIfExists(path.join(actionsRoot, name, 'lib'));
  }
}

/** Aligns with packages/salesforcedx-vscode-apex `clean` but skips node_modules. */
function cleanApexPackage(pkgRoot) {
  for (const d of ['dist', 'lib', 'coverage', '.nyc_output', '.wireit']) {
    rmIfExists(path.join(pkgRoot, d));
  }
  for (const f of ['.eslintcache', '.circular-deps.json']) {
    rmIfExists(path.join(pkgRoot, f));
  }
  rmVsixInDir(pkgRoot);
  rmIfExists(path.join(pkgRoot, 'tsconfig.tsbuildinfo'));
  const outDir = path.join(pkgRoot, 'out');
  if (fs.existsSync(outDir)) {
    const jarCleaner = path.join(repoRoot, 'scripts', 'clean-all-but-jar.js');
    const r = spawnSync(process.execPath, [jarCleaner], {
      cwd: outDir,
      stdio: 'inherit'
    });
    if (r.status !== 0) {
      process.exitCode = r.status ?? 1;
    }
  }
}

function cleanServicesTypes(pkgRoot) {
  for (const d of ['out', 'dist', '.wireit']) {
    rmIfExists(path.join(pkgRoot, d));
  }
  rmIfExists(path.join(pkgRoot, '.eslintcache'));
  rmTgzInDir(pkgRoot);
}

function main() {
  rmIfExists(path.join(repoRoot, '.wireit'));
  rmIfExists(path.join(repoRoot, 'coverage'));
  cleanGithubActionsLib();

  const packagesDir = path.join(repoRoot, 'packages');
  const names = fs.readdirSync(packagesDir, { withFileTypes: true });
  for (const ent of names) {
    if (!ent.isDirectory()) {
      continue;
    }
    const pkgRoot = path.join(packagesDir, ent.name);
    switch (ent.name) {
      case 'salesforcedx-vscode-apex':
        cleanApexPackage(pkgRoot);
        break;
      case 'salesforcedx-vscode-services':
        cleanPackageStandard(pkgRoot);
        rmIfExists(path.join(pkgRoot, 'resources'));
        break;
      case 'salesforcedx-vscode-services-types':
        cleanServicesTypes(pkgRoot);
        break;
      case 'salesforcedx-vscode-soql':
        cleanPackageStandard(pkgRoot);
        rmIfExists(path.join(pkgRoot, 'src', 'soql-builder-ui', 'dist'));
        break;
      default:
        cleanPackageStandard(pkgRoot);
        break;
    }
  }
}

main();
