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
  user: { login: 'author' },
  labels: [] as Array<{ readonly name: string }>,
  body: 'A bug report'
};
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
  action: 'new-issue' | 'check-feature-request' | 'validate-issue',
  options: {
    readonly issue?: typeof issue | null;
    readonly comments?: readonly unknown[];
    readonly message?: string;
    readonly shouldProcessIssue?: boolean;
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
  vi.stubEnv('IDEE_GH_TOKEN', 'wrong-idee-token');
  vi.stubEnv('GITHUB_TOKEN', 'wrong-github-token');
  vi.stubEnv('INPUT_REPO-TOKEN', options.token ?? 'action-token');
  vi.stubEnv('INPUT_MESSAGE', options.message ?? '');
  vi.stubEnv('INPUT_SHOULD-PROCESS-ISSUE', options.shouldProcessIssue === false ? 'false' : 'true');
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
            payload: { issue: options.issue === null ? undefined : (options.issue ?? issue) },
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
  it('posts the configured message and returns the comment URL', async () => {
    const { calls, setOutput, setFailed } = await runAction('new-issue', { message: 'Exact message\nwith a link' });
    expect(calls.map(({ method, path, body }) => ({ method, path, body }))).toEqual([
      { method: 'GET', path: commentsPath, body: undefined },
      { method: 'POST', path: commentsPath, body: { body: 'Exact message\nwith a link' } }
    ]);
    expect(setOutput).toHaveBeenCalledWith('comment-url', commentUrl);
    expect(setFailed).not.toHaveBeenCalled();
  });

  it('does not repost an existing identical message', async () => {
    const { calls, setOutput } = await runAction('new-issue', {
      message: 'Thank you',
      comments: [{ body: 'Thank you' }]
    });
    expect(calls).toHaveLength(1);
    expect(setOutput).not.toHaveBeenCalled();
  });

  it('posts the default acknowledgement when no message is supplied', async () => {
    const { calls, setOutput } = await runAction('new-issue');
    expect(calls[1]?.body).toEqual({
      body:
        [
          'Thank you for filing this issue.  We appreciate your feedback and will review the issue as soon as possible.',
          "Remember, however, that GitHub isn't a mechanism for receiving support under any agreement or SLA.",
          'If you require immediate assistance, contact Salesforce Customer Support.'
        ].join(' ') + '\n'
    });
    expect(setOutput).toHaveBeenCalledWith('comment-url', commentUrl);
  });

  it.each(['new-issue', 'validate-issue'] as const)('%s skips when issue processing is disabled', async action => {
    const { calls, setFailed } = await runAction(action, { shouldProcessIssue: false });
    expect(calls).toEqual([]);
    expect(setFailed).not.toHaveBeenCalled();
  });

  it.each(['new-issue', 'check-feature-request', 'validate-issue'] as const)(
    '%s fails without an issue payload',
    async action => {
      const { calls, setFailed } = await runAction(action, { issue: null });
      expect(calls).toEqual([]);
      expect(setFailed).toHaveBeenCalledWith('github.context.payload.issue does not exist');
    }
  );

  it.each(['check-feature-request', 'validate-issue'] as const)('%s processes older issues', async action => {
    const { calls, setFailed } = await runAction(action, { issue: { ...issue, created_at: '2023-01-01' } });
    expect(calls[0]).toMatchObject({ method: 'GET', path: commentsPath });
    expect(setFailed).not.toHaveBeenCalled();
  });

  it.each(['new-issue', 'check-feature-request', 'validate-issue'] as const)(
    '%s rejects an empty token instead of using runner credentials or anonymous requests',
    async action => {
      const { calls, setFailed } = await runAction(action, { token: '' });
      expect(calls).toEqual([]);
      expect(setFailed).toHaveBeenCalledWith('Input required and not supplied: repo-token');
    }
  );

  it('recognizes feature requests in author comments and labels before setting output', async () => {
    const { calls, setOutput } = await runAction('check-feature-request', {
      comments: [{ body: 'Feature request: please add this', user: { login: 'author' } }]
    });
    expect(calls[1]).toMatchObject({ method: 'POST', path: labelsPath, body: { labels: ['type:enhancements'] } });
    expect(setOutput).toHaveBeenCalledWith('is_feature_request', 'true');
    expect(setOutput).toHaveBeenCalledWith('should_process_issue', 'false');
  });

  it('does not process issues with an excluded label', async () => {
    const { calls, setOutput } = await runAction('check-feature-request', {
      issue: { ...issue, labels: [{ name: 'announcement' }] }
    });
    expect(calls).toEqual([]);
    expect(setOutput).toHaveBeenCalledWith('should_process_issue', 'false');
  });

  it('ignores feature requests from other commenters', async () => {
    const { calls, setOutput } = await runAction('check-feature-request', {
      comments: [{ body: 'Feature request', user: { login: 'other' } }]
    });
    expect(calls).toHaveLength(1);
    expect(setOutput).toHaveBeenCalledWith('is_feature_request', 'false');
    expect(setOutput).toHaveBeenCalledWith('should_process_issue', 'true');
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

  it.each(['new-issue', 'check-feature-request', 'validate-issue'] as const)(
    '%s reports write permission failures',
    async action => {
      const { setFailed } = await runAction(action, { issue: { ...issue, body: 'Feature request' }, writeStatus: 403 });
      expect(setFailed).toHaveBeenCalled();
    }
  );

  it.each(['validateNewIssues', 'validateUpdatedIssues'])(
    '%s compiles the workspace service before every issue action',
    workflow => {
      const parsed = Schema.decodeUnknownSync(
        Schema.Struct({
          jobs: Schema.Record({
            key: Schema.String,
            value: Schema.Struct({
              steps: Schema.Array(
                Schema.Struct({
                  name: Schema.optional(Schema.String),
                  uses: Schema.optional(Schema.String),
                  run: Schema.optional(Schema.String),
                  with: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String }))
                })
              )
            })
          })
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
