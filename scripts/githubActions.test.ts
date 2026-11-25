/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getInput } from '@actions/core';
import * as Schema from 'effect/Schema';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { parse } from 'yaml';
import { isAnyVersionValid } from '../.github/actions/validate-issue/src/nodeVersions';

const actionRequire = createRequire(__filename);
const commentsPath = '/repos/forcedotcom/salesforcedx-vscode/issues/8610/comments';
const labelsPath = '/repos/forcedotcom/salesforcedx-vscode/issues/8610/labels';
const releasePath = '/repos/microsoft/vscode/releases/latest';
const commentUrl = 'https://github.com/forcedotcom/salesforcedx-vscode/issues/8610#issuecomment-6770740331';
const issue = {
  number: 8610,
  created_at: '2026-11-10T14:59:11Z',
  html_url: 'https://github.com/forcedotcom/salesforcedx-vscode/issues/8610',
  state: 'open',
  user: { login: 'author' },
  labels: [] as Array<{ readonly name: string }>,
  body: 'A bug report'
};
const defaultNewIssueMessage = `${[
  'Thank you for filing this issue.  We appreciate your feedback and will review the issue as soon as possible.',
  "Remember, however, that GitHub isn't a mechanism for receiving support under any agreement or SLA.",
  'If you require immediate assistance, contact Salesforce Customer Support.'
].join(' ')}\n`;
const validBody = [
  'Salesforce Extension Version in VS Code: 68.8.0',
  'VS Code version: 1.120.0',
  'OS and version: macOS 15',
  'Most recent version of the extensions where this was working: 68.7.0',
  'Salesforce CLI Version: 2.157.8'
].join('\n');

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

