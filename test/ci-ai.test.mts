import * as NodeContext from '@effect/platform-node/NodeContext';
import { ConfigProvider, Effect, Either } from 'effect';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import { changelogBody } from '../scripts/changelogBody/changelogBody.mts';
import { buildPrompt, parseAgentResult } from '../scripts/shared/categoryDecision.mts';
import { openCodePrompt } from '../scripts/shared/openCode.mts';
import {
  changelogRepo,
  commands,
  config,
  events,
  git,
  nodeCommand,
  pull,
  sections,
  tempDirectory
} from './ciAiFixtures.mts';

test('category judgment uses one configured model, stdin, isolated configuration, and no inherited credentials', async t => {
  const directory = tempDirectory(t);
  const capturePath = join(directory, 'capture.json');
  const policy = readFileSync(new URL('../APPROVAL_POLICY.md', import.meta.url), 'utf8');
  const result = await openCodePrompt({ prompt: buildPrompt(policy, '+untrusted diff') }).pipe(
    Effect.provide(
      commands(command => {
        assert.equal(command.command, 'opencode');
        const environment = Object.fromEntries(command.env);
        const allowed = new Set([
          'HOME',
          'PWD',
          'PATH',
          'XDG_CONFIG_HOME',
          'XDG_DATA_HOME',
          'XDG_STATE_HOME',
          'XDG_CACHE_HOME',
          'OPENCODE_API_KEY'
        ]);
        for (const key of Object.keys(process.env)) {
          if (!allowed.has(key)) assert.equal(environment[key], '', `${key} leaked into the agent`);
        }
        assert.deepEqual(command.args, [
          '--standalone',
          'run',
          '--agent',
          'judgment',
          '--format',
          'json',
          '--model',
          'opencode/first'
        ]);
        return nodeCommand(
          command,
          `
        const fs = require('node:fs');
        let prompt = '';
        process.stdin.on('data', chunk => prompt += chunk);
        process.stdin.on('end', () => {
          fs.writeFileSync(${JSON.stringify(capturePath)}, JSON.stringify({ prompt, cwd: process.cwd(), home: fs.realpathSync(process.env.HOME), env: process.env, config: JSON.parse(fs.readFileSync('opencode.json', 'utf8')) }));
          process.stdout.write(${JSON.stringify(events('{"categories":["prose"]}'))});
        });
      `
        );
      })
    ),
    Effect.provide(NodeContext.layer),
    Effect.withConfigProvider(config()),
    Effect.runPromise
  );
  assert.deepEqual(parseAgentResult(result), ['prose']);
  const captured = JSON.parse(readFileSync(capturePath, 'utf8'));
  assert.match(captured.prompt, /Diff:\n\+untrusted diff/);
  assert.equal(captured.home, captured.cwd);
  assert.notEqual(captured.cwd, process.cwd());
  assert.equal(existsSync(captured.cwd), false, 'temporary state is removed');
  assert.equal(captured.env.OPENCODE_API_KEY, 'test-key');
  for (const key of ['IDEE_GH_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN', 'OPENCODE_SESSION_ID']) {
    assert.ok(captured.env[key] === undefined || captured.env[key] === '', `${key} leaked into the agent`);
  }
  assert.deepEqual(captured.config.agents.judgment.permissions, [{ action: '*', resource: '*', effect: 'deny' }]);
  assert.equal(JSON.stringify(captured.config).includes('test-key'), false);
});

for (const output of [
  '',
  'not json',
  events(''),
  events('{"categories":["prose"]}', 'length'),
  events('{"categories":["prose"]}').replace('step_finish', 'other'),
  `${events('ok')}{"type":"error"}\n`
]) {
  test(`rejects incomplete or invalid OpenCode output: ${JSON.stringify(output)}`, async () => {
    const result = await openCodePrompt({ prompt: 'judge' }).pipe(
      Effect.provide(commands(command => nodeCommand(command, `process.stdout.write(${JSON.stringify(output)});`))),
      Effect.provide(NodeContext.layer),
      Effect.withConfigProvider(config()),
      Effect.either,
      Effect.runPromise
    );
    assert.equal(result._tag, 'Left');
  });
}

test('uses only final-step text and never retries a failed process', async () => {
  let calls = 0;
  const run = (output: string, code: number) =>
    openCodePrompt({ prompt: 'judge' }).pipe(
      Effect.provide(
        commands(command => {
          calls += 1;
          return nodeCommand(command, `process.stdout.write(${JSON.stringify(output)}); process.exitCode = ${code};`);
        })
      ),
      Effect.provide(NodeContext.layer),
      Effect.withConfigProvider(config()),
      Effect.either,
      Effect.runPromise
    );
  assert.deepEqual(
    await run(events('progress', 'tool-calls') + events('{"categories":[]}'), 0),
    Either.right('{"categories":[]}')
  );
  assert.equal((await run(events('{"categories":["prose"]}'), 2))._tag, 'Left');
  assert.equal(calls, 2);
});

for (const models of ['', '[]', 'not json', '["auto"]', '["opencode/first", 3]']) {
  test(`invalid model configuration fails before starting OpenCode: ${models}`, async () => {
    const result = await openCodePrompt({ prompt: 'judge' }).pipe(
      Effect.provide(
        commands(() => {
          assert.fail('OpenCode must not start');
        })
      ),
      Effect.provide(NodeContext.layer),
      Effect.withConfigProvider(config(models)),
      Effect.either,
      Effect.runPromise
    );
    assert.equal(result._tag, 'Left');
  });
}

