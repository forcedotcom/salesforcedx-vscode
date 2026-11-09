/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import salesforcedxVscodeCorePackageJson from '../packages/salesforcedx-vscode-core/package.json' with { type: 'json' };

const repoRoot = path.resolve(import.meta.dirname, '..');
const rootScripts = [
  'buildJorje',
  'calculatePrereleaseHotfixVersion',
  'calculateReleaseVersion',
  'checkBranch',
  'cleanAllButJar',
  'cleanBuildArtifacts',
  'cleanupReleaseBranchAfterReleaseIssues',
  'concatenateSha256',
  'foldStableChangelog',
  'generateSha256',
  'listVscodeExtensions',
  'loggerUtil',
  'parseExtensionNames',
  'prependReleaseChangelog',
  'publishVsix',
  'releasePackageSelection',
  'repoRoot',
  'shared/packageJsonSchema',
  'updateReleaseVersions',
  'validationUtils'
].map(name => `scripts/${name}.mts`);
const packageScripts = [
  'salesforcedx-lightning-lsp-common/scripts/build.mts',
  'salesforcedx-aura-language-server/scripts/build.mts',
  'salesforcedx-lwc-language-server/scripts/build.mts',
  'salesforcedx-lwc-language-server/scripts/convert.mts'
].map(name => `packages/${name}`);

