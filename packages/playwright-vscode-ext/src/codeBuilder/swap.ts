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
import { defaultRunner, type CommandRunner } from './runner';
import { OVERRIDES_DIR } from './verify';

/*
 * Runtime extensions dir code-server loads from. start.sh symlinks each override here (strictly-newer
 * semver only), so the wipe must clear this too — else a same-or-lower VSIX never re-links on restart.
 */
export const RUNTIME_EXT_DIR = '/home/codebuilder/.local/share/code-server/extensions';

/** Extracts a .vsix (a zip) into destDir, yielding destDir/extension/... Injectable for tests. */
export type ExtractZip = (vsixPath: string, destDir: string) => void;

/*
 * Default extractor: host-side `unzip`, with a python3 fallback (both present on macOS and the CI
 * ubuntu runners — same pair #7718 relied on, just host-side rather than in-container).
 */
export const defaultExtract: ExtractZip = (vsixPath, destDir) => {
  try {
    execFileSync('unzip', ['-q', '-o', vsixPath, '-d', destDir], { stdio: 'ignore' });
  } catch {
    execFileSync(
      'python3',
      ['-c', 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', vsixPath, destDir],
      { stdio: 'ignore' }
    );
  }
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

// Same charset guard verify uses on ids: publisher/name are npm-style, and the prefix is interpolated
// into a `bash -c` glob, so reject any shell/glob metacharacter up front.
const VALID_PREFIX = /^[A-Za-z0-9._-]+$/;
const assertSafePrefix = (prefix: string): void => {
  if (!VALID_PREFIX.test(prefix)) {
    throw new Error(`unsafe publisher prefix ${JSON.stringify(prefix)}: expected only [A-Za-z0-9._-]`);
  }
};

/*
 * Install the given VSIXes into the container and return the Manifest of exactly what was installed.
 * Explicit list only — no directory scan, no dedup (that selection is the consumer's job).
 */
export const swap = (container: string, vsixPaths: readonly string[], options: SwapOptions): Manifest => {
  const { publisherPrefix } = options;
  assertSafePrefix(publisherPrefix);
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
    const entries = vsixPaths.map((vsixPath, i) => {
      const extractDir = join(workDir, `vsix-${i}`);
      extract(vsixPath, extractDir);
      const root = resolveExtensionRoot(extractDir); // the dir holding package.json (extension/)
      const { name, version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as {
        name: string;
        version: string;
      };
      const id = `${publisherPrefix}.${name}`;
      const digest = computeExtensionDigest(root);
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
