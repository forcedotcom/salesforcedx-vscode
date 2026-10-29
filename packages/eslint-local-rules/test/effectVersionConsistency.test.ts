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

// Enforce one first-party runtime; only explicitly reviewed legacy declaration/compatibility
// packages may resolve another version. Installed test fixtures are independent processes,
// not workspace runtime consumers. Check actual resolution, not arbitrary files on disk.

const REPO_ROOT = path.resolve(__dirname, '../../..');

type PackageJson = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

const readJson = (relative: string): PackageJson =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relative), 'utf-8')) as PackageJson;

const packageEffectVersions = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'config/effect-version-boundaries.json'), 'utf8')
) as Record<string, string>;
const workspaceFiles = [
  'package.json',
  ...fs.globSync('packages/*/package.json', { cwd: REPO_ROOT }).map(file => file.split(path.sep).join('/'))
];
const effectSpec = (pkg: PackageJson): string | undefined => pkg.dependencies?.effect ?? pkg.devDependencies?.effect;
const requireFrom = (file: string): NodeJS.Require => createRequire(path.join(REPO_ROOT, file));
const resolvedEffect = (file: string): { version: string; file: string } => {
  const effectFile = requireFrom(file).resolve('effect/package.json');
  return {
    version: (JSON.parse(fs.readFileSync(effectFile, 'utf8')) as { version: string }).version,
    file: effectFile
  };
};

describe('effect version consistency', () => {
  it('declares one first-party effect spec with exact reviewed boundaries', () => {
    Object.entries(packageEffectVersions).forEach(([file, version]) => {
      expect(workspaceFiles).toContain(file);
      expect(semver.valid(version)).not.toBeNull();
      expect(effectSpec(readJson(file))).toBe(version);
    });
    const offenders = workspaceFiles
      .filter(file => file !== 'package.json')
      .flatMap(file => {
        const pkg = readJson(file);
        // collect both blocks so a deps/devDeps skew within one package is not masked
        return [pkg.dependencies?.effect, pkg.devDependencies?.effect]
          .filter((spec): spec is string => spec !== undefined)
          .map(spec => ({ file, spec }));
      });

    // on failure jest prints every offending file:spec so the skew is obvious
    const byFile = offenders.map(entry => `${entry.file}: ${entry.spec}`);
    const violations = offenders.filter(
      entry => entry.spec !== (packageEffectVersions[entry.file] ?? effectSpec(readJson('package.json')))
    );
    expect(violations.length === 0 ? [] : byFile).toEqual([]);
  });

  it('resolves one first-party effect copy and exact isolated versions', () => {
    const firstParty = resolvedEffect('package.json');
    workspaceFiles
      .filter(file => effectSpec(readJson(file)) !== undefined)
      .forEach(file => {
        const resolved = resolvedEffect(file);
        expect(resolved.version, file).toBe(packageEffectVersions[file] ?? firstParty.version);
        if (packageEffectVersions[file] === undefined) expect(resolved.file, file).toBe(firstParty.file);
      });
  }, 15_000);

  it('satisfies @effect companion peer ranges', () => {
    workspaceFiles.forEach(file => {
      const pkg = readJson(file);
      const requirePackage = requireFrom(file);
      Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
        .filter(name => name.startsWith('@effect/'))
        .forEach(name => {
          const companionFile = requirePackage.resolve(`${name}/package.json`);
          const companion = JSON.parse(fs.readFileSync(companionFile, 'utf8')) as PackageJson;
          const peer = companion.peerDependencies?.effect;
          if (peer === undefined) return;
          const effectFile = createRequire(companionFile).resolve('effect/package.json');
          const version = (JSON.parse(fs.readFileSync(effectFile, 'utf8')) as { version: string }).version;
          expect(semver.satisfies(version, peer), `${file}: ${name} requires effect ${peer}, resolved ${version}`).toBe(
            true
          );
          expect(effectFile, `${file}: ${name} must use its owner's effect copy`).toBe(resolvedEffect(file).file);
        });
    });
  }, 15_000);

  it('rejects unreviewed Effect copies in reachable transitive dependencies', () => {
    const visited = new Set<string>();
    const violations = new Set<string>();
    const manifests = new Map<string, PackageJson>();
    const readManifest = (file: string): PackageJson => {
      const cached = manifests.get(file);
      if (cached !== undefined) return cached;
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as PackageJson;
      manifests.set(file, pkg);
      return pkg;
    };
    const visit = (file: string, ownerEffectFile: string): void => {
      const manifestFile = fs.realpathSync(file);
      const relativeFile = path.relative(REPO_ROOT, manifestFile).split(path.sep).join('/');
      const expectedEffectFile =
        packageEffectVersions[relativeFile] === undefined ? ownerEffectFile : resolvedEffect(relativeFile).file;
      const key = `${manifestFile}\0${expectedEffectFile}`;
      if (visited.has(key)) return;
      visited.add(key);
      const pkg = readManifest(manifestFile);
      if (pkg.name === 'effect') {
        if (manifestFile !== expectedEffectFile) {
          violations.add(
            `${manifestFile}: effect@${pkg.version ?? '(unknown)'} differs from owner ${expectedEffectFile}`
          );
        }
        return;
      }
      const requirePackage = createRequire(manifestFile);
      const dependencies = {
        ...pkg.dependencies,
        ...pkg.optionalDependencies,
        ...pkg.peerDependencies,
        ...(workspaceFiles.includes(relativeFile) ? pkg.devDependencies : {})
      };
      Object.keys(dependencies).forEach(name => {
        // Reading resolution paths handles hidden package.json exports without executing
        // dependency code or relying on compiled workspace entry points.
        const dependencyFile = requirePackage.resolve
          .paths(name)
          ?.map(directory => path.join(directory, name, 'package.json'))
          .find(candidate => fs.existsSync(candidate));
        if (dependencyFile !== undefined) visit(dependencyFile, expectedEffectFile);
      });
    };
    const rootEffectFile = resolvedEffect('package.json').file;
    workspaceFiles.forEach(file => visit(path.join(REPO_ROOT, file), rootEffectFile));
    expect([...violations]).toEqual([]);
  }, 30_000);
});
