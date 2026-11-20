import * as NodeContext from '@effect/platform-node/NodeContext';
import { Effect, Schema } from 'effect';
import assert from 'node:assert/strict';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { test } from 'node:test';
import { changelogBody } from '../scripts/changelogBody/changelogBody.mts';
import { manualTestPlanPrompt } from '../scripts/manualTestPlan/manualTestPlan.mts';
import { Judgment } from '../scripts/manualTestPlan/schema.mts';
import { buildPrompt, parseAgentResult } from '../scripts/shared/categoryDecision.mts';
import { openCodePrompt } from '../scripts/shared/openCode.mts';
import { changelogRepo, commands, config, nodeCommand, pull, sections, tempDirectory } from './ciAiFixtures.mts';

// Real, pinned OpenCode CLI with a local mock provider. No live secrets or GitHub writes.
test(
  'OpenCode CLI smoke: changelog, category approval, and read-only manual-plan judgment',
  { timeout: 60_000 },
  async t => {
    const cwd = changelogRepo(t);
    writeFileSync(join(cwd, 'opencode.json'), 'INVALID PR-OWNED CONFIG MUST NOT LOAD');
    const readPath = realpathSync(join(cwd, 'packages/salesforcedx-vscode-core/src/feature.ts'));
    const outsideDirectory = tempDirectory(t);
    const outsidePath = join(outsideDirectory, 'outside.txt');
    writeFileSync(outsidePath, 'MUST_NOT_READ');
    const toolCalls = [
      { name: 'read', arguments: { path: realpathSync(cwd) } },
      { name: 'read', arguments: { path: readPath } },
      { name: 'read', arguments: { path: outsidePath } },
      { name: 'glob', arguments: { path: outsideDirectory, pattern: '*' } },
      { name: 'grep', arguments: { path: outsideDirectory, pattern: 'MUST_NOT_READ' } }
    ];
    const requests: string[] = [];
    const failures: unknown[] = [];
    const server = createServer((request, response) => {
      let raw = '';
      request.setEncoding('utf8');
      request.on('data', chunk => {
        raw += chunk;
      });
      request.on('end', () => {
        try {
          const body = JSON.parse(raw) as {
            model: string;
            messages: { role: string; content?: unknown }[];
            tools?: { function: { name: string } }[];
          };
          assert.equal(body.model, 'first');
          assert.equal(request.headers.authorization, 'Bearer test-key');
          const content = JSON.stringify(body.messages);
          const title = content.includes('You name conversations');
          const changelog = content.includes('Changelog facts:');
          const manual = content.includes('Repository (read-only):');
          const toolReplies = body.messages.filter(message => message.role === 'tool');
          const toolReply = toolReplies.at(-1);
          const names = (body.tools ?? []).map(tool => tool.function.name).sort();
          if (!title) {
            requests.push(manual ? 'manual' : changelog ? 'changelog' : 'category');
            // OpenCode advertises skill even when denied; it still checks permission when called.
            assert.deepEqual(
              names.filter(name => name !== 'skill'),
              manual ? ['read'] : []
            );
          }
          const delta =
            manual && !title && toolReplies.length < toolCalls.length
              ? {
                  tool_calls: [
                    {
                      index: 0,
                      id: `call_${toolReplies.length}`,
                      type: 'function',
                      function: {
                        name: toolCalls[toolReplies.length].name,
                        arguments: JSON.stringify(toolCalls[toolReplies.length].arguments)
                      }
                    }
                  ]
                }
              : {
                  content: title
                    ? 'CI smoke'
                    : manual
                      ? '{"kind":"nothing"}'
                      : changelog
                        ? JSON.stringify(sections)
                        : '{"categories":["prose"]}'
                };
          if (toolReplies.length === 1) assert.match(JSON.stringify(toolReply?.content), /packages/);
          if (toolReplies.length === 2) assert.match(JSON.stringify(toolReply?.content), /export const feature = true/);
          if (toolReplies.length === 3) assert.match(JSON.stringify(toolReply?.content), /permission.rejected/);
          if (toolReplies.length > 3) {
            assert.match(JSON.stringify(toolReply?.content), /No tool named .* is currently available/);
            assert.doesNotMatch(JSON.stringify(toolReply?.content), /outside\.txt/);
          }
          if (toolReplies.length >= 3) assert.doesNotMatch(JSON.stringify(toolReply?.content), /MUST_NOT_READ/);
          response.writeHead(200, { 'Content-Type': 'text/event-stream' });
          const chunk = (value: unknown, finish: string | null) =>
            `data: ${JSON.stringify({ id: 'chatcmpl-smoke', object: 'chat.completion.chunk', created: 1, model: 'first', choices: [{ index: 0, delta: value, finish_reason: finish }] })}\n\n`;
          response.end(
            chunk(delta, null) + chunk({}, 'tool_calls' in delta ? 'tool_calls' : 'stop') + 'data: [DONE]\n\n'
          );
        } catch (error) {
          failures.push(error);
          response.writeHead(400, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: { message: String(error) } }));
        }
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => {
      server.closeAllConnections();
      return new Promise<void>(resolve => server.close(() => resolve()));
    });
    const address = server.address();
    assert.ok(address !== null && typeof address !== 'string');
    const layer = commands(command => {
      if (command.command === 'gh')
        return nodeCommand(command, `process.stdout.write(${JSON.stringify(JSON.stringify(pull))});`);
      if (command.command !== 'opencode') return command;
      // Substitute a local test provider, retaining the generated permissions and stdin.
      return nodeCommand(
        command,
        `
      const fs = require('node:fs');
      const config = JSON.parse(fs.readFileSync('opencode.json', 'utf8'));
      config.providers = { 'ci-smoke': {
        env: ['CI_SMOKE_API_KEY'],
        package: '@opencode/ai/providers/openai-compatible',
        settings: { baseURL: 'http://127.0.0.1:${address.port}/v1', apiKey: '{env:CI_SMOKE_API_KEY}' },
        models: { first: { limit: { context: 32000, output: 2048 }, capabilities: { tools: true } } }
      } };
      fs.writeFileSync('opencode.json', JSON.stringify(config));
      const result = require('node:child_process').spawnSync('opencode', process.argv.slice(1).map(arg => arg === 'opencode/first' ? 'ci-smoke/first' : arg), { stdio: ['inherit', 'pipe', 'pipe'], env: { ...process.env, CI_SMOKE_API_KEY: process.env.OPENCODE_API_KEY, OPENCODE_API_KEY: '' } });
      fs.writeFileSync(${JSON.stringify(join(cwd, 'cli.log'))}, String(result.stderr ?? result.error) + String(result.stdout ?? ''));
      process.stdout.write(result.stdout ?? '');
      process.exitCode = result.status ?? 1;
    `
      );
    });
    const program = Effect.gen(function* () {
      const body = yield* changelogBody({ cwd, from: 'from', to: 'HEAD' });
      assert.match(body, /We added a feature\./);
      assert.match(body, /issues\/42/);
      const categories = yield* openCodePrompt({ prompt: buildPrompt('Return categories JSON.', '+a line of prose') });
      assert.deepEqual(parseAgentResult(categories), ['prose']);
      const manual = yield* manualTestPlanPrompt(cwd, {
        skill: readFileSync(new URL('../.opencode/skills/manual-test-plan-judgment/SKILL.md', import.meta.url), 'utf8'),
        diff: '+export const feature = true;'
      }).pipe(Effect.flatMap(Schema.decodeUnknown(Schema.parseJson(Judgment))));
      assert.deepEqual(manual, { kind: 'nothing' });
    });
    await program
      .pipe(
        Effect.provide(layer),
        Effect.provide(NodeContext.layer),
        Effect.withConfigProvider(config()),
        Effect.runPromise
      )
      .catch(error => {
        throw new AggregateError([error, ...failures, readFileSync(join(cwd, 'cli.log'), 'utf8')], 'CLI smoke failed');
      });
    assert.deepEqual(failures, []);
    assert.deepEqual(requests, ['changelog', 'category', ...toolCalls.map(() => 'manual'), 'manual']);
    assert.equal(readFileSync(readPath, 'utf8'), 'export const feature = true;\n');
  }
);
