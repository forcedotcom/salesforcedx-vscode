/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as FileSystem from '@effect/platform/FileSystem';
import { Effect, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { crc32 } from 'node:zlib';
import * as yauzl from 'yauzl';

class VideoArchiveError extends Schema.TaggedError<VideoArchiveError>()('VideoArchiveError', {
  message: Schema.String
}) {}

const MAX_METADATA_SIZE = 32 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MAX_ARCHIVE_VIDEO_SIZE = 1024 * 1024 * 1024;
const WEBM_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
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
    catch: cause => new VideoArchiveError({ message: `Invalid ZIP archive: ${String(cause)}` })
  });
});

const withArchive = Effect.fn('playwrightVideos.withArchive')(function* <A>(
  bytes: Buffer,
  use: (archive: yauzl.ZipFile, entries: readonly yauzl.Entry[]) => Effect.Effect<A, VideoArchiveError>
) {
  const archive = yield* openArchive(bytes);
  return yield* Effect.acquireUseRelease(
    Effect.succeed(archive),
    current =>
      Effect.tryPromise({
        try: async () => {
          const entries: yauzl.Entry[] = [];
          for await (const entry of current.eachEntry()) entries.push(entry);
          return entries;
        },
        catch: cause => new VideoArchiveError({ message: `Cannot read ZIP entries: ${String(cause)}` })
      }).pipe(
        Effect.flatMap(entries =>
          Effect.try({
            try: () => {
              const names = new Set<string>();
              for (const entry of entries) {
                const name = entry.fileName;
                const fileType = (entry.externalFileAttributes >>> 16) & 0o17_0000;
                if (
                  names.has(name) ||
                  name.length === 0 ||
                  name.includes('\0') ||
                  name.includes('\\') ||
                  name.includes(':') ||
                  name.startsWith('/') ||
                  name.split('/').includes('..') ||
                  fileType === 0o12_0000
                ) {
                  throw new Error(`Unsafe or duplicate ZIP path: ${name}`);
                }
                names.add(name);
              }
              return entries;
            },
            catch: cause => new VideoArchiveError({ message: String(cause) })
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
      let size = 0;
      const destroyOnAbort = () => stream.destroy(new Error('ZIP member read interrupted'));
      signal.addEventListener('abort', destroyOnAbort, { once: true });
      try {
        if (signal.aborted) {
          stream.destroy();
          throw new Error('ZIP member read interrupted');
        }
        for await (const chunk of stream) {
          const bytes: Uint8Array = Buffer.from(chunk);
          size += bytes.length;
          if (size > maxSize) {
            stream.destroy();
            throw new Error(`Oversized ZIP member: ${entry.fileName}`);
          }
          chunks.push(bytes);
        }
      } finally {
        signal.removeEventListener('abort', destroyOnAbort);
      }
      const content = Buffer.concat(chunks);
      if (content.length !== entry.uncompressedSize || crc32(content) !== entry.crc32) {
        throw new Error(`Invalid ZIP member data: ${entry.fileName}`);
      }
      return content;
    },
    catch: cause => new VideoArchiveError({ message: String(cause) })
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
    catch: cause => new VideoArchiveError({ message: `Invalid UTF-8: ${String(cause)}` })
  });

const parseJson = <A, I>(bytes: Buffer, schema: Schema.Schema<A, I>) =>
  decodeUtf8(bytes).pipe(
    Effect.flatMap(text =>
      Effect.try({
        try: () => {
          const value: unknown = JSON.parse(text);
          return value;
        },
        catch: cause => new VideoArchiveError({ message: `Invalid JSON: ${String(cause)}` })
      })
    ),
    Effect.flatMap(Schema.decodeUnknown(schema)),
    Effect.mapError(cause => new VideoArchiveError({ message: String(cause) }))
  );

const readReportTests = Effect.fn('playwrightVideos.readReportTests')(function* (
  report: Buffer,
  spec: string,
  sha: string
) {
  const htmlBytes = yield* withArchive(report, (archive, entries) =>
    readMember(archive, entries, 'index.html', MAX_METADATA_SIZE)
  );
  const html = yield* decodeUtf8(htmlBytes);
  const match = /id="playwrightReportBase64"[^>]*>\s*data:application\/zip;base64,([A-Za-z0-9+/=]+)/.exec(html);
  if (match === null || match[1].length % 4 === 1) {
    return yield* new VideoArchiveError({ message: 'Missing or invalid Playwright report metadata' });
  }
  const encodedMetadata = match[1];
  const metadata = Buffer.from(encodedMetadata, 'base64');
  if (metadata.toString('base64').replace(/=+$/, '') !== encodedMetadata.replace(/=+$/, '')) {
    return yield* new VideoArchiveError({ message: 'Invalid Playwright report metadata encoding' });
  }
  const summaryBytes = yield* withArchive(metadata, (archive, entries) =>
    readMember(archive, entries, 'report.json', MAX_METADATA_SIZE)
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
    readMember(archive, entries, `${matchingFile.fileId}.json`, MAX_METADATA_SIZE)
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
  let uncompressedSize = 0;
  for (const entry of entries) {
    if (!entry.fileName.endsWith('.webm') || entry.uncompressedSize > MAX_VIDEO_SIZE) continue;
    uncompressedSize += entry.uncompressedSize;
    if (uncompressedSize > MAX_ARCHIVE_VIDEO_SIZE) {
      return yield* new VideoArchiveError({ message: 'ZIP archive contains more than 1 GiB of videos' });
    }
    const content = yield* readEntry(archive, entry, MAX_VIDEO_SIZE);
    const digest = createHash('sha256').update(content).digest('hex');
    if (!wanted.has(digest)) continue;
    if (
      !content.subarray(0, WEBM_MAGIC.length).equals(WEBM_MAGIC) ||
      !content.subarray(0, 128).includes(Buffer.from('webm'))
    ) {
      return yield* new VideoArchiveError({ message: 'Invalid WebM video' });
    }
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
  for (const attachment of selected) {
    if (attachment.path === undefined || !/^data\/[0-9a-f]{40}\.webm$/.test(attachment.path)) {
      return yield* new VideoArchiveError({ message: 'Unexpected video attachment path' });
    }
  }
  const report = yield* FileSystem.FileSystem.pipe(
    Effect.flatMap(archiveFileSystem => archiveFileSystem.readFile(pair.report)),
    Effect.mapError(cause => new VideoArchiveError({ message: String(cause) }))
  );
  const digests = yield* withArchive(Buffer.from(report), (archive, entries) => {
    const entriesByName = new Map(entries.map(entry => [entry.fileName, entry] as const));
    const selectedEntries = selected.map(attachment =>
      attachment.path === undefined ? undefined : entriesByName.get(attachment.path)
    );
    if (selectedEntries.includes(undefined)) {
      return Effect.fail(new VideoArchiveError({ message: 'Missing Playwright report video' }));
    }
    const resolvedEntries = selectedEntries.filter((entry): entry is yauzl.Entry => entry !== undefined);
    const totalSize = resolvedEntries.reduce((size, entry) => size + entry.uncompressedSize, 0);
    if (totalSize > MAX_ARCHIVE_VIDEO_SIZE) {
      return Effect.fail(new VideoArchiveError({ message: 'ZIP archive contains more than 1 GiB of videos' }));
    }
    return Effect.forEach(resolvedEntries, entry =>
      readEntry(archive, entry, MAX_VIDEO_SIZE).pipe(
        Effect.map(content => createHash('sha256').update(content).digest('hex'))
      )
    );
  });
  const wanted = new Set(digests);
  const results = yield* FileSystem.FileSystem.pipe(
    Effect.flatMap(archiveFileSystem => archiveFileSystem.readFile(pair.results)),
    Effect.mapError(cause => new VideoArchiveError({ message: String(cause) }))
  );
  const byDigest = yield* withArchive(Buffer.from(results), (archive, entries) =>
    readMatchingVideos(archive, entries, wanted)
  );
  const fileSystem = yield* FileSystem.FileSystem;
  return yield* Effect.forEach(selected, (attachment, index) => {
    const digest = digests[index];
    if (digest === undefined) {
      return Effect.fail(new VideoArchiveError({ message: 'Missing Playwright report video digest' }));
    }
    const content = byDigest.get(digest);
    if (content === undefined) {
      return Effect.logWarning('Missing test-results video', { title: attachment.test.title }).pipe(Effect.as([]));
    }
    const path = `${output}/${digest}.webm`;
    return fileSystem.writeFile(path, content).pipe(
      Effect.mapError(cause => new VideoArchiveError({ message: String(cause) })),
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
    fileSystem.readFile(pair.report).pipe(
      Effect.mapError(cause => new VideoArchiveError({ message: String(cause) })),
      Effect.flatMap(report => readReportTests(Buffer.from(report), spec, sha))
    )
  );
  const latest = new Map<string, { readonly timestamp: string; readonly pair: number }>();
  for (const [pair, tests] of testsByPair.entries()) {
    for (const test of tests) {
      const final = test.results.at(-1);
      if (final === undefined) continue;
      const previous = latest.get(test.testId);
      if (
        previous === undefined ||
        final.startTime > previous.timestamp ||
        (final.startTime === previous.timestamp && pair > previous.pair)
      ) {
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