describe('converted automation', () => {
  let directory: string;
  const file = (name: string) => path.join(directory, name);
  const write = (name: string, contents: string) => {
    fs.mkdirSync(path.dirname(file(name)), { recursive: true });
    fs.writeFileSync(file(name), contents);
  };
  const run = (script: string, args: string[] = [], env: NodeJS.ProcessEnv = process.env) =>
    spawnSync(process.execPath, [path.join(repoRoot, script), ...args], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 30_000,
      env
    });
  const linkEffect = () => {
    fs.mkdirSync(file('node_modules'), { recursive: true });
    fs.symlinkSync(
      path.join(repoRoot, 'node_modules/effect'),
      file('node_modules/effect'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
  };
  const linkEffectExtUtils = () => {
    fs.mkdirSync(file('node_modules/@salesforce'), { recursive: true });
    fs.symlinkSync(
      path.join(repoRoot, 'packages/effect-ext-utils'),
      file('node_modules/@salesforce/effect-ext-utils'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
  };
  const command = (name: string, contents: string) => {
    write(`bin/${name}.cjs`, contents);
    if (process.platform === 'win32') {
      write(`bin/${name}.cmd`, `@"${process.execPath}" "%~dp0${name}.cjs" %*\r\n`);
    } else {
      write(`bin/${name}`, `#!/bin/sh\nexec "${process.execPath}" "${file(`bin/${name}.cjs`)}" "$@"\n`);
      fs.chmodSync(file(`bin/${name}`), 0o755);
    }
    // Only fixture commands are reachable, never the real publisher/build tools.
    return {
      ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path')),
      PATH: file('bin'),
      PATHEXT: '.COM;.EXE;.BAT;.CMD'
    };
  };
  const runHotfixWithFetch = (fetchSource: string) => {
    write('fetch mock#.mjs', fetchSource);
    return spawnSync(
      process.execPath,
      [
        '--import',
        pathToFileURL(file('fetch mock#.mjs')).href,
        path.join(repoRoot, 'scripts/calculatePrereleaseHotfixVersion.mts')
      ],
      { encoding: 'utf8', timeout: 30_000 }
    );
  };

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'native-automation-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it.each([...rootScripts, ...packageScripts])('node syntax-checks %s', script => {
    const result = spawnSync(process.execPath, ['--check', path.join(repoRoot, script)], { encoding: 'utf8' });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it.each([
    [['v67.11.1-nightly.develop.20260812'], '67.12.0'],
    [['v67.11.1-nightly.develop.20260812', '67.13.0-beta.1'], '67.13.0-beta.1']
  ])('calculates stable versions for %j', (args, expected) => {
    const result = run('scripts/calculateReleaseVersion.mts', args);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(expected);
  });

  it.each([
    [[], 'prereleaseTag argument required'],
    [['invalid'], 'Could not extract version'],
    [['v67.11.1', 'invalid'], 'Invalid version format'],
    [['v67.9999.1'], 'Minor version overflow']
  ])('rejects invalid stable-version input %j', (args, message) => {
    const result = run('scripts/calculateReleaseVersion.mts', args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
  });

  it('accepts a hotfix override without network access', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--permission',
        '--allow-fs-read=*',
        path.join(repoRoot, 'scripts/calculatePrereleaseHotfixVersion.mts'),
        '67.17.20'
      ],
      { encoding: 'utf8' }
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('67.17.20');
    expect(run('scripts/calculatePrereleaseHotfixVersion.mts', ['invalid']).status).toBe(1);
  });

  it.each([
    ['67.17.9', '67.17.10', '67.17.11'],
    ['68.1.2', '67.99.9', '68.1.3']
  ])('bumps the higher registry version (%s, %s)', (marketplace, openVsx, expected) => {
    const result = runHotfixWithFetch(
      `globalThis.fetch = async url => new Response(JSON.stringify(
      String(url).includes('marketplace.visualstudio.com')
        ? { results: [{ extensions: [{ versions: [{ version: '${marketplace}' }] }] }] }
        : { version: '${openVsx}' }
    ));`
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(expected);
  });

  it('reports invalid registry responses', () => {
    const result = runHotfixWithFetch('globalThis.fetch = async () => new Response(JSON.stringify({}));');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('response did not contain a version');
  });

  it('restores release tools that update selected packages, preserve fields, and refresh the lockfile', () => {
    const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/build-github-release.yml'), 'utf8');
    const scriptLists = [...workflow.matchAll(/SCRIPTS="([^"]+)"/g)].map(match => match[1].split(' '));
    expect(scriptLists).toHaveLength(2);
    expect(scriptLists[0]).toEqual(scriptLists[1]);
    scriptLists[1].forEach(script => write(script, fs.readFileSync(path.join(repoRoot, script), 'utf8')));
    write(
      'scripts/shared/packageJsonSchema.mts',
      fs.readFileSync(path.join(repoRoot, 'scripts/shared/packageJsonSchema.mts'), 'utf8')
    );
    linkEffect();
    const packages = {
      extension: { version: '1.0.0', scripts: { 'vscode:publish': 'publish' }, description: 'keep me' },
      library: { version: '1.0.0', publishConfig: { access: 'public' } },
      private: { version: '1.0.0', private: true, publishConfig: { access: 'public' } },
      independent: { version: '1.0.0', versionedIndependently: true, scripts: { 'vscode:publish': 'publish' } }
    };
    Object.entries(packages).forEach(([name, contents]) =>
      write(`packages/${name}/package.json`, JSON.stringify(contents))
    );
    write('packages/broken/package.json', '{');
    const env = command(
      'pnpm',
      "require('node:fs').writeFileSync('lock-command.json', JSON.stringify(process.argv.slice(2)));"
    );
    const result = spawnSync(process.execPath, [file('scripts/updateReleaseVersions.mts'), '2.0.0'], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 30_000,
      env
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain(`Error parsing ${path.join('packages', 'broken', 'package.json')}`);
    Object.entries(packages).forEach(([name, contents]) => {
      expect(JSON.parse(fs.readFileSync(file(`packages/${name}/package.json`), 'utf8'))).toEqual({
        ...contents,
        version: name === 'extension' || name === 'library' ? '2.0.0' : '1.0.0'
      });
    });
    expect(JSON.parse(fs.readFileSync(file('lock-command.json'), 'utf8'))).toEqual([
      'install',
      '--ignore-scripts',
      '--lockfile-only'
    ]);
  });

  it('returns failure when the lockfile refresh fails', () => {
    write('packages/extension/package.json', JSON.stringify({ scripts: { 'vscode:publish': 'publish' } }));
    const result = run('scripts/updateReleaseVersions.mts', ['2.0.0'], command('pnpm', 'process.exit(1);'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Error updating pnpm-lock.yaml');
  });

  it('publishes the version-matched VSIX through the CLI', () => {
    linkEffectExtUtils();
    write('package.json', JSON.stringify({ version: '1.2.3' }));
    write('example-1.2.3.vsix', 'vsix');
    write('example-1.2.2.vsix', 'old');
    const env = command(
      'vsce',
      "require('node:fs').writeFileSync('publish-command.json', JSON.stringify(process.argv.slice(2)));"
    );
    const result = run('scripts/publishVsix.mts', [], { ...env, VSCE_PERSONAL_ACCESS_TOKEN: 'fixture-token' });
    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(file('publish-command.json'), 'utf8'))).toEqual([
      'publish',
      '--pat',
      'fixture-token',
      '--packagePath',
      'example-1.2.3.vsix'
    ]);
  });

  it('fails publishing when no matching VSIX exists or the CLI fails', () => {
    linkEffectExtUtils();
    write('package.json', '{}');
    const missingVersion = run('scripts/publishVsix.mts');
    expect(missingVersion.status).toBe(1);
    expect(missingVersion.stdout).toContain('No version found in package.json');

    write('package.json', JSON.stringify({ version: '1.2.3' }));
    const env = command('vsce', 'process.exit(1);');
    expect(run('scripts/publishVsix.mts', [], env).status).toBe(1);
    write('example-1.2.3.vsix', 'vsix');
    expect(run('scripts/publishVsix.mts', [], env).status).toBe(1);
  });

  it('extracts sorted unique extension names, including prereleases', () => {
    write('extensions/z-extension-1.2.3.vsix', '');
    write('extensions/a-extension-1.2.3-beta.1.vsix', '');
    write('extensions/a-extension-1.2.4.vsix', '');
    write('extensions/ignore.txt', '');
    const result = run('scripts/parseExtensionNames.mts', ['extensions']);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('a-extension,z-extension');
  });

  it('generates SHA256 output and the release verification document', () => {
    write('extensions/example-1.2.3.vsix', 'vsix contents');
    const result = run('scripts/generateSha256.mts');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(createHash('sha256').update('vsix contents').digest('hex'));
    write('SHA256', result.stdout);
    expect(run('scripts/concatenateSha256.mts').status).toBe(0);
    const document = fs.readFileSync(file('SHA256.md'), 'utf8');
    expect(document).toContain(result.stdout);
    expect(document).toContain(`/${salesforcedxVscodeCorePackageJson.version}/assetbyname/`);
  });

  it('cleans non-JAR files and directories but keeps JARs', () => {
    write('keep.jar', 'jar');
    write('remove.txt', 'text');
    write('remove/nested.txt', 'text');
    expect(run('scripts/cleanAllButJar.mts').status).toBe(0);
    expect(fs.readdirSync(directory)).toEqual(['keep.jar']);
  });

  it('cleans build outputs from the script repository while preserving dependencies, sources, and Apex JARs', () => {
    ['cleanBuildArtifacts', 'cleanAllButJar'].forEach(name =>
      write(`scripts/${name}.mts`, fs.readFileSync(path.join(repoRoot, `scripts/${name}.mts`), 'utf8'))
    );
    const removed = [
      '.wireit/cache',
      'coverage/report.json',
      '.github/actions/example/lib/index.js',
      ...['out', 'dist', 'lib', 'coverage', '.nyc_output', '.wireit'].map(
        name => `packages/standard/${name}/output.js`
      ),
      ...['.eslintcache', '.circular-deps.json', 'tsconfig.tsbuildinfo', 'extension.vsix'].map(
        name => `packages/standard/${name}`
      ),
      'packages/salesforcedx-vscode-apex/out/generated.js',
      'packages/salesforcedx-vscode-apex/out/nested/generated.js',
      'packages/salesforcedx-vscode-apex/out/nested/keep.jar',
      'packages/salesforcedx-vscode-apex/dist/index.js',
      'packages/salesforcedx-vscode-apex/extension.vsix',
      'packages/salesforcedx-vscode-services/out/index.js',
      'packages/salesforcedx-vscode-services/resources/icon.svg',
      ...['out', 'dist', '.wireit'].map(name => `packages/salesforcedx-vscode-services-types/${name}/output.js`),
      'packages/salesforcedx-vscode-services-types/.eslintcache',
      'packages/salesforcedx-vscode-services-types/package.tgz',
      'packages/salesforcedx-vscode-soql/src/soql-builder-ui/dist/index.js'
    ];
    const preserved = [
      'node_modules/dependency/index.js',
      'packages/standard/node_modules/dependency/index.js',
      'packages/standard/src/index.ts',
      'packages/standard/package.json',
      'packages/salesforcedx-vscode-apex/out/keep.jar',
      'packages/salesforcedx-vscode-services-types/src/index.ts',
      'packages/salesforcedx-vscode-soql/src/soql-builder-ui/index.ts',
      '.github/actions/example/src/index.ts'
    ];
    [...removed, ...preserved].forEach(name => write(name, name));
    write(
      'node_modules/@salesforce/salesforcedx-utils/index.js',
      'exports.getErrorMessage = error => error instanceof Error ? error.message : String(error);'
    );
    write('node_modules/@salesforce/salesforcedx-utils/package.json', '{"main":"index.js"}');
    const result = spawnSync(process.execPath, [file('scripts/cleanBuildArtifacts.mts')], {
      cwd: file('packages/standard'),
      encoding: 'utf8',
      timeout: 30_000
    });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    removed.forEach(name => expect(fs.existsSync(file(name)), name).toBe(false));
    preserved.forEach(name => expect(fs.readFileSync(file(name), 'utf8'), name).toBe(name));
  });

  it('discovers publishable VS Code extensions with the main bundle first, then alphabetical', () => {
    const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/nightly.yml'), 'utf8');
    expect(workflow).toContain('EXTENSIONS=$(node scripts/listVscodeExtensions.mts)');
    write(
      'scripts/listVscodeExtensions.mts',
      fs.readFileSync(path.join(repoRoot, 'scripts/listVscodeExtensions.mts'), 'utf8')
    );
    write(
      'scripts/shared/packageJsonSchema.mts',
      fs.readFileSync(path.join(repoRoot, 'scripts/shared/packageJsonSchema.mts'), 'utf8')
    );
    linkEffect();
    const extension = { engines: { vscode: '^1.90.0' }, publisher: 'salesforce', categories: ['Other'] };
    const packages = {
      'a-extension': { ...extension, name: 'salesforcedx-vscode-z' },
      'z-extension': { ...extension, name: 'salesforcedx-vscode-a' },
      bundle: { ...extension, name: 'salesforcedx-vscode' },
      'no-engine': { ...extension, name: 'salesforcedx-vscode-no-engine', engines: { node: '>=24' } },
      'no-publisher': { ...extension, name: 'salesforcedx-vscode-no-publisher', publisher: '' },
      'no-categories': { ...extension, name: 'salesforcedx-vscode-no-categories', categories: [] },
      scoped: { ...extension, name: '@salesforce/internal' }
    };
    Object.entries(packages).forEach(([name, contents]) =>
      write(`packages/${name}/package.json`, JSON.stringify(contents))
    );
    write('packages/broken/package.json', '{');
    write('packages/no-manifest/README.md', 'not a package');
    const result = spawnSync(process.execPath, [file('scripts/listVscodeExtensions.mts')], {
      cwd: file('packages/bundle'),
      encoding: 'utf8',
      timeout: 30_000
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('salesforcedx-vscode,salesforcedx-vscode-a,salesforcedx-vscode-z');
    expect(result.stderr).toContain(
      `Warning: Failed to parse ${fs.realpathSync(file('packages/broken/package.json'))}`
    );
  });

  it('reports when no publishable VS Code extensions exist', () => {
    write(
      'scripts/listVscodeExtensions.mts',
      fs.readFileSync(path.join(repoRoot, 'scripts/listVscodeExtensions.mts'), 'utf8')
    );
    write(
      'scripts/shared/packageJsonSchema.mts',
      fs.readFileSync(path.join(repoRoot, 'scripts/shared/packageJsonSchema.mts'), 'utf8')
    );
    linkEffect();
    write('packages/library/package.json', JSON.stringify({ name: 'library' }));
    const result = spawnSync(process.execPath, [file('scripts/listVscodeExtensions.mts')], {
      encoding: 'utf8',
      timeout: 30_000
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No VS Code extensions found in packages/');
    expect(result.stdout).toBe('');
  });

  it.each([
    ['scripts/buildJorje.mts', 'JORJE_DEV_DIR'],
    ['scripts/cleanupReleaseBranchAfterReleaseIssues.mts', 'SALESFORCEDX_VSCODE_VERSION']
  ])('validates %s before running external commands', (script, variable) => {
    const result = run(script, [], { ...process.env, [variable]: '' });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain(`You must set environment variable '${variable}'`);
    expect(fs.readdirSync(directory)).toEqual([]);
  });

  it.each(['false', 'true'])('builds and copies the Jorje JAR (signing: %s)', signing => {
    write('apex-jorje/target/apex-jorje-lsp-256.1-SNAPSHOT.jar', 'built jar');
    write('signing.jks', 'fixture keystore');
    command('jarsigner', "console.log('jar verified');");
    const env = command(
      'mvn',
      "require('node:fs').writeFileSync('build-command.json', JSON.stringify(process.argv.slice(2)));"
    );
    const result = run('scripts/buildJorje.mts', [signing], {
      ...env,
      JORJE_DEV_DIR: file('apex-jorje'),
      SFDC_KEYSTORE: file('signing.jks'),
      SFDC_KEYPASS: 'fixture-password'
    });
    expect(result.status).toBe(0);
    expect(fs.readFileSync(file('packages/salesforcedx-vscode-apex/jars/apex-jorje-lsp.jar'), 'utf8')).toBe(
      'built jar'
    );
    const args: unknown = JSON.parse(fs.readFileSync(file('apex-jorje/build-command.json'), 'utf8'));
    expect(args).toContain('-Plsp');
    if (signing === 'true') expect(args).toContain('-Psign-jars');
    else expect(args).not.toContain('-Psign-jars');
  });

  it('prepends release notes idempotently from a nested working directory', () => {
    expect(spawnSync('git', ['init', '--quiet'], { cwd: directory }).status).toBe(0);
    write('CHANGELOG.md', '# 1.0.0 - January 1, 2026\n\nOld notes.\n');
    write('packages/salesforcedx-vscode/CHANGELOG.md', '# 1.2.0 - January 8, 2026\n\nNew notes.\n');
    const script = path.join(repoRoot, 'scripts/prependReleaseChangelog.mts');
    const options = { cwd: file('packages/salesforcedx-vscode'), encoding: 'utf8' } satisfies Parameters<
      typeof spawnSync
    >[2];
    expect(spawnSync(process.execPath, [script], options).status).toBe(0);
    const once = fs.readFileSync(file('CHANGELOG.md'), 'utf8');
    expect(once).toBe('# 1.2.0 - January 8, 2026\n\nNew notes.\n\n# 1.0.0 - January 1, 2026\n\nOld notes.\n');
    expect(spawnSync(process.execPath, [script], options).status).toBe(0);
    expect(fs.readFileSync(file('CHANGELOG.md'), 'utf8')).toBe(once);
  });

  it('copies Aura build assets without copying unrelated files', () => {
    write('src/tern-server/server.json', '{}');
    write('src/tern-server/ignore.ts', '');
    write('src/resources/resource.json', '{}');
    ['lib', 'defs', 'plugin'].forEach(name => write(`src/tern/${name}/asset.js`, name));
    expect(run('packages/salesforcedx-aura-language-server/scripts/build.mts').status).toBe(0);
    expect(fs.readdirSync(file('out/src/tern-server'))).toEqual(['server.json']);
    expect(fs.readFileSync(file('out/src/resources/resource.json'), 'utf8')).toBe('{}');
    expect(fs.readFileSync(file('out/src/tern/lib/asset.js'), 'utf8')).toBe('lib');
  });

  it('converts LWC metadata and copies the generated resource', () => {
    write(
      'scripts/convert.mts',
      fs.readFileSync(path.join(repoRoot, 'packages/salesforcedx-lwc-language-server/scripts/convert.mts'), 'utf8')
    );
    write(
      'src/build-time-resources/lwc-standard.json',
      JSON.stringify({
        'lightning-example': {
          description: 'Example',
          attributes: [
            { name: 'value', type: 'STRING', description: 'Value' },
            { type: 'STRING', description: 'Unnamed attribute' },
            { name: 'no-type', description: 'Untyped attribute' },
            { name: 'no-description', type: 'BOOLEAN' }
          ]
        },
        'lightning-empty': { description: 'No attributes', attributes: [] }
      })
    );
    fs.mkdirSync(file('src/resources'), { recursive: true });
    const converted = spawnSync(process.execPath, [file('scripts/convert.mts')], { encoding: 'utf8' });
    expect(converted.stderr).toBe('');
    expect(converted.status).toBe(0);
    expect(run('packages/salesforcedx-lwc-language-server/scripts/build.mts').status).toBe(0);
    const resource = fs.readFileSync(file('out/src/resources/transformed-lwc-standard.json'), 'utf8');
    expect(JSON.parse(resource)).toMatchInlineSnapshot(`
      {
        "globalAttributes": [
          {
            "description": "Renders the element or template block multiple times based on the expression value.",
            "name": "for:each",
            "references": [
              {
                "name": "Salesforce",
                "url": "https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives",
              },
            ],
          },
          {
            "description": "Bind the current iteration item to an identifier.",
            "name": "for:item",
            "references": [
              {
                "name": "Salesforce",
                "url": "https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives",
              },
            ],
          },
          {
            "description": "Bind the current iteration index to an identifier.",
            "name": "for:index",
            "references": [
              {
                "name": "Salesforce",
                "url": "https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives",
              },
            ],
          },
          {
            "description": "Renders the element or template if the expression value is truthy. This directive is deprecated and no longer recommended. It may be removed in the future. Use lwc:if, lwc:elseif, and lwc:else instead.",
            "name": "if:true",
            "references": [
              {
                "name": "Salesforce",
                "url": "https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives",
              },
            ],
          },
          {
            "description": "Renders the element or template if the expression value is falsy. This directive is deprecated and no longer recommended. It may be removed in the future. Use lwc:if, lwc:elseif, and lwc:else instead.",
            "name": "if:false",
            "references": [
              {
                "name": "Salesforce",
                "url": "https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives",
              },
            ],
          },
          {
            "description": "Renders the element or template if the expression value is truthy.",
            "name": "lwc:if",
            "references": [
              {
                "name": "Salesforce",
                "url": "https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives",
              },
            ],
          },
          {
            "description": "Renders the element or template if the expression value is truthy.",
            "name": "lwc:elseif",
            "references": [
              {
                "name": "Salesforce",
                "url": "https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives",
              },
            ],
          },
          {
            "description": "Renders the element or template if none of the expressions values of the preceding lwc:if or lwc:elseif are truthy.",
            "name": "lwc:else",
            "references": [
              {
                "name": "Salesforce",
                "url": "https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives",
              },
            ],
          },
          {
            "description": {
              "kind": "markdown",
              "value": "Bind the current iteration item to an identifier. Contains properties (\`value\`, \`index\`, \`first\`, \`last\`) that let you apply special behaviors to certain items.",
            },
            "name": "iterator:it",
            "references": [
              {
                "name": "Salesforce",
                "url": "https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives",
              },
            ],
          },
        ],
        "tags": [
          {
            "attributes": [
              {
                "description": "Value",
                "name": "value",
              },
              {
                "description": "Unnamed attribute",
              },
              {
                "description": "Untyped attribute",
                "name": "no-type",
              },
              {
                "name": "no-description",
              },
            ],
            "description": "Example
      [View in Component Library](https://developer.salesforce.com/docs/component-library/bundle/lightning-example)
      ### Attributes
      * **value**: *STRING* Value

      * **no-type**
      * **no-description**: *BOOLEAN*
      ",
            "name": "lightning-example",
          },
          {
            "attributes": [],
            "description": "No attributes
      [View in Component Library](https://developer.salesforce.com/docs/component-library/bundle/lightning-empty)
      ### Attributes
      ",
            "name": "lightning-empty",
          },
        ],
        "version": "1.1",
      }
    `);
  });
});