test('missing or empty API key fails before starting OpenCode', async () => {
  for (const entries of [[], [['OPENCODE_API_KEY', '']]]) {
    const result = await openCodePrompt({ prompt: 'judge' }).pipe(
      Effect.provide(
        commands(() => {
          assert.fail('OpenCode must not start');
        })
      ),
      Effect.provide(NodeContext.layer),
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map(entries.map(([key, value]) => [key, value] as const)))),
      Effect.either,
      Effect.runPromise
    );
    assert.equal(result._tag, 'Left');
  }
});

test('changelog migration keeps rendered links and rejects missing PRs, duplicate PRs, and invalid packages', async t => {
  const cwd = changelogRepo(t);
  const run = (reply: unknown, from = 'from', to = 'HEAD') =>
    changelogBody({ cwd, from, to }).pipe(
      Effect.provide(
        commands(command => {
          if (command.command === 'gh')
            return nodeCommand(command, `process.stdout.write(${JSON.stringify(JSON.stringify(pull))});`);
          if (command.command !== 'opencode') return command;
          return nodeCommand(
            command,
            `
        let prompt = '';
        process.stdin.on('data', chunk => prompt += chunk);
        process.stdin.on('end', () => {
          require('node:assert/strict').match(prompt, /Changelog judgment/);
          process.stdout.write(${JSON.stringify(events(JSON.stringify(reply)))});
        });
      `
          );
        })
      ),
      Effect.provide(NodeContext.layer),
      Effect.withConfigProvider(config()),
      Effect.either,
      Effect.runPromise
    );
  const rendered = await run(sections);
  assert.equal(rendered._tag, 'Right');
  if (rendered._tag === 'Right') {
    assert.match(rendered.right, /## Added\n\n#### salesforcedx-vscode-core/);
    assert.match(rendered.right, /We added a feature\./);
    assert.match(rendered.right, /pull\/12/);
    assert.match(rendered.right, /issues\/42/);
    assert.equal(rendered.right.includes('W-123'), false);
  }
  for (const reply of [
    { ...sections, Added: [] },
    { ...sections, Fixed: sections.Added },
    { ...sections, Added: [{ ...sections.Added[0], package: 'other' }] },
    { ...sections, Added: [], 'Under the Hood': sections.Added }
  ])
    assert.equal((await run(reply))._tag, 'Left');
  assert.equal((await run(sections, 'HEAD', 'HEAD'))._tag, 'Left');
  git(cwd, 'commit', '--allow-empty', '-m', 'chore: skipped');
  const empty = await run(sections, 'HEAD~1', 'HEAD');
  assert.equal(empty._tag, 'Right');
  if (empty._tag === 'Right') assert.equal(empty.right, '');
});

test('workflows keep trusted approval execution and share the OpenCode key and model list', () => {
  for (const name of ['changelog-body', 'categoryApprove', 'manual-test-plan']) {
    const text = readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
    assert.match(text, /OPENCODE_API_KEY: \$\{\{ secrets.OPENCODE_API_KEY \}\}/);
    assert.match(text, /OPENCODE_MODELS: \$\{\{ vars.OPENCODE_MODELS \}\}/);
    if (name !== 'categoryApprove') assert.doesNotMatch(text, /CURSOR|cursor|elif/);
  }
  const workflow = parse(readFileSync(new URL('../.github/workflows/categoryApprove.yml', import.meta.url), 'utf8'));
  const steps = workflow.jobs['category-approve'].steps;
  const install = steps.find((step: { name?: string }) => step.name === 'Install OpenCode CLI');
  assert.equal(install.if, "steps.preflight.outputs.result == 'true' && steps.approver.outputs.cli == 'opencode'");
  assert.match(steps.at(-1).run, /node "\$RUNNER_TEMP\/trusted-approver\/scripts\/categoryApprove.mts"/);
});

test('category approval selects the runtime and credentials matching trusted develop during rollout', t => {
  const workflow = parse(readFileSync(new URL('../.github/workflows/categoryApprove.yml', import.meta.url), 'utf8'));
  const steps = workflow.jobs['category-approve'].steps;
  const select = steps.find((step: { id?: string }) => step.id === 'approver');
  assert.equal(select.if, "steps.preflight.outputs.result == 'true'");
  const directory = tempDirectory(t);
  const scripts = join(directory, 'trusted-approver/scripts');
  mkdirSync(scripts, { recursive: true });
  for (const [cli, source] of [
    ['cursor', "Command.make('agent'); Config.string('CURSOR_API_KEY');"],
    ['opencode', readFileSync(new URL('../scripts/categoryApprove.mts', import.meta.url), 'utf8')]
  ]) {
    const output = join(directory, `${cli}.txt`);
    writeFileSync(join(scripts, 'categoryApprove.mts'), source);
    execFileSync('bash', ['-eu', '-c', select.run], {
      env: { ...process.env, RUNNER_TEMP: directory, GITHUB_OUTPUT: output }
    });
    assert.equal(readFileSync(output, 'utf8'), `cli=${cli}\n`);
  }
  const legacyInstall = steps.find(
    (step: { name?: string }) => step.name === 'Install Cursor CLI for legacy trusted approver'
  );
  assert.equal(legacyInstall.if, "steps.preflight.outputs.result == 'true' && steps.approver.outputs.cli == 'cursor'");
  assert.match(legacyInstall.run, /curl https:\/\/cursor.com\/install -fsS \| bash/);
  assert.equal(
    steps.at(-1).env.CURSOR_API_KEY,
    "${{ steps.approver.outputs.cli == 'cursor' && secrets.IDEE_CURSOR_API_KEY || '' }}"
  );
});
