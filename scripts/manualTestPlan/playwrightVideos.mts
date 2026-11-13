/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as FileSystem from '@effect/platform/FileSystem';
import { getErrorMessage } from '@salesforce/salesforcedx-utils';
import { Effect, Schema } from 'effect';
import { createHash } from 'node:crypto';
import * as yauzl from 'yauzl';

class VideoArchiveError extends Schema.TaggedError<VideoArchiveError>()('VideoArchiveError', {
  message: Schema.String
}) {}

const ReportSummary = Schema.Struct({
  metadata: Schema.Struct({ ci: Schema.Struct({ commitHash: Schema.String }) }),
  files: Schema.Array(Schema.Struct({ fileName: Schema.String, fileId: Schema.String }))
});
const TestResult = Schema.Struct({
  status: Schema.String,
  retry: Schema.Number,
  startTime: Schema.String,
  attachments: Schema.optional(
    Schema.Array(
      Schema.Struct({ name: Schema.String, contentType: Schema.String, path: Schema.optional(Schema.String) })
    )
  )
});
const PlaywrightTest = Schema.Struct({
  testId: Schema.String,
  title: Schema.String,
  projectName: Schema.String,
  outcome: Schema.String,
  results: Schema.Array(TestResult)
});
const PlaywrightFile = Schema.Struct({ tests: Schema.Array(PlaywrightTest) });

type PlaywrightTest = Schema.Schema.Type<typeof PlaywrightTest>;
type TestResult = Schema.Schema.Type<typeof TestResult>;
type ArchivePair = { readonly report: string; readonly results: string };

const openArchive = Effect.fn('playwrightVideos.openArchive')(function* (bytes: Buffer) {
  return yield* Effect.tryPromise({
    try: () => yauzl.fromBufferPromise(bytes, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }),
    catch: cause => new VideoArchiveError({ message: `Invalid ZIP archive: ${getErrorMessage(cause)}` })
  });
});

const withArchive = Effect.fn('playwrightVideos.withArchive')(function* <A>(
  bytes: Buffer,
  use: (archive: yauzl.ZipFile, entries: readonly yauzl.Entry[]) => Effect.Effect<A, VideoArchiveError>
) {
  return yield* Effect.acquireUseRelease(
    openArchive(bytes),
    current =>
      Effect.tryPromise({
        try: async () => {
          const entries: yauzl.Entry[] = [];
          for await (const entry of current.eachEntry()) entries.push(entry);
          return entries;
        },
        catch: cause => new VideoArchiveError({ message: `Cannot read ZIP entries: ${getErrorMessage(cause)}` })
      }).pipe(Effect.flatMap(entries => use(current, entries))),
    current => Effect.sync(() => current.close())
  );
});

const readEntry = Effect.fn('playwrightVideos.readEntry')(function* (archive: yauzl.ZipFile, entry: yauzl.Entry) {
  return yield* Effect.tryPromise({
    try: async () => {
      const stream = await archive.openReadStreamPromise(entry);
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks);
    },
    catch: cause => new VideoArchiveError({ message: getErrorMessage(cause) })
  });
});

const readMember = (archive: yauzl.ZipFile, entries: readonly yauzl.Entry[], name: string) => {
  const entry = entries.find(candidate => candidate.fileName === name);
  return entry === undefined
    ? Effect.fail(new VideoArchiveError({ message: `Missing ZIP member: ${name}` }))
    : readEntry(archive, entry);
};

const decodeUtf8 = (bytes: Buffer) =>
  Effect.try({
    try: () => new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    catch: cause => new VideoArchiveError({ message: `Invalid UTF-8: ${getErrorMessage(cause)}` })
  });

const parseJson = <A, I>(bytes: Buffer, schema: Schema.Schema<A, I>) =>
  decodeUtf8(bytes).pipe(
    Effect.flatMap(Schema.decodeUnknown(Schema.parseJson(schema))),
    Effect.mapError(cause => new VideoArchiveError({ message: getErrorMessage(cause) }))
  );

const readReportTests = Effect.fn('playwrightVideos.readReportTests')(function* (
  report: Buffer,
  spec: string,
  sha: string
) {
  const match = yield* withArchive(report, (archive, entries) => readMember(archive, entries, 'index.html')).pipe(
    Effect.flatMap(decodeUtf8),
    Effect.map(html => /id="playwrightReportBase64"[^>]*>\s*data:application\/zip;base64,([A-Za-z0-9+/=]+)/.exec(html))
  );
  if (match === null) {
    return yield* new VideoArchiveError({ message: 'Missing or invalid Playwright report metadata' });
  }
  const metadata = Buffer.from(match[1], 'base64');
  const summary = yield* withArchive(metadata, (archive, entries) => readMember(archive, entries, 'report.json')).pipe(
    Effect.flatMap(bytes => parseJson(bytes, ReportSummary))
  );
  if (summary.metadata.ci.commitHash !== sha) {
    return yield* new VideoArchiveError({ message: 'Playwright report SHA does not match PR head' });
  }
  const matchesSpec = (candidate: (typeof summary.files)[number]) =>
    spec.endsWith(`/${candidate.fileName.replaceAll('\\', '/')}`);
  const matchingFile = summary.files.find(matchesSpec);
  if (
    matchingFile === undefined ||
    summary.files.some(candidate => candidate !== matchingFile && matchesSpec(candidate))
  ) {
    return [];
  }
  return yield* withArchive(metadata, (archive, entries) =>
    readMember(archive, entries, `${matchingFile.fileId}.json`)
  ).pipe(
    Effect.flatMap(bytes => parseJson(bytes, PlaywrightFile)),
    Effect.map(data => data.tests)
  );
});

