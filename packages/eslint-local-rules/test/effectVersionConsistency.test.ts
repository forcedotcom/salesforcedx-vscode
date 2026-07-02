/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { globSync } from 'glob';
import * as semver from 'semver';

// Two loaded `effect` copies in one process warn on every exec (fiberRuntime version check),
// flooding telemetry. Guard: source specs identical, one resolved copy, companion peers satisfied.

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
    const offenders = globSync('packages/*/package.json', { cwd: REPO_ROOT }).flatMap(file => {
      const pkg = readJson(file);
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

  it('resolves exactly one effect version in node_modules', () => {
    const versions = new Set(
      globSync('**/node_modules/effect/package.json', {
        cwd: REPO_ROOT,
        ignore: '**/node_modules/**/node_modules/**/node_modules/**'
      }).map(file => readJson(file).version)
    );
    expect([...versions]).toHaveLength(1);
  });

  it('satisfies @effect companion peer ranges', () => {
    const resolvedEffect = readJson(
      globSync('**/node_modules/effect/package.json', {
        cwd: REPO_ROOT,
        ignore: '**/node_modules/**/node_modules/**/node_modules/**'
      })[0]
    ).version;
    if (resolvedEffect === undefined) throw new Error('no resolved effect copy');

    const violations = globSync('**/node_modules/@effect/*/package.json', {
      cwd: REPO_ROOT,
      ignore: '**/node_modules/**/node_modules/**'
    })
      .map(readJson)
      .map(pkg => ({ pkg, peer: pkg.peerDependencies?.effect }))
      .filter((entry): entry is { pkg: PackageJson; peer: string } => entry.peer !== undefined)
      .filter(entry => !semver.satisfies(resolvedEffect, entry.peer))
      .map(
        entry => `${entry.pkg.name ?? '(unnamed)'} peer effect ${entry.peer} not satisfied by effect@${resolvedEffect}`
      );

    expect(violations).toEqual([]);
  });
});
