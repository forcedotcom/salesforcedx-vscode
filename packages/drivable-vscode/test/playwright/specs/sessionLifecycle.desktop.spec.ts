/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { expect, test } from '@playwright/test';
import * as Schema from 'effect/Schema';
// eslint-disable-next-line no-restricted-imports -- desktop-only Playwright test verifies on-disk session artifacts
import { access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../../../..');
const startedSession = Schema.parseJson(
  Schema.Struct({ runId: Schema.String, artifactDir: Schema.String, workspaceDir: Schema.String })
);
const text = (result: CallToolResult): string => {
  expect(result.isError, JSON.stringify(result.content)).not.toBe(true);
  const content = result.content[0];
  expect(content.type).toBe('text');
  return content.type === 'text' ? content.text : '';
};

test.skip(process.platform !== 'darwin', 'macOS default TMPDIR socket-path smoke test');

test('starts the VS Code workbench and finishes without an org using macOS TMPDIR', async ({}, testInfo) => {
  const client = new Client({ name: 'drivable-vscode-macos-smoke', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(repoRoot, 'packages/drivable-vscode/bin/drivable-vscode-mcp.js')],
    cwd: repoRoot,
    // StdioClientTransport otherwise inherits only a small allowlist that excludes TMPDIR.
    env: Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
    )
  });

  expect(process.env.TMPDIR).toBeTruthy();
  expect(tmpdir()).toBe(process.env.TMPDIR?.replace(/\/$/, ''));

  try {
    await client.connect(transport);
    const call = async (name: string, args: Record<string, unknown> = {}) =>
      text(CallToolResultSchema.parse(await client.callTool({ name, arguments: args }, CallToolResultSchema)));
    const session = await test.step('start and wait for the workbench', async () =>
      Schema.decodeUnknownSync(startedSession)(
        await call('start', {
          objective: 'Smoke test macOS VS Code startup',
          extensionMode: 'dev',
          repoRoot,
          artifactRoot: testInfo.outputPath('drivable-vscode')
        })
      ));

    try {
      await test.step('verify running without an org', async () => {
        expect(JSON.parse(await call('status'))).toEqual(
          expect.objectContaining({ state: 'running', runId: session.runId })
        );
        expect(JSON.parse(await readFile(resolve(session.artifactDir, 'manifest.json'), 'utf8'))).toEqual(
          expect.not.objectContaining({ orgAlias: expect.anything() })
        );
      });
    } finally {
      await test.step('finish the session', async () => {
        expect(JSON.parse(await call('finish'))).toEqual(expect.objectContaining({ state: 'closed' }));
      });
    }

    await test.step('verify final evidence and workspace cleanup', async () => {
      expect(JSON.parse(await readFile(resolve(session.artifactDir, 'summary.json'), 'utf8'))).toEqual(
        expect.objectContaining({ status: 'completed-with-limitations', runId: session.runId })
      );
      await access(resolve(session.artifactDir, 'screenshots/final.png'));
      await expect(access(session.workspaceDir)).rejects.toThrow();
    });
  } finally {
    await client.close();
  }
});
