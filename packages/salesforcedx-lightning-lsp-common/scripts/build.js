#!/usr/bin/env node
const { execSync } = require('node:child_process');
const { cpSync } = require('node:fs');
const { join } = require('node:path');

// Copy typings
try {
  execSync('node scripts/copy_typings.js', { stdio: 'inherit' });
} catch {
  console.error('Error:node scripts/copy_typings.js couldnt be executed');
  process.exit(1);
}

//Copy src/resources into out/src/
cpSync('src/resources', join('out', 'src', 'resources'), { recursive: true });
