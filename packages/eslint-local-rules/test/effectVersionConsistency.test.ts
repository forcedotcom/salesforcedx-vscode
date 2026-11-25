/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

import * as semver from 'semver';

// Two loaded `effect` copies in one process warn on every exec (fiberRuntime version check),
// flooding telemetry. Guard: one copy per major, with Effect 4 isolated behind a Promise-only package.

const REPO_ROOT = path.resolve(__dirname, '../../..');

type PackageJson = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const readJson = (relative: string): PackageJson =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relative), 'utf-8')) as PackageJson;

describe('effect version consistency', () => {
  it('declares one effect spec across all workspace packages', () => {
    const offenders = fs.globSync('packages/*/package.json', { cwd: REPO_ROOT }).flatMap(file => {
      const pkg = readJson(file);
      if (pkg.name === '@salesforce/opencode-decisions') {
        expect(pkg.dependencies?.effect).toBe('4.0.6');
        expect(pkg.devDependencies?.effect).toBeUndefined();
        return [];
      }
      // collect both blocks so a deps/devDeps skew within one package is not masked
      return [pkg.dependencies?.effect, pkg.devDependencies?.effect]
        .filter((spec): spec is string => spec !== undefined)
        .map(spec => ({ file, spec }));
    });

    // on failure jest prints every offending file:spec so the skew is obvious
    const byFile = offenders.map(entry => `${entry.file}: ${entry.spec}`);
    const distinctSpecs = new Set(offenders.map(entry => entry.spec));
    expect(distinctSpecs.size === 1 ? [] : byFile).toEqual([]);
  });

  it('resolves exactly one version per permitted Effect major', () => {
    const versions = new Set(
      fs
        .globSync('**/node_modules/effect/package.json', {
          cwd: REPO_ROOT,
          exclude: ['**/node_modules/**/node_modules/**/node_modules/**']
        })
        .map(file => readJson(file).version)
    );
    expect([...versions].sort()).toEqual(['3.22.4', '4.0.6']);
  }, 15_000);

  it('isolates Effect 4 to the OpenCode decisions package and its client', () => {
    const rootRequire = createRequire(path.join(REPO_ROOT, 'package.json'));
    const decisionRequire = createRequire(path.join(REPO_ROOT, 'packages/opencode-decisions/package.json'));
    const clientRequire = createRequire(
      path.join(REPO_ROOT, 'packages/opencode-decisions/node_modules/@opencode/client/package.json')
    );
    expect(rootRequire('effect/package.json').version).toBe('3.22.4');
    expect(decisionRequire('effect/package.json').version).toBe('4.0.6');
    expect(clientRequire.resolve('effect')).toBe(decisionRequire.resolve('effect'));
  });

  it('satisfies @effect companion peer ranges', () => {
    const violations = fs
      .globSync('**/node_modules/@effect/*/package.json', {
        cwd: REPO_ROOT,
        exclude: ['**/node_modules/**/node_modules/**']
      })
      .map(file => {
        const pkg = readJson(file);
        const resolvedEffect: string = createRequire(path.join(REPO_ROOT, file))('effect/package.json').version;
        return { pkg, peer: pkg.peerDependencies?.effect, resolvedEffect };
      })
      .filter((entry): entry is { pkg: PackageJson; peer: string; resolvedEffect: string } => entry.peer !== undefined)
      .filter(entry => !semver.satisfies(entry.resolvedEffect, entry.peer))
      .map(
        entry =>
          `${entry.pkg.name ?? '(unnamed)'} peer effect ${entry.peer} not satisfied by effect@${entry.resolvedEffect}`
      );

    expect(violations).toEqual([]);
  }, 15_000);
});
