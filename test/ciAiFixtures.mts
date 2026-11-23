import * as Command from '@effect/platform/Command';
import * as CommandExecutor from '@effect/platform/CommandExecutor';
import * as NodeContext from '@effect/platform-node/NodeContext';
import { ConfigProvider, Effect, Layer } from 'effect';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';

export const tempDirectory = (t: TestContext) => {
  const directory = mkdtempSync(join(tmpdir(), 'ci-ai-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
};

export const commands = (replace: (command: Command.StandardCommand) => Command.Command) =>
  Layer.effect(
    CommandExecutor.CommandExecutor,
    CommandExecutor.CommandExecutor.pipe(
      Effect.map(executor =>
        CommandExecutor.makeExecutor(command => {
          if (command._tag !== 'StandardCommand') throw new Error('Unexpected pipeline');
          return executor.start(replace(command));
        })
      )
    )
  ).pipe(Layer.provide(NodeContext.layer));

export const nodeCommand = (command: Command.StandardCommand, code: string) =>
  Command.make(process.execPath, '-e', code, '--', ...command.args).pipe(
    Command.env(Object.fromEntries(command.env)),
    Command.stdin(command.stdin),
    Command.workingDirectory(command.cwd._tag === 'Some' ? command.cwd.value : process.cwd())
  );

export const events = (text: string, reason = 'stop') =>
  [{ type: 'step_start' }, { type: 'text', part: { text } }, { type: 'step_finish', part: { reason } }]
    .map(event => JSON.stringify(event))
    .join('\n') + '\n';

export const config = (models = '["opencode/first","opencode/second"]') =>
  ConfigProvider.fromMap(
    new Map([
      ['OPENCODE_API_KEY', 'test-key'],
      ['OPENCODE_MODELS', models],
      ['PATH', process.env.PATH ?? '']
    ])
  );

const gitEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
export const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, {
    cwd,
    env: {
      ...gitEnv,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@example.com'
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();

export const changelogRepo = (t: TestContext) => {
  const cwd = tempDirectory(t);
  git(cwd, 'init', '-b', 'develop');
  const skill = '.opencode/skills/changelog-judgment/SKILL.md';
  mkdirSync(join(cwd, '.opencode/skills/changelog-judgment'), { recursive: true });
  writeFileSync(join(cwd, skill), readFileSync(new URL(`../${skill}`, import.meta.url)));
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-m', 'chore: base');
  git(cwd, 'tag', 'from');
  mkdirSync(join(cwd, 'packages/salesforcedx-vscode-core/src'), { recursive: true });
  writeFileSync(join(cwd, 'packages/salesforcedx-vscode-core/src/feature.ts'), 'export const feature = true;\n');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-m', 'feat: [W-123] a feature (#12)');
  return cwd;
};

export const pull = {
  title: 'A feature',
  body: '### What issues does this PR fix or reference?\nhttps://github.com/forcedotcom/salesforcedx-vscode/issues/42',
  labels: []
};
export const sections = {
  Added: [{ pr: 12, sentence: 'We added a feature.', package: 'salesforcedx-vscode-core' }],
  Fixed: [],
  Changed: [],
  'Under the Hood': []
};
