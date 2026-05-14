#!/usr/bin/env node
/**
 * Creates N source tracking conflicts by:
 * 1. Deploying current files to establish a clean sync baseline
 * 2. Modifying local files with "local-conflict-test" (creates local changes)
 * 3. Deploying the ORIGINAL files with "remote-conflict-test" appended
 *    using --ignore-conflicts so it bypasses conflict detection and
 *    does NOT update local source tracking (the key trick)
 *
 * Result: source tracking sees local modifications AND remote modifications
 * since the last clean sync point — true conflicts.
 *
 * Must be run from the SFDX project root directory.
 *
 * Usage:
 *   cd /path/to/sfdx/project
 *   node /path/to/create-conflicts.mjs [--count 50]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const countIdx = args.indexOf('--count');
const count = countIdx !== -1 ? parseInt(args[countIdx + 1], 10) : 50;

console.log(`Creating up to ${count} conflicts in project: ${process.cwd()}`);

const classesDir = join('force-app', 'main', 'default', 'classes');
if (!existsSync(classesDir)) {
  console.error(`Classes directory not found: ${classesDir}`);
  process.exit(1);
}

// Step 1: Find local .cls files and save original content
console.log('\n Finding local ApexClass files...');
const clsFiles = readdirSync(classesDir)
  .filter(f => f.endsWith('.cls'))
  .slice(0, count)
  .map(f => ({
    name: f.replace('.cls', ''),
    clsPath: join(classesDir, f),
    metaPath: join(classesDir, `${f}-meta.xml`)
  }))
  .filter(f => existsSync(f.metaPath))
  .map(f => ({ ...f, originalContent: readFileSync(f.clsPath, 'utf-8') }));

console.log(`   Found ${clsFiles.length} class files`);

if (clsFiles.length === 0) {
  console.log('No class files found. Exiting.');
  process.exit(0);
}

const timestamp = new Date().toISOString().slice(0, 19);

// Build package.xml manifest (used by both deploys)
const classNames = clsFiles.map(f => `        <members>${f.name}</members>`).join('\n');
const packageXml = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
${classNames}
        <name>ApexClass</name>
    </types>
    <version>62.0</version>
</Package>`;

// Clean up any stale temp dir from a previous run
const tmpDir = '.conflict-deploy-tmp';
rmSync(tmpDir, { recursive: true, force: true });
try {
  execFileSync('sf', ['project', 'deploy', 'cancel', '--json'], {
    encoding: 'utf-8',
    timeout: 30000
  });
} catch {
  // no pending deploy to cancel — that's fine
}

const sfDeploy = (deployArgs, label) => {
  try {
    const result = execFileSync('sf', deployArgs, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 600000
    });
    const parsed = JSON.parse(result);
    const fileCount = parsed.result?.files?.length ?? parsed.result?.numberComponentsDeployed ?? '?';
    console.log(`   ${label}: ${fileCount} components`);
    return true;
  } catch (e) {
    const output = e.stdout || e.stderr || e.message;
    console.error(`   ${label} failed: ${output.slice(0, 500)}`);
    return false;
  }
};

// Step 2: Deploy current files to establish a clean sync baseline
console.log('\n Deploying current files to establish sync baseline...');
const manifestPath = '.conflict-manifest.xml';
console.log(`${packageXml}\n`);
writeFileSync(manifestPath, packageXml);
if (
  !sfDeploy(
    ['project', 'deploy', 'start', '--manifest', manifestPath, '--ignore-conflicts', '--json'],
    'Baseline deploy'
  )
) {
  // rmSync(manifestPath, { force: true });
  process.exit(1);
}
// rmSync(manifestPath, { force: true });

// Step 3: Modify local files with "local" comment — this is the local side of the conflict
console.log('\n Modifying local files (creating local changes)...');
clsFiles.forEach(f => {
  writeFileSync(f.clsPath, `${f.originalContent}\n// local-conflict-test ${timestamp}`);
});
console.log(`   Modified ${clsFiles.length} local files`);

// Step 4: Build a temp metadata dir with "remote" versions,
// then deploy so the org has different content than local
console.log('\n Preparing remote-modified files for org deploy...');
const tmpClassesDir = join(tmpDir, 'classes');
mkdirSync(tmpClassesDir, { recursive: true });

writeFileSync(join(tmpDir, 'package.xml'), packageXml);

clsFiles.forEach(f => {
  writeFileSync(join(tmpClassesDir, `${f.name}.cls`), `${f.originalContent}\n// remote-conflict-test ${timestamp}`);
  cpSync(f.metaPath, join(tmpClassesDir, `${f.name}.cls-meta.xml`));
});

console.log('\n Deploying remote-modified files to org...');
if (
  !sfDeploy(['project', 'deploy', 'start', '--metadata-dir', tmpDir, '--ignore-conflicts', '--json'], 'Remote deploy')
) {
  clsFiles.forEach(f => writeFileSync(f.clsPath, f.originalContent));
  rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
}

// Cleanup
rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n Done! Created ${clsFiles.length} conflicts.`);
console.log('   Org has: "// remote-conflict-test ..."');
console.log('   Local has: "// local-conflict-test ..."');
console.log('   Baseline was the original unmodified content.');
console.log('   Source tracking should detect conflicts on next poll.');
console.log('   To revert local changes: git checkout -- force-app/main/default/classes/');