const successfulTests = (tests: readonly PlaywrightTest[]) =>
  tests.flatMap(test => {
    const final = test.results.at(-1);
    return final?.status === 'passed' && (test.outcome === 'expected' || test.outcome === 'flaky')
      ? [{ test, final }]
      : [];
  });

const readMatchingVideos = Effect.fn('playwrightVideos.readMatchingVideos')(function* (
  archive: yauzl.ZipFile,
  entries: readonly yauzl.Entry[],
  wanted: ReadonlySet<string>
) {
  const videos = new Map<string, Buffer>();
  for (const entry of entries) {
    if (!entry.fileName.endsWith('.webm')) continue;
    const content = yield* readEntry(archive, entry);
    const digest = createHash('sha256').update(content).digest('hex');
    if (!wanted.has(digest)) continue;
    videos.set(digest, content);
  }
  return videos;
});

const collectVideos = Effect.fn('playwrightVideos.collectVideos')(function* (
  pair: ArchivePair,
  tests: readonly PlaywrightTest[],
  output: string
) {
  const selectedWithPaths = successfulTests(tests).flatMap(({ test, final }) =>
    (final.attachments ?? []).flatMap(attachment =>
      attachment.name === 'video' && attachment.contentType === 'video/webm' && attachment.path !== undefined
        ? [{ test, final, path: attachment.path }]
        : []
    )
  );
  const fileSystem = yield* FileSystem.FileSystem;
  const report = yield* fileSystem.readFile(pair.report);
  const digests = yield* withArchive(Buffer.from(report), (archive, entries) => {
    const entriesByName = new Map(entries.map(entry => [entry.fileName, entry] as const));
    const selectedEntries = selectedWithPaths.map(attachment => entriesByName.get(attachment.path));
    if (selectedEntries.includes(undefined)) {
      return Effect.fail(new VideoArchiveError({ message: 'Missing Playwright report video' }));
    }
    const resolvedEntries = selectedEntries.filter((entry): entry is yauzl.Entry => entry !== undefined);
    return Effect.forEach(resolvedEntries, entry =>
      readEntry(archive, entry).pipe(Effect.map(content => createHash('sha256').update(content).digest('hex')))
    );
  });
  const wanted = new Set(digests);
  const results = yield* fileSystem.readFile(pair.results);
  const byDigest = yield* withArchive(Buffer.from(results), (archive, entries) =>
    readMatchingVideos(archive, entries, wanted)
  );
  return yield* Effect.forEach(selectedWithPaths, (attachment, index) => {
    const digest = digests[index];
    const path = `${output}/${digest}.webm`;
    return Effect.fromNullable(byDigest.get(digest)).pipe(
      Effect.mapError(() => new VideoArchiveError({ message: `Missing test-results video: ${attachment.test.title}` })),
      Effect.flatMap(content => fileSystem.writeFile(path, content)),
      Effect.as({
        path,
        title: attachment.test.title,
        project: attachment.test.projectName,
        retry: attachment.final.retry
      })
    );
  });
});

export const collectLane = Effect.fn('playwrightVideos.collectLane')(function* (
  pairs: readonly ArchivePair[],
  spec: string,
  sha: string,
  output: string
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const testsByPair = yield* Effect.forEach(pairs, pair =>
    fileSystem.readFile(pair.report).pipe(Effect.flatMap(report => readReportTests(Buffer.from(report), spec, sha)))
  );
  const latest = new Map<string, { readonly timestamp: string; readonly pair: number }>();
  for (const [pair, tests] of testsByPair.entries()) {
    for (const test of tests) {
      const final = test.results.at(-1);
      if (final === undefined) continue;
      const previous = latest.get(test.testId);
      if (previous === undefined || final.startTime > previous.timestamp) {
        latest.set(test.testId, { timestamp: final.startTime, pair });
      }
    }
  }
  const videos = yield* Effect.forEach(pairs, (pair, index) => {
    const ids = new Set([...latest].filter(([, value]) => value.pair === index).map(([testId]) => testId));
    return ids.size === 0
      ? Effect.succeed([])
      : collectVideos(
          pair,
          testsByPair[index].filter(test => ids.has(test.testId)),
          output
        );
  });
  return videos.flat();
});
