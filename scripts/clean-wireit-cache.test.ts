/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/// <reference types="jest" />
/// <reference types="node" />

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const script = path.resolve(__dirname, 'clean-wireit-cache.js');

const writeFile = (file: string, contents: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
};

describe('clean-wireit-cache', () => {
  test('removes root and workspace cache dirs and keeps freshness metadata and build output', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wireit-cache-'));
    const rootCache = path.join(root, '.wireit', 'aa', 'cache', 'entry');
    const fingerprint = path.join(root, '.wireit', 'aa', 'fingerprint');
    const manifest = path.join(root, '.wireit', 'aa', 'manifest');
    const trash = path.join(root, '.wireit', 'trash', 'old');
    const workspaceCache = path.join(root, 'packages', 'foo', '.wireit', 'bb', 'cache', 'entry');
    const workspaceFingerprint = path.join(root, 'packages', 'foo', '.wireit', 'bb', 'fingerprint');
    const buildOutput = path.join(root, 'packages', 'foo', 'out', 'index.js');

    writeFile(rootCache, 'cached');
    writeFile(fingerprint, 'fp');
    writeFile(manifest, '{}');
    writeFile(trash, 'trash');
    writeFile(workspaceCache, 'cached');
    writeFile(workspaceFingerprint, 'fp');
    writeFile(buildOutput, 'js');

    execFileSync(process.execPath, [script, root], { stdio: 'pipe' });

    expect(fs.existsSync(rootCache)).toBe(false);
    expect(fs.existsSync(path.dirname(rootCache))).toBe(false);
    expect(fs.existsSync(workspaceCache)).toBe(false);
    expect(fs.readFileSync(fingerprint, 'utf8')).toBe('fp');
    expect(fs.readFileSync(manifest, 'utf8')).toBe('{}');
    expect(fs.readFileSync(trash, 'utf8')).toBe('trash');
    expect(fs.readFileSync(workspaceFingerprint, 'utf8')).toBe('fp');
    expect(fs.readFileSync(buildOutput, 'utf8')).toBe('js');

    fs.rmSync(root, { recursive: true, force: true });
  });
});
