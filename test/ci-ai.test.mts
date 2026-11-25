import * as NodeServices from '@effect/platform-node/NodeServices';
import { ConfigProvider, Effect, Result } from 'effect';
import * as Option from 'effect/Option';
import * as Redacted from 'effect/Redacted';
import * as ChildProcess from 'effect/process/ChildProcess';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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

const modelArgument = (command: ChildProcess.StandardCommand) => {
  const value = command.args.at(-1);
  assert.ok(value);
  return typeof value === 'string' ? value : Redacted.value(value);
};

test('category judgment uses the first configured model with isolated stdin and credentials', async t => {
  const directory = tempDirectory(t);
  const capturePath = join(directory, 'capture.json');
  const policy = readFileSync(new URL('../APPROVAL_POLICY.md', import.meta.url), 'utf8');
  const result = await openCodePrompt({ prompt: buildPrompt(policy, '+untrusted diff') }).pipe(
    Effect.provide(
      commands(command => {
        assert.equal(command.command, 'opencode');
        const environment = Object.fromEntries(Object.entries(command.options.env ?? {}));
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
          process.stdout.write(${JSON.stringify(events('{"covered":true,"categories":["tests-only"]}'))});
        });
      `
        );
      })
    ),
    Effect.provide(NodeServices.layer),
    Effect.provide(ConfigProvider.layer(config())),
    Effect.runPromise
  );
  assert.deepEqual(parseAgentResult(result), Option.some(['tests-only']));
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
    let calls = 0;
    const result = await openCodePrompt({ prompt: 'judge' }).pipe(
      Effect.provide(
        commands(command => {
          calls += 1;
          return nodeCommand(command, `process.stdout.write(${JSON.stringify(output)});`);
        })
      ),
      Effect.provide(NodeServices.layer),
      Effect.provide(ConfigProvider.layer(config())),
      Effect.result,
      Effect.runPromise
    );
    assert.equal(result._tag, 'Failure');
    assert.equal(calls, 1);
  });
}

test('uses only final-step text and does not retry non-retryable process failures', async () => {
  let calls = 0;
  const run = (output: string, code: number) =>
    openCodePrompt({ prompt: 'judge' }).pipe(
      Effect.provide(
        commands(command => {
          calls += 1;
          return nodeCommand(command, `process.stdout.write(${JSON.stringify(output)}); process.exitCode = ${code};`);
        })
      ),
      Effect.provide(NodeServices.layer),
      Effect.provide(ConfigProvider.layer(config())),
      Effect.result,
      Effect.runPromise
    );
  assert.deepEqual(
    await run(events('progress', 'tool-calls') + events('{"categories":[]}'), 0),
    Result.succeed('{"categories":[]}')
  );
  assert.equal((await run(events('{"categories":["prose"]}'), 2))._tag, 'Failure');
  assert.equal(calls, 2);
});

for (const message of [
  'HTTP 410 Gone',
  'HTTP 429 Too Many Requests',
  'RateLimit.FreeUsageLimitError',
  'Free usage limit reached',
  'ModelUnavailableError',
  'ProviderModelNotFoundError',
  'Model is unavailable',
  'Model opencode/first not found',
  'No free models available'
]) {
  for (const errorEvent of [false, true]) {
    test(`retries ${errorEvent ? 'error event' : 'process failure'}: ${message}`, async () => {
      const attemptedModels: string[] = [];
      const output = errorEvent ? JSON.stringify({ type: 'error', error: { message } }) + '\n' : message;
      const result = await openCodePrompt({ prompt: 'judge' }).pipe(
        Effect.provide(
          commands(command => {
            const model = modelArgument(command);
            attemptedModels.push(model);
            return nodeCommand(
              command,
              model === 'opencode/first'
                ? `process.${errorEvent ? 'stdout' : 'stderr'}.write(${JSON.stringify(output)}); process.exitCode = ${errorEvent ? 0 : 1};`
                : `process.stdout.write(${JSON.stringify(events('{"categories":["prose"]}'))});`
            );
          })
        ),
        Effect.provide(ConfigProvider.layer(config('["opencode/first","opencode/second","opencode/third"]'))),
        Effect.result,
        Effect.runPromise
      );

      assert.deepEqual(result, Result.succeed('{"categories":["prose"]}'));
      assert.deepEqual(attemptedModels, ['opencode/first', 'opencode/second']);
    });
  }
}

test('continues through multiple model errors until a configured model succeeds', async () => {
  const attemptedModels: string[] = [];
  const result = await openCodePrompt({ prompt: 'judge' }).pipe(
    Effect.provide(
      commands(command => {
        const model = modelArgument(command);
        attemptedModels.push(model);
        return nodeCommand(
          command,
          model === 'opencode/third'
            ? `process.stdout.write(${JSON.stringify(events('{"categories":["prose"]}'))});`
            : `process.stdout.write(${JSON.stringify(JSON.stringify({ type: 'error', error: { name: 'APIError', data: { statusCode: model === 'opencode/first' ? 410 : 429 } } }) + '\n')});`
        );
      })
    ),
    Effect.provide(ConfigProvider.layer(config('["opencode/first","opencode/second","opencode/third"]'))),
    Effect.result,
    Effect.runPromise
  );

  assert.deepEqual(result, Result.succeed('{"categories":["prose"]}'));
  assert.deepEqual(attemptedModels, ['opencode/first', 'opencode/second', 'opencode/third']);
});

for (const configuredModels of [['opencode/only'], ['opencode/third', 'opencode/first', 'opencode/second']]) {
  test(`exhausts configured models in order: ${configuredModels.join(', ')}`, async () => {
    const attemptedModels: string[] = [];
    const result = await openCodePrompt({ prompt: 'judge' }).pipe(
      Effect.provide(
        commands(command => {
          const model = modelArgument(command);
          attemptedModels.push(model);
          return nodeCommand(command, `process.stderr.write('Model unavailable'); process.exitCode = 1;`);
        })
      ),
      Effect.provide(ConfigProvider.layer(config(JSON.stringify(configuredModels)))),
      Effect.result,
      Effect.runPromise
    );

    assert.ok(Result.isFailure(result));
    assert.equal(
      result.failure.message,
      `All configured OpenCode models were unavailable or rate limited (last: ${configuredModels.at(-1)})`
    );
    assert.deepEqual(attemptedModels, configuredModels);
  });
}

for (const [stdout, stderr, code, expectedTag] of [
  ['', 'Invalid API key', 1, 'Left'],
  ['', 'HTTP 403 Forbidden', 1, 'Left'],
  ['', 'Configuration error at line 429', 1, 'Left'],
  ['', 'Failed to read file 410', 1, 'Left'],
  ['', 'Model configuration file not found', 1, 'Left'],
  [JSON.stringify({ type: 'error', error: { message: 'Invalid API key', requestId: '429' } }) + '\n', '', 0, 'Left'],
  [events('Model unavailable HTTP 429 RateLimit.FreeUsageLimitError'), '', 1, 'Left'],
  [events('HTTP 410 is documentation, not an error'), 'HTTP 429 diagnostic', 0, 'Right']
] as const) {
  test(`does not retry unrelated output: ${JSON.stringify({ stdout, stderr, code })}`, async () => {
    const attemptedModels: string[] = [];
    const result = await openCodePrompt({ prompt: 'judge' }).pipe(
      Effect.provide(
        commands(command => {
          const model = modelArgument(command);
          attemptedModels.push(model);
          return nodeCommand(
            command,
            `process.stdout.write(${JSON.stringify(stdout)}); process.stderr.write(${JSON.stringify(stderr)}); process.exitCode = ${code};`
          );
        })
      ),
      Effect.provide(ConfigProvider.layer(config())),
      Effect.result,
      Effect.runPromise
    );

    assert.equal(result._tag, expectedTag === 'Right' ? 'Success' : 'Failure');
    assert.deepEqual(attemptedModels, ['opencode/first']);
  });
}

test('stops at an unrelated failure after a retryable model error', async () => {
  const attemptedModels: string[] = [];
  const result = await openCodePrompt({ prompt: 'judge' }).pipe(
    Effect.provide(
      commands(command => {
        const model = modelArgument(command);
        attemptedModels.push(model);
        return nodeCommand(
          command,
          `process.stderr.write(${JSON.stringify(model === 'opencode/first' ? 'HTTP 429' : 'Invalid API key')}); process.exitCode = 1;`
        );
      })
    ),
    Effect.provide(ConfigProvider.layer(config('["opencode/first","opencode/second","opencode/third"]'))),
    Effect.result,
    Effect.runPromise
  );

  assert.ok(Result.isFailure(result));
  assert.equal(result.failure.message, 'OpenCode exited 1');
  assert.deepEqual(attemptedModels, ['opencode/first', 'opencode/second']);
});

for (const models of ['', '[]', 'not json', '["auto"]', '["opencode/first", 3]']) {
  test(`invalid model configuration fails before starting OpenCode: ${models}`, async () => {
    const result = await openCodePrompt({ prompt: 'judge' }).pipe(
      Effect.provide(
        commands(() => {
          assert.fail('OpenCode must not start');
        })
      ),
      Effect.provide(NodeServices.layer),
      Effect.provide(ConfigProvider.layer(config(models))),
      Effect.result,
      Effect.runPromise
    );
    assert.equal(result._tag, 'Failure');
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
      Effect.provide(NodeServices.layer),
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(Object.fromEntries(entries)))),
      Effect.result,
      Effect.runPromise
    );
    assert.equal(result._tag, 'Failure');
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
      Effect.provide(NodeServices.layer),
      Effect.provide(ConfigProvider.layer(config())),
      Effect.result,
      Effect.runPromise
    );
  const rendered = await run(sections);
  assert.equal(rendered._tag, 'Success');
  if (Result.isSuccess(rendered)) {
    assert.match(rendered.success, /## Added\n\n#### salesforcedx-vscode-core/);
    assert.match(rendered.success, /We added a feature\./);
    assert.match(rendered.success, /pull\/12/);
    assert.match(rendered.success, /issues\/42/);
    assert.equal(rendered.success.includes('W-123'), false);
  }
  for (const reply of [
    { ...sections, Added: [] },
    { ...sections, Fixed: sections.Added },
    { ...sections, Added: [{ ...sections.Added[0], package: 'other' }] },
    { ...sections, Added: [], 'Under the Hood': sections.Added }
  ])
    assert.equal((await run(reply))._tag, 'Failure');
  assert.equal((await run(sections, 'HEAD', 'HEAD'))._tag, 'Failure');
  git(cwd, 'commit', '--allow-empty', '-m', 'chore: skipped');
  const empty = await run(sections, 'HEAD~1', 'HEAD');
  assert.equal(empty._tag, 'Success');
  if (Result.isSuccess(empty)) assert.equal(empty.success, '');
});

test('workflows keep trusted approval execution and share the OpenCode key and model list', () => {
  for (const name of ['changelog-body', 'categoryApprove', 'manual-test-plan']) {
    const text = readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
    assert.match(text, /OPENCODE_API_KEY: \$\{\{ secrets.OPENCODE_API_KEY \}\}/);
    assert.match(text, /OPENCODE_MODELS: \$\{\{ vars.OPENCODE_MODELS \}\}/);
    assert.doesNotMatch(text, /CURSOR|cursor|elif/);
  }
  const workflow = parse(readFileSync(new URL('../.github/workflows/categoryApprove.yml', import.meta.url), 'utf8'));
  const steps = workflow.jobs['category-approve'].steps;
  const install = steps.find((step: { name?: string }) => step.name === 'Install OpenCode CLI');
  assert.equal(install.if, "steps.preflight.outputs.result == 'true'");
  assert.match(install.run, /--allow-scripts=@opencode\/cli/);
  assert.match(steps.at(-1).run, /node "\$RUNNER_TEMP\/trusted-approver\/scripts\/categoryApprove.mts"/);
});
