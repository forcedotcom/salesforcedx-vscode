#!/usr/bin/env node
const { cpSync, mkdirSync, rmSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

// Copy static assets
mkdirSync('out/src/tern-server', { recursive: true });
const ternServerFiles = readdirSync('src/tern-server').filter(file => file.endsWith('.json'));
for (const file of ternServerFiles) {
  cpSync(join('src/tern-server', file), join('out/src/tern-server', file));
}

mkdirSync('out/src/resources', { recursive: true });
const resourceFiles = readdirSync('src/resources').filter(file => file.endsWith('.json'));
for (const file of resourceFiles) {
  cpSync(join('src/resources', file), join('out/src/resources', file));
}

// copy tern
try {
  rmSync('out/src/tern', { recursive: true, force: true });
} catch {
  // Directory doesn't exist, which is fine
}
mkdirSync('out/src/tern', { recursive: true });
cpSync('src/tern/lib', join('out/src/tern', 'lib'), { recursive: true });
cpSync('src/tern/defs', join('out/src/tern', 'defs'), { recursive: true });
cpSync('src/tern/plugin', join('out/src/tern', 'plugin'), { recursive: true });
