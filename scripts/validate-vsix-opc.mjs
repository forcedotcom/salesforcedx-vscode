#!/usr/bin/env node
/**
 * Validates VSIX files for OPC Part URI compliance.
 * Invalid paths (e.g. trailing spaces, spaces in filenames) cause marketplace publish to fail.
 * See: https://github.com/microsoft/vscode-vsce/issues/315
 */
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import JSZip from 'jszip';

const isInvalidPartUri = entryPath => entryPath !== entryPath.trim() || entryPath.includes(' ');

const validateVsix = async vsixPath => {
  const buffer = fs.readFileSync(vsixPath);
  const zip = await JSZip.loadAsync(buffer);
  const invalid = Object.keys(zip.files).filter(isInvalidPartUri);
  return invalid;
};

const main = async () => {
  const searchDir = process.argv[2] ?? './packages';
  const vsixFiles = await glob(`${searchDir}/**/*.vsix`);
  const errors = [];

  for (const vsix of vsixFiles) {
    const invalid = await validateVsix(vsix);
    if (invalid.length > 0) {
      errors.push({ vsix, invalid });
    }
  }

  if (errors.length === 0) {
    console.log(`Validated ${vsixFiles.length} VSIX file(s) — all OPC Part URIs valid`);
    process.exit(0);
  }

  console.error('OPC Part URI validation failed. Invalid paths (spaces/whitespace):');
  errors.forEach(({ vsix, invalid }) => {
    console.error(`  ${path.relative(process.cwd(), vsix)}:`);
    invalid.forEach(p => console.error(`    - ${JSON.stringify(p)}`));
  });
  process.exit(1);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
