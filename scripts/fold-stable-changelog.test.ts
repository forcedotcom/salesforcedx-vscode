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

const script = path.resolve(__dirname, 'fold-stable-changelog.js');
const pr = (n: number) => `[PR #${n}](https://example.com/pull/${n})`;

// History: nightly 1.1.1 -> nightly 1.3.1 -> stable v1.4.0 -> hotfix v1.4.1 (branch)
//                                       \-> nightly 1.5.1 (newer pre-release, not in v1.4.0)
const createRepo = () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'fold-changelog-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  const commit = (message: string) => git('commit', '--allow-empty', '-q', '-m', message);
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  commit('one');
  git('tag', 'v1.1.1-nightly.develop.20260101');
  commit('two');
  git('tag', 'v1.3.1-nightly.develop.20260108');
  git('tag', 'v1.4.0');
  git('checkout', '-q', '-b', 'hotfix');
  commit('hotfix');
  git('tag', 'v1.4.1');
  git('checkout', '-q', '-');
  commit('three');
  git('tag', 'v1.5.1-nightly.develop.20260115');
  return repo;
};

const PRERELEASE_HISTORY = `# 1.5.1 - January 22, 2026

## Fixed

#### pkg-b

- Newer fix. (${pr(5)})

# 1.3.1 - January 15, 2026

## Fixed

#### pkg-b

- Second fix. (${pr(3)})

#### pkg-a

- Third fix. (${pr(6)})

## Under the Hood

- We made some under the hood changes. (${pr(4)})

# 1.1.1 - January 8, 2026

## Added

#### pkg-a

- A feature. (${pr(1)})

## Fixed

#### pkg-a

- First fix. (${pr(2)})

## Under the Hood

- We made some under the hood changes. (${pr(7)}, ${pr(2)})

# 1.0.0 - January 1, 2026

## Fixed

#### pkg-a

- Shipped long ago. (${pr(0)})
`;

const FOLDED_1_4_0 = `# 1.4.0 - January 21, 2026

## Added

#### pkg-a

- A feature. (${pr(1)})

## Fixed

#### pkg-a

- Third fix. (${pr(6)})

- First fix. (${pr(2)})

#### pkg-b

- Second fix. (${pr(3)})

## Under the Hood

- We made some under the hood changes. (${pr(2)}, ${pr(4)}, ${pr(7)})
`;

const NEWER = PRERELEASE_HISTORY.slice(0, PRERELEASE_HISTORY.indexOf('# 1.3.1'));
const SHIPPED = PRERELEASE_HISTORY.slice(PRERELEASE_HISTORY.indexOf('# 1.0.0'));

describe('fold-stable-changelog', () => {
  let repo: string;
  const file = (name: string) => path.join(repo, name);
  const read = (name: string) => fs.readFileSync(file(name), 'utf8');
  const write = (name: string, contents: string) => fs.writeFileSync(file(name), contents);
  const run = (...args: string[]) =>
    execFileSync(process.execPath, [script, '--date', 'January 21, 2026', ...args], { cwd: repo, encoding: 'utf8' });

  beforeEach(() => {
    repo = createRepo();
    write('CHANGELOG.md', PRERELEASE_HISTORY);
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  test('--write folds every contained pre-release and keeps newer pre-releases and shipped history', () => {
    const output = run('--changelog', 'CHANGELOG.md', '--ref', 'v1.4.0', '--version', '1.4.0', '--write');

    expect(output).toContain('Folded # 1.3.1, # 1.1.1 into # 1.4.0');
    expect(read('CHANGELOG.md')).toBe(`${NEWER}${FOLDED_1_4_0}\n${SHIPPED}`);
  });

  test('--write is idempotent', () => {
    run('--changelog', 'CHANGELOG.md', '--ref', 'v1.4.0', '--version', '1.4.0', '--write');
    const once = read('CHANGELOG.md');

    const output = run('--changelog', 'CHANGELOG.md', '--ref', 'v1.4.0', '--version', '1.4.0', '--write');

    expect(output).toContain('# 1.4.0 already in CHANGELOG.md');
    expect(read('CHANGELOG.md')).toBe(once);
  });

  test('--section-out writes only the stable section', () => {
    write('package.md', '# 1.3.1 - January 15, 2026\n\nlast week\n');

    run('--changelog', 'CHANGELOG.md', '--ref', 'v1.4.0', '--version', '1.4.0', '--section-out', 'package.md');

    expect(read('package.md')).toBe(FOLDED_1_4_0);
    expect(read('CHANGELOG.md')).toBe(PRERELEASE_HISTORY);
  });

  test('--section-out keeps a section already prepared for this version', () => {
    write('package.md', '# 1.4.0 - January 21, 2026\n\nprepared by hand\n');

    const output = run(
      '--changelog',
      'CHANGELOG.md',
      '--ref',
      'v1.4.0',
      '--version',
      '1.4.0',
      '--section-out',
      'package.md'
    );

    expect(output).toContain('already starts with # 1.4.0');
    expect(read('package.md')).toBe('# 1.4.0 - January 21, 2026\n\nprepared by hand\n');
  });

  test('--overlay replaces a pre-release section before folding', () => {
    write('package.md', `# 1.3.1 - January 15, 2026\n\n## Fixed\n\n#### pkg-b\n\n- Second fix, polished. (${pr(3)})\n`);

    run('--changelog', 'CHANGELOG.md', '--ref', 'v1.4.0', '--version', '1.4.0', '--overlay', 'package.md', '--write');

    expect(read('CHANGELOG.md')).toContain(`- Second fix, polished. (${pr(3)})`);
    expect(read('CHANGELOG.md')).not.toContain(`- Second fix. (${pr(3)})`);
  });

  test('--fallback-section inserts hotfix notes above shipped history when nothing is folded', () => {
    run('--changelog', 'CHANGELOG.md', '--ref', 'v1.4.0', '--version', '1.4.0', '--write');
    const folded = read('CHANGELOG.md');
    write('hotfix.md', `# 1.4.1 - January 23, 2026\n\n## Fixed\n\n#### pkg-a\n\n- Hotfix. (${pr(8)})\n`);

    run(
      '--changelog',
      'CHANGELOG.md',
      '--ref',
      'v1.4.1',
      '--version',
      '1.4.1',
      '--fallback-section',
      'hotfix.md',
      '--write'
    );

    expect(read('CHANGELOG.md')).toBe(
      folded.replace(
        '# 1.4.0',
        `# 1.4.1 - January 23, 2026\n\n## Fixed\n\n#### pkg-a\n\n- Hotfix. (${pr(8)})\n\n# 1.4.0`
      )
    );
  });

  test('leaves files unchanged when nothing is contained and there is no fallback', () => {
    run('--changelog', 'CHANGELOG.md', '--ref', 'v1.4.0', '--version', '1.4.0', '--write');
    const folded = read('CHANGELOG.md');
    write('package.md', 'unchanged\n');

    const output = run(
      '--changelog',
      'CHANGELOG.md',
      '--ref',
      'v1.4.1',
      '--version',
      '1.4.1',
      '--section-out',
      'package.md',
      '--write'
    );

    expect(output).toContain('Nothing to fold');
    expect(read('CHANGELOG.md')).toBe(folded);
    expect(read('package.md')).toBe('unchanged\n');
  });

  test('fails instead of skipping when the ref does not exist', () => {
    expect(() => run('--changelog', 'CHANGELOG.md', '--ref', 'v9.9.9', '--version', '9.9.9', '--write')).toThrow();
    expect(read('CHANGELOG.md')).toBe(PRERELEASE_HISTORY);
  });
});
