/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Swap: install the VSIXes under test into a running Code Builder container, and emit the Manifest
 * verify will gate against. This is the WRITE side of the false-green fix (ADR 0022).
 *
 * Two things make it trustworthy:
 *  1. UNCONDITIONAL WIPE BY PUBLISHER GLOB — before installing anything, delete every override dir
 *     AND runtime symlink under the consumer's publisher prefix. start.sh re-links an override into
 *     the runtime dir only when it is strictly-newer semver than what's already linked; an
 *     equal-or-lower pre-release build would never re-link unless the runtime symlink is also
 *     cleared. Wiping by glob (not a hardcoded id list) means a baked extension under an unlisted id
 *     cannot survive to be falsely green.
 *  2. HOST-SIDE UNPACK + docker cp — a .vsix is a zip (content under extension/); the image loads
 *     an extracted override *dir*, not a .vsix. We extract on the host, compute the digest with the
 *     SAME digest core verify uses, then docker cp the tree in. Same bytes, both sides.
 *
 * swap MUTATES but does NOT restart — applying the swap (re-scan + activation) is the lifecycle
 * restart's job. Sequence stays: swap -> restart -> verify.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeExtensionDigest, resolveExtensionRoot } from './digest';
import { makeManifest, type Manifest } from './manifest';
import { assertSafeShellSegment, defaultRunner, runnerTimeoutMs, withTimeoutRetry, type CommandRunner } from './runner';
// OVERRIDES_DIR + RUNTIME_EXT_DIR live in verify (the module that also reads them), so swap and
// verify share one definition of the image's extension locations rather than drifting copies.
import { OVERRIDES_DIR, RUNTIME_EXT_DIR } from './verify';

/** Extracts a .vsix (a zip) into destDir, yielding destDir/extension/... Injectable for tests. */
export type ExtractZip = (vsixPath: string, destDir: string) => void;

/*
 * Default extractor: host-side `unzip`, with a python3 fallback (both present on macOS and the CI
 * ubuntu runners — same pair #7718 relied on, just host-side rather than in-container).
 *
 * Each exec carries the runner's per-attempt timeout and the whole extract is wrapped in
 * withTimeoutRetry, so a wedged unzip/python3 can't hang the swap forever (same hang protection the
 * command runner gives docker/sf calls). A missing `unzip` (non-timeout failure) still falls through
 * to python3 immediately.
 */
export const defaultExtract: ExtractZip = (vsixPath, destDir) => {
  withTimeoutRetry(() => {
    try {
      execFileSync('unzip', ['-q', '-o', vsixPath, '-d', destDir], { stdio: 'ignore', timeout: runnerTimeoutMs() });
    } catch {
      execFileSync(
        'python3',
        ['-c', 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', vsixPath, destDir],
        { stdio: 'ignore', timeout: runnerTimeoutMs() }
      );
    }
  });
};

export type SwapOptions = {
  /** Publisher prefix to wipe + install under, e.g. "salesforce". Charset-validated. */
  publisherPrefix: string;
  /** Command runner (injectable for tests). Defaults to real docker via execFileSync. */
  runner?: CommandRunner;
  /** Zip extractor (injectable for tests). Defaults to host `unzip`. */
  extract?: ExtractZip;
  /** Host dir to extract into. Defaults to an OS temp dir (cleaned up when owned). */
  workDir?: string;
};

/*
 * Install the given VSIXes into the container and return the Manifest of exactly what was installed.
 * Explicit list only — no directory scan, no dedup (that selection is the consumer's job).
 *
 * The publisher prefix and the name/version read from each (attacker-influenceable) package.json are
 * charset-validated via the shared assertSafeShellSegment guard before they reach any `bash -c`
 * string, so swap and verify share one injection defense that can't drift.
 */
export const swap = (container: string, vsixPaths: readonly string[], options: SwapOptions): Manifest => {
  const { publisherPrefix } = options;
  assertSafeShellSegment(publisherPrefix, 'publisher prefix');
  // Fail-fast BEFORE the destructive wipe: an empty list would wipe the container's extensions and
  // then emit an empty Manifest that verify rejects downstream anyway ("no entries — nothing to
  // verify"). Reject it here so a caller mistake never leaves the container stripped bare.
  if (vsixPaths.length === 0) {
    throw new Error('swap requires at least one vsixPath — refusing to wipe the container with nothing to install');
  }
  const runner = options.runner ?? defaultRunner;
  const extract = options.extract ?? defaultExtract;
  const workDir = options.workDir ?? mkdtempSync(join(tmpdir(), 'cb-swap-'));
  const ownWorkDir = options.workDir === undefined;

  try {
    // 1. Unconditional wipe by publisher glob — both the override source and the runtime symlink.
    runner('docker', [
      'exec',
      container,
      'bash',
      '-c',
      `rm -rf ${OVERRIDES_DIR}/${publisherPrefix}.* ${RUNTIME_EXT_DIR}/${publisherPrefix}.*`
    ]);

    // 2. Install each VSIX: extract host-side, digest, docker cp the tree into a fresh override dir.
    // Sequential by design: swap shells through the SYNCHRONOUS CommandRunner seam (execFileSync) so
    // unit tests assert exact argv with no docker. Extract + digest are host-side and could in
    // principle run in parallel, but they aren't the pipeline's cost (the multi-GB image pull + boot
    // dominate by minutes) and parallelizing would force an async rewrite that breaks that hermetic
    // seam — deliberately not done.
    const entries = vsixPaths.map((vsixPath, i) => {
      const extractDir = join(workDir, `vsix-${i}`);
      extract(vsixPath, extractDir);
      const root = resolveExtensionRoot(extractDir); // the dir holding package.json (extension/)
      // Read package.json ONCE and reuse it: name/version validation here + the digest below (passed
      // in so computeExtensionDigest doesn't re-read it for the hash or the entrypoint).
      const rawPkgJson = readFileSync(join(root, 'package.json'), 'utf-8');
      // The wipe has already run by now, so a bad package.json must fail with enough context to
      // identify the culprit — name the ORIGINAL vsixPath (not the anonymous vsix-${i} extractDir),
      // since JSON.parse's own error mentions neither.
      let parsed: { name?: unknown; version?: unknown };
      try {
        parsed = JSON.parse(rawPkgJson) as { name?: unknown; version?: unknown };
      } catch (err) {
        throw new Error(`invalid package.json in ${vsixPath}: ${(err as Error).message}`);
      }
      // Validate before interpolating into destDir's `bash -c` (name/version come from an
      // attacker-influenceable package.json) — and fail loud on a missing/blank name or version
      // rather than silently installing a "salesforce.undefined-undefined" dir.
      const name = assertSafeShellSegment(parsed.name, 'package.json name');
      const version = assertSafeShellSegment(parsed.version, 'package.json version');
      const id = `${publisherPrefix}.${name}`;
      const digest = computeExtensionDigest(root, rawPkgJson);
      const destDir = `${OVERRIDES_DIR}/${id}-${version}`;
      // Fresh dir, then copy the extracted tree's CONTENTS in (root/. → destDir), matching the flat
      // installed layout the image scans (package.json at the dir root).
      runner('docker', ['exec', container, 'bash', '-c', `rm -rf ${destDir} && mkdir -p ${destDir}`]);
      runner('docker', ['cp', `${root}/.`, `${container}:${destDir}`]);
      return { id, version, ...digest };
    });

    return makeManifest(entries);
  } finally {
    if (ownWorkDir) {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
};
