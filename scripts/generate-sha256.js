#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { glob } = require('glob');

// Find repo root by looking for package.json with "workspaces"
function findRepoRoot(startDir) {
  let currentDir = startDir;
  while (currentDir !== path.dirname(currentDir)) {
    const pkgPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.workspaces) {
        return currentDir;
      }
    }
    currentDir = path.dirname(currentDir);
  }
  return startDir;
}

const repoRoot = findRepoRoot(process.cwd());

// Check for VSIXs in either ./extensions (legacy) or ./packages/*/*.vsix
let vsixFiles = [];
const extensionsDir = path.join(repoRoot, 'extensions');
if (fs.existsSync(extensionsDir)) {
  const vsixes = fs.readdirSync(extensionsDir).filter(f => f.endsWith('.vsix'));
  vsixFiles = vsixes.map(v => path.join(extensionsDir, v));
}

// If no VSIXs found in extensions/, look in packages/*
if (vsixFiles.length === 0) {
  vsixFiles = glob.sync('packages/*/*.vsix', { cwd: repoRoot, absolute: true });
}

if (vsixFiles.length === 0) {
  console.error('No VSIX files found matching the requested version in package.json');
  process.exit(1);
}

for (let i = 0; i < vsixFiles.length; i++) {
  const vsixPath = vsixFiles[i];
  const vsixName = path.basename(vsixPath);
  try {
    // Run the hash command from the vsix directory for consistent output
    const vsixDir = path.dirname(vsixPath);
    const command =
      process.platform === 'win32' ? `CertUtil -hashfile ${vsixName} SHA256` : `shasum -a 256 ${vsixName}`;

    execSync(command, {
      cwd: vsixDir,
      stdio: 'inherit'
    });
  } catch (error) {
    console.error(`Error generating SHA256 for ${vsixName}:`, error);
    process.exit(1);
  }
}
