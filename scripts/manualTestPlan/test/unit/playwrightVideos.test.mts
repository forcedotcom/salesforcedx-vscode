/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeContext from '@effect/platform-node/NodeContext';
import { Effect } from 'effect';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { crc32, deflateRawSync } from 'node:zlib';
import { collectLane } from '../../playwrightVideos.mts';

const SPEC = 'packages/salesforcedx-vscode-apex-log/test/playwright/specs/executeAnonymous.headless.spec.ts';
const CONTENT = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, ...Buffer.from('webm-final-video')]);
const createSha1 = (content: Buffer) => createHash('sha1').update(content).digest('hex');
const ATTACHMENT = `data/${createSha1(CONTENT)}.webm`;

const zipBytes = (files: readonly { readonly name: string; readonly content: Buffer | string }[]) => {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let localOffset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);
    const compressed = deflateRawSync(content);
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04_03_4b_50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x8_00, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    localHeaders.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02_01_4b_50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x8_00, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((0o10_0644 << 16) >>> 0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralHeaders.push(central, name);
    localOffset += local.length + name.length + compressed.length;
  }
  const centralDirectory = Buffer.concat(centralHeaders);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06_05_4b_50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localHeaders, centralDirectory, end]);
};

const result = (
  status = 'passed',
  retry = 0,
  path: string | undefined = ATTACHMENT,
  timestamp = '2026-11-01T01:00:00Z'
) => ({
  status,
  retry,
  startTime: timestamp,
  attachments: path === undefined ? [] : [{ name: 'video', contentType: 'video/webm', path }]
});

const reportBytes = (
  options: {
    readonly tests?: readonly object[];
    readonly sha?: string;
    readonly fileName?: string;
    readonly attachments?: readonly { readonly name: string; readonly content: Buffer | string }[];
  } = {}
) => {
  const summary = {
    metadata: { ci: { commitHash: options.sha ?? 'head' } },
    files: [{ fileName: options.fileName ?? 'executeAnonymous.headless.spec.ts', fileId: '123' }]
  };
  const metadata = zipBytes([
    { name: 'report.json', content: JSON.stringify(summary) },
    {
      name: '123.json',
      content: JSON.stringify({
        tests: options.tests ?? [
          {
            testId: 'test-123',
            title: 'Execute Anonymous',
            projectName: 'chromium',
            outcome: 'expected',
            results: [result()]
          }
        ]
      })
    }
  ]);
  const html = `<template id="playwrightReportBase64">data:application/zip;base64,${metadata.toString('base64')}</template>`;
  return zipBytes([
    { name: 'index.html', content: html },
    ...(options.attachments ?? [{ name: ATTACHMENT, content: CONTENT }])
  ]);
};

const run = (pairs: readonly { readonly report: string; readonly results: string }[], output: string, sha = 'head') =>
  collectLane(pairs, SPEC, sha, output).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);

const savePair = (
  directory: string,
  id: string,
  report: Buffer,
  results = zipBytes([{ name: 'truncated-unrelated-name/video.webm', content: CONTENT }])
) => {
  const reportPath = join(directory, `${id}-report.zip`);
  const resultsPath = join(directory, `${id}-results.zip`);
  writeFileSync(reportPath, report);
  writeFileSync(resultsPath, results);
  return { report: reportPath, results: resultsPath };
};

test('matches the requested spec and video bytes, not archive filenames', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'playwright-videos-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const [video] = await run([savePair(directory, 'one', reportBytes())], directory);
  assert.ok(video);
  assert.equal(readFileSync(video.path).toString(), CONTENT.toString());
  assert.equal(video.title, 'Execute Anonymous');
});

test('uses only the final successful attempt', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'playwright-videos-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const tests = [
    {
      testId: 'test-123',
      title: 'Execute Anonymous',
      projectName: 'chromium',
      outcome: 'flaky',
      results: [result('failed'), result('passed', 1)]
    }
  ];
  const [video] = await run([savePair(directory, 'flaky', reportBytes({ tests }))], directory);
  assert.equal(video?.retry, 1);
  for (const { outcome, final } of [
    { outcome: 'unexpected', final: result('failed', 1) },
    { outcome: 'skipped', final: result('skipped') },
    { outcome: 'unexpected', final: result('timedOut') }
  ]) {
    const report = reportBytes({ tests: [{ ...tests[0], outcome, results: [final] }] });
    assert.deepEqual(await run([savePair(directory, `${outcome}-${final.status}`, report)], directory), []);
  }
});

test('merges reruns before filtering final status and never guesses missing videos', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'playwright-videos-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const passing = reportBytes();
  const omitted = reportBytes({ fileName: 'another.spec.ts' });
  assert.equal(
    (await run([savePair(directory, 'first', passing), savePair(directory, 'omitted', omitted)], directory)).length,
    1
  );

  const laterFailure = reportBytes({
    tests: [
      {
        testId: 'test-123',
        title: 'Execute Anonymous',
        projectName: 'chromium',
        outcome: 'unexpected',
        results: [result('failed', 1, ATTACHMENT, '2026-11-01T02:00:00Z')]
      }
    ]
  });
  assert.deepEqual(
    await run(
      [savePair(directory, 'first-again', passing), savePair(directory, 'later-failure', laterFailure)],
      directory
    ),
    []
  );

  assert.deepEqual(
    await run(
      [
        savePair(
          directory,
          'missing',
          reportBytes(),
          zipBytes([{ name: 'matching-spec-name/video.webm', content: 'different' }])
        )
      ],
      directory
    ),
    []
  );
});

test('rejects a report for a different commit and unsafe report paths', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'playwright-videos-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  await assert.rejects(run([savePair(directory, 'sha', reportBytes({ sha: 'other' }))], directory), /SHA/);
  await assert.rejects(
    run(
      [
        savePair(
          directory,
          'path',
          reportBytes({
            tests: [
              {
                testId: 'test-123',
                title: 'Execute Anonymous',
                projectName: 'chromium',
                outcome: 'expected',
                results: [result('passed', 0, '../secret.webm')]
              }
            ]
          })
        )
      ],
      directory
    ),
    /Unexpected video attachment path/
  );
});

test('strict ZIP filename validation rejects traversal and backslashes', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'playwright-videos-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const [index, name] of ['../outside.webm', '/outside.webm', 'C:/outside.webm', 'test\\outside.webm'].entries()) {
    await assert.rejects(
      run([savePair(directory, `unsafe-${index}`, reportBytes(), zipBytes([{ name, content: CONTENT }]))], directory),
      /Unsafe|invalid|absolute|relative/
    );
  }
});
