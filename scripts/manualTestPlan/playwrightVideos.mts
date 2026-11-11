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
import { crc32 } from 'node:zlib';
import * as yauzl from 'yauzl';

class VideoArchiveError extends Schema.TaggedError<VideoArchiveError>()('VideoArchiveError', {
  message: Schema.String
}) {}

const MAX_ENTRY_SIZE = 100 * 1024 * 1024;
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
      }).pipe(
        Effect.flatMap(entries =>
          Effect.try({
            try: () => {
              const names = new Set<string>();
              for (const entry of entries) {
                const name = entry.fileName;
                if (names.has(name)) throw new Error(`Duplicate ZIP entry: ${name}`);
                names.add(name);
              }
              return entries;
            },
            catch: cause => new VideoArchiveError({ message: getErrorMessage(cause) })
          })
        ),
        Effect.flatMap(entries => use(current, entries))
      ),
    current => Effect.sync(() => current.close())
  );
});

const readEntry = Effect.fn('playwrightVideos.readEntry')(function* (
  archive: yauzl.ZipFile,
  entry: yauzl.Entry,
  maxSize: number
) {
  if (entry.uncompressedSize > maxSize) {
    return yield* new VideoArchiveError({ message: `Oversized ZIP member: ${entry.fileName}` });
  }
  return yield* Effect.tryPromise({
    try: async signal => {
      const stream = await archive.openReadStreamPromise(entry);
      const chunks: Uint8Array[] = [];
      const destroyOnAbort = () => stream.destroy(new Error('ZIP member read interrupted'));
      signal.addEventListener('abort', destroyOnAbort, { once: true });
      try {
        if (signal.aborted) {
          stream.destroy();
          throw new Error('ZIP member read interrupted');
        }
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
      } finally {
        signal.removeEventListener('abort', destroyOnAbort);
      }
      const content = Buffer.concat(chunks);
      if (crc32(content) !== entry.crc32) {
        throw new Error(`Invalid ZIP member data: ${entry.fileName}`);
      }
      return content;
    },
    catch: cause => new VideoArchiveError({ message: getErrorMessage(cause) })
  });
});

const readMember = (archive: yauzl.ZipFile, entries: readonly yauzl.Entry[], name: string, maxSize: number) => {
  const entry = entries.find(candidate => candidate.fileName === name);
  return entry === undefined
    ? Effect.fail(new VideoArchiveError({ message: `Missing ZIP member: ${name}` }))
    : readEntry(archive, entry, maxSize);
};

const decodeUtf8 = (bytes: Buffer) =>
  Effect.try({
    try: () => new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    catch: cause => new VideoArchiveError({ message: `Invalid UTF-8: ${getErrorMessage(cause)}` })
  });

const parseJson = <A, I>(bytes: Buffer, schema: Schema.Schema<A, I>) =>
  decodeUtf8(bytes).pipe(
    Effect.flatMap(text =>
      Effect.try({
        try: () => {
          const value: unknown = JSON.parse(text);
          return value;
        },
        catch: cause => new VideoArchiveError({ message: `Invalid JSON: ${getErrorMessage(cause)}` })
      })
    ),
    Effect.flatMap(Schema.decodeUnknown(schema)),
    Effect.mapError(cause => new VideoArchiveError({ message: getErrorMessage(cause) }))
  );

const readReportTests = Effect.fn('playwrightVideos.readReportTests')(function* (
  report: Buffer,
  spec: string,
  sha: string
) {
  const htmlBytes = yield* withArchive(report, (archive, entries) =>
    readMember(archive, entries, 'index.html', MAX_ENTRY_SIZE)
  );
  const html = yield* decodeUtf8(htmlBytes);
  const match = /id="playwrightReportBase64"[^>]*>\s*data:application\/zip;base64,([A-Za-z0-9+/=]+)/.exec(html);
  if (match === null) {
    return yield* new VideoArchiveError({ message: 'Missing or invalid Playwright report metadata' });
  }
  const encodedMetadata = match[1];
  const metadata = Buffer.from(encodedMetadata, 'base64');
  if (metadata.toString('base64').replace(/=+$/, '') !== encodedMetadata.replace(/=+$/, '')) {
    return yield* new VideoArchiveError({ message: 'Invalid Playwright report metadata encoding' });
  }
  const summaryBytes = yield* withArchive(metadata, (archive, entries) =>
    readMember(archive, entries, 'report.json', MAX_ENTRY_SIZE)
  );
  const summary = yield* parseJson(summaryBytes, ReportSummary);
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
  const fileBytes = yield* withArchive(metadata, (archive, entries) =>
    readMember(archive, entries, `${matchingFile.fileId}.json`, MAX_ENTRY_SIZE)
  );
  return yield* parseJson(fileBytes, PlaywrightFile).pipe(Effect.map(data => data.tests));
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
    if (!entry.fileName.endsWith('.webm') || entry.uncompressedSize > MAX_ENTRY_SIZE) continue;
    const content = yield* readEntry(archive, entry, MAX_ENTRY_SIZE);
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
  const selected = successfulTests(tests).flatMap(({ test, final }) =>
    (final.attachments ?? []).flatMap(attachment => {
      if (attachment.name !== 'video' || attachment.contentType !== 'video/webm') return [];
      return [{ test, final, path: attachment.path }];
    })
  );
  const selectedWithPaths = selected.flatMap(attachment =>
    attachment.path !== undefined && /^data\/[0-9a-f]{40}\.webm$/.test(attachment.path)
      ? [{ ...attachment, path: attachment.path }]
      : []
  );
  if (selectedWithPaths.length !== selected.length) {
    return yield* new VideoArchiveError({ message: 'Unexpected video attachment path' });
  }
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
      readEntry(archive, entry, MAX_ENTRY_SIZE).pipe(
        Effect.map(content => createHash('sha256').update(content).digest('hex'))
      )
    );
  });
  const wanted = new Set(digests);
  const results = yield* fileSystem.readFile(pair.results);
  const byDigest = yield* withArchive(Buffer.from(results), (archive, entries) =>
    readMatchingVideos(archive, entries, wanted)
  );
  return yield* Effect.forEach(selectedWithPaths, (attachment, index) => {
    const digest = digests[index];
    const content = byDigest.get(digest);
    if (content === undefined) {
      return Effect.logWarning('Missing test-results video', { title: attachment.test.title }).pipe(Effect.as([]));
    }
    const path = `${output}/${digest}.webm`;
    return fileSystem
      .writeFile(path, content)
      .pipe(
        Effect.as([
          { path, title: attachment.test.title, project: attachment.test.projectName, retry: attachment.final.retry }
        ])
      );
  }).pipe(Effect.map(videos => videos.flat()));
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