const runAction = async (
  action: 'validate-issue',
  options: {
    readonly issue?: typeof issue | null;
    readonly comments?: readonly unknown[];
    readonly eventName?: 'issues' | 'issue_comment';
    readonly eventAction?: string;
    readonly eventLabel?: string;
    readonly token?: string;
    readonly release?: unknown;
    readonly releaseStatus?: number;
    readonly writeStatus?: number;
    readonly removeStatus?: number;
  } = {}
) => {
  const calls: { method: string; path: string; body: unknown; authorization: string | null }[] = [];
  const setFailed = vi.fn();
  const setOutput = vi.fn();
  const log = vi.fn();
  const actionDir = resolve('.github/actions', action);
  const execSync = vi.fn(() => Buffer.from(JSON.stringify({ versions: [{ version: '68.8.0' }] })));
  const eventName = options.eventName ?? 'issue_comment';
  const eventAction = options.eventAction ?? 'created';
  const issueFromOptions = options.issue === null ? undefined : (options.issue ?? issue);
  const actionIssue =
    !(eventName === 'issues' && eventAction === 'opened') && issueFromOptions
      ? {
          ...issueFromOptions,
          labels:
            issueFromOptions.labels.length === 0 ? [{ name: 'missing required information' }] : issueFromOptions.labels
        }
      : issueFromOptions;
  vi.stubEnv('IDEE_GH_TOKEN', 'wrong-idee-token');
  vi.stubEnv('GITHUB_TOKEN', 'wrong-github-token');
  vi.stubEnv('INPUT_REPO-TOKEN', options.token ?? 'action-token');
  vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? 'GET';
    if (String(input) === 'https://raw.githubusercontent.com/nodejs/Release/main/schedule.json') {
      return json({ v18: { start: '2023-01-01', end: '2024-01-01' } });
    }
    calls.push({
      method,
      path,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      authorization: new Headers(init?.headers).get('authorization')
    });
    if (path === releasePath) return json(options.release ?? { tag_name: '1.120.2' }, options.releaseStatus);
    if (method === 'GET' && path === commentsPath) return json(options.comments ?? []);
    if (method === 'DELETE') return json({ message: 'Not Found' }, options.removeStatus ?? 404);
    if (method === 'POST' && path === commentsPath) return json({ html_url: commentUrl }, options.writeStatus ?? 201);
    if (method === 'POST' && path === labelsPath) return json([], options.writeStatus);
    if (method === 'PATCH' && path === '/repos/forcedotcom/salesforcedx-vscode/issues/8610') return json({});
    throw new Error(`Unexpected request: ${method} ${path}`);
  });
  // Execute the committed action entry point with the real GitHub service, HTTP serialization, and template reads.
  await runInNewContext(readFileSync(resolve(actionDir, 'lib/index.js'), 'utf8'), {
    exports: {},
    __dirname: resolve(actionDir, 'lib'),
    console: { log, error: log },
    Date,
    require: (id: string) => {
      if (id === '@actions/core')
        return {
          getInput,
          setFailed,
          setOutput
        };
      if (id === '@actions/github')
        return {
          context: {
            eventName,
            payload: {
              issue: actionIssue,
              action: eventAction,
              ...(options.eventLabel === undefined ? {} : { label: { name: options.eventLabel } })
            },
            repo: { owner: 'forcedotcom', repo: 'salesforcedx-vscode' }
          }
        };
      if (id === 'node:child_process') return { execSync };
      if (id === './nodeVersions')
        return {
          isAnyVersionValid
        };
      const required: unknown = actionRequire(id);
      return required;
    }
  });
  expect(calls.every(call => call.authorization === 'token action-token')).toBe(true);
  expect(JSON.stringify([setFailed.mock.calls, log.mock.calls, setOutput.mock.calls])).not.toContain('action-token');
  return { calls, setFailed, setOutput, log, execSync };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('issue actions', () => {
  it('routes a new non-feature issue through acknowledgement and validation', async () => {
    const { calls, setFailed } = await runAction('validate-issue', {
      eventName: 'issues',
      eventAction: 'opened',
      issue: { ...issue, body: validBody }
    });
    expect(calls.map(({ method, path }) => [method, path])).toEqual([
      ['GET', commentsPath],
      ['POST', commentsPath],
      ['GET', releasePath],
      ['POST', labelsPath],
      ['DELETE', `${labelsPath}/missing%20required%20information`]
    ]);
    expect(calls[1]?.body).toEqual({ body: defaultNewIssueMessage });
    expect(calls[3]?.body).toEqual({ labels: ['validated'] });
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('labels a new feature issue and skips acknowledgement and validation', async () => {
    const { calls, setFailed } = await runAction('validate-issue', {
      eventName: 'issues',
      eventAction: 'opened',
      issue: { ...issue, body: 'Feature request: please add this' }
    });
    expect(calls.map(({ method, path }) => [method, path])).toEqual([
      ['GET', commentsPath],
      ['POST', labelsPath]
    ]);
    expect(calls[1]?.body).toEqual({ labels: ['type:enhancements'] });
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('posts a feature acknowledgement when a feature label is added', async () => {
    const { calls, setFailed } = await runAction('validate-issue', {
      eventName: 'issues',
      eventAction: 'labeled',
      eventLabel: 'feature',
      issue: { ...issue, labels: [{ name: 'feature' }] }
    });
    expect(calls.map(({ method, path }) => [method, path])).toEqual([
      ['GET', commentsPath],
      ['POST', commentsPath]
    ]);
    expect(calls[1]?.body).toMatchObject({ body: expect.stringContaining('next grooming session') });
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('posts a support referral when an issue is assigned to another team', async () => {
    const { calls, setFailed } = await runAction('validate-issue', {
      eventName: 'issues',
      eventAction: 'labeled',
      eventLabel: 'status:owned by another team',
      issue: { ...issue, labels: [{ name: 'status:owned by another team' }] }
    });
    expect(calls.map(({ method, path }) => [method, path])).toEqual([
      ['GET', commentsPath],
      ['POST', commentsPath]
    ]);
    expect(calls[1]?.body).toMatchObject({ body: expect.stringContaining('official support channels') });
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('posts the combined feature and other-team message before validation', async () => {
    const { calls, setFailed } = await runAction('validate-issue', {
      eventName: 'issues',
      eventAction: 'labeled',
      eventLabel: 'status:owned by another team',
      issue: { ...issue, labels: [{ name: 'type:enhancements' }, { name: 'status:owned by another team' }] }
    });
    expect(calls.map(({ method, path }) => [method, path])).toEqual([
      ['GET', commentsPath],
      ['POST', commentsPath]
    ]);
    expect(calls[1]?.body).toMatchObject({ body: expect.stringContaining('IdeaExchange') });
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('validate-issue skips an update that does not need validation', async () => {
    const { calls, setFailed } = await runAction('validate-issue', {
      eventName: 'issues',
      eventAction: 'edited',
      issue: { ...issue, labels: [{ name: 'validated' }] }
    });
    expect(calls).toEqual([]);
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('fails without an issue payload', async () => {
    const { calls, setFailed } = await runAction('validate-issue', { issue: null });
    expect(calls).toEqual([]);
    expect(setFailed).toHaveBeenCalledWith('github.context.payload.issue does not exist');
  });

  it('processes older issues', async () => {
    const { calls, setFailed } = await runAction('validate-issue', { issue: { ...issue, created_at: '2023-01-01' } });
    expect(calls[0]).toMatchObject({ method: 'GET', path: commentsPath });
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('rejects an empty token instead of using runner credentials or anonymous requests', async () => {
    const { calls, setFailed } = await runAction('validate-issue', { token: '' });
    expect(calls).toEqual([]);
    expect(setFailed).toHaveBeenCalledWith('Input required and not supplied: repo-token');
  });

  it('validates author-provided versions, reads the latest release, and ignores missing labels', async () => {
    const { calls, setFailed, execSync } = await runAction('validate-issue', {
      comments: [{ body: validBody, user: { login: 'author' } }]
    });
    expect(calls.map(call => [call.method, call.path])).toEqual([
      ['GET', commentsPath],
      ['GET', releasePath],
      ['POST', labelsPath],
      ['DELETE', `${labelsPath}/missing%20required%20information`]
    ]);
    expect(calls[2].body).toEqual({ labels: ['validated'] });
    expect(execSync).toHaveBeenCalledWith('pnpm exec vsce show salesforce.salesforcedx-vscode --json');
    expect(setFailed).not.toHaveBeenCalled();
  });

  it.each(['6.0.0', '7.209.6', '8.0.0'])('rejects unsupported sfdx-cli/%s', async version => {
    const { calls, setFailed } = await runAction('validate-issue', {
      issue: { ...issue, body: validBody.replace('2.157.8', `sfdx-cli/${version}`) }
    });
    const message = readFileSync('.github/actions/validate-issue/messages/deprecated-cli.md', 'utf8')
      .replaceAll('THE_AUTHOR', 'author')
      .replaceAll('OLD_CLI', '`sfdx`');
    expect(calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([
      { body: message },
      { labels: ['missing required information'] },
      { labels: ['missing required information'] }
    ]);
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('accepts sf v2 when an obsolete sfdx version is also reported', async () => {
    const { calls, setFailed } = await runAction('validate-issue', {
      issue: { ...issue, body: `${validBody}\nSalesforce CLI Version: sfdx-cli/6.0.0` }
    });
    expect(calls.filter(call => call.path === commentsPath && call.method === 'POST')).toEqual([]);
    expect(calls).toContainEqual(
      expect.objectContaining({ method: 'POST', path: labelsPath, body: { labels: ['validated'] } })
    );
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('posts the existing required-information template and labels incomplete issues', async () => {
    const { calls, setFailed } = await runAction('validate-issue');
    const expectedMessage = readFileSync(
      '.github/actions/validate-issue/messages/provide-version.md',
      'utf8'
    ).replaceAll('THE_AUTHOR', 'author');
    expect(calls.filter(call => call.path === commentsPath && call.method === 'POST').map(call => call.body)).toEqual([
      { body: expectedMessage }
    ]);
    expect(calls).toContainEqual(
      expect.objectContaining({ method: 'POST', path: labelsPath, body: { labels: ['missing required information'] } })
    );
    expect(
      calls
        .filter(call => call.path === labelsPath)
        .every(call => JSON.stringify(call.body) === JSON.stringify({ labels: ['missing required information'] }))
    ).toBe(true);
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('suppresses existing validation comments', async () => {
    const message = readFileSync('.github/actions/validate-issue/messages/provide-version.md', 'utf8').replaceAll(
      'THE_AUTHOR',
      'author'
    );
    const { calls, setFailed } = await runAction('validate-issue', {
      comments: [{ body: message, user: { login: 'bot' } }]
    });
    expect(calls.filter(call => call.path === commentsPath && call.method === 'POST')).toEqual([]);
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('closes issues using unsupported Node versions with the existing comment', async () => {
    const { calls, setFailed } = await runAction('validate-issue', {
      issue: { ...issue, body: `${validBody} node-v18.0.0` }
    });
    expect(calls).toContainEqual(expect.objectContaining({ method: 'PATCH', body: { state: 'closed' } }));
    const message = readFileSync('.github/actions/validate-issue/messages/unsupported-node.md', 'utf8')
      .replaceAll('THE_AUTHOR', 'author')
      .replaceAll('NODE_VERSION', '18');
    expect(calls).toContainEqual(
      expect.objectContaining({ method: 'POST', path: commentsPath, body: { body: message } })
    );
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('retains the existing minimum VS Code version when release lookup fails', async () => {
    const { calls, setFailed } = await runAction('validate-issue', {
      issue: { ...issue, body: validBody },
      releaseStatus: 403
    });
    expect(calls[2].body).toEqual({ labels: ['validated'] });
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('calculates the minimum VS Code version from the latest release', async () => {
    const { calls, setFailed } = await runAction('validate-issue', {
      issue: { ...issue, body: validBody.replace('1.120.0', '1.117.0') }
    });
    const message = readFileSync('.github/actions/validate-issue/messages/unsupported-vscode.md', 'utf8')
      .replaceAll('THE_AUTHOR', 'author')
      .replaceAll('USER_VERSION', '1.117.0')
      .replaceAll('MIN_VERSION', '1.118.0');
    expect(calls).toContainEqual(
      expect.objectContaining({ method: 'POST', path: commentsPath, body: { body: message } })
    );
    expect(calls.filter(call => call.path === labelsPath).map(call => call.body)).toEqual([
      { labels: ['missing required information'] },
      { labels: ['missing required information'] }
    ]);
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('does not swallow label-removal permission failures', async () => {
    const { setFailed } = await runAction('validate-issue', {
      issue: { ...issue, body: validBody },
      removeStatus: 403
    });
    expect(setFailed).toHaveBeenCalledWith(expect.stringContaining('Not Found'));
  });

  it('reports write permission failures', async () => {
    const { setFailed } = await runAction('validate-issue', {
      issue: { ...issue, body: 'A bug report' },
      writeStatus: 403
    });
    expect(setFailed).toHaveBeenCalled();
  });

  it.each(['validateNewIssues', 'validateUpdatedIssues'])(
    '%s compiles the workspace service before every issue action',
    workflow => {
      const parsed = Schema.decodeUnknownSync(
        Schema.Struct({
          jobs: Schema.Record(
            Schema.String,
            Schema.Struct({
              steps: Schema.Array(
                Schema.Struct({
                  name: Schema.optional(Schema.String),
                  uses: Schema.optional(Schema.String),
                  run: Schema.optional(Schema.String),
                  with: Schema.optional(Schema.Record(Schema.String, Schema.String))
                })
              )
            })
          )
        })
      )(parse(readFileSync(`.github/workflows/${workflow}.yml`, 'utf8')));
      Object.values(parsed.jobs).forEach(job => {
        const actionIndex = job.steps.findIndex(
          step => step.uses?.startsWith('./.github/actions/') && step.uses !== './.github/actions/setup-pnpm'
        );
        expect(job.steps.slice(0, actionIndex)).toContainEqual({
          name: 'Compile effect-octokit',
          run: 'pnpm --filter @salesforce/effect-octokit compile'
        });
        expect(job.steps[actionIndex].with?.['repo-token']).toMatch(/secrets.IDEE_GH_TOKEN/);
      });
    }
  );
});
