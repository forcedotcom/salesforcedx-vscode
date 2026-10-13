#!/usr/bin/env node
/**
 * Removes root and workspace `.wireit/<script>/cache` directories.
 * Leaves fingerprints, manifests, locks, trash, and build outputs in place.
 *
 * Optional argv[2] overrides the repo root (tests).
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(process.argv[2] ?? path.join(__dirname, '..'));

const workspaceRoots = () => {
  const packagesDir = path.join(repoRoot, 'packages');
  return fs.existsSync(packagesDir)
    ? fs
        .readdirSync(packagesDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(packagesDir, entry.name))
    : [];
};

const cacheDirs = root => {
  const wireitDir = path.join(root, '.wireit');
  return fs.existsSync(wireitDir)
    ? fs
        .readdirSync(wireitDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(wireitDir, entry.name, 'cache'))
        .filter(cacheDir => fs.existsSync(cacheDir))
    : [];
};

const removed = [repoRoot, ...workspaceRoots()].flatMap(cacheDirs).map(cacheDir => {
  fs.rmSync(cacheDir, { recursive: true, force: true });
  return cacheDir;
});

console.log(`Removed ${removed.length} Wireit cache directories`);
