/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Verify: the content + version gate. PURE assertion — no mutation, no memory, no `sf`. Given a
 * running container and the Manifest swap emitted, it proves each extension is installed exactly
 * once at the expected version AND that its bytes match (composite digest), closing the false-green
 * (ADR 0022): a swap that silently no-ops leaves a stale dir whose digest won't match, so it fails
 * loud instead of passing on a coincidental version match.
 *
 * Post-install content lives in a loose override tree in the container; we `docker cp` each dir out
 * to the host and recompute with the SAME digest core swap used pre-install (portability over speed —
 * no dependency on in-container hashing tools).
 */

import type { Manifest } from './manifest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeExtensionDigest } from './digest';
import { defaultRunner, type CommandRunner } from './runner';

/** Where the CB image loads extension overrides from. */
export const OVERRIDES_DIR = '/base/extension-overrides';

export type VerifyOptions = {
  /** Command runner (injectable for tests). Defaults to real docker via execFileSync. */
  runner?: CommandRunner;
  /** Host dir to copy override trees into for hashing. Defaults to an OS temp dir. */
  workDir?: string;
};

/** One extension's gate result — pass, or a specific loud reason. */
export type VerifyEntryResult = {
  id: string;
  version: string;
  ok: boolean;
  /** Human-readable failure reason when `ok` is false; undefined when it passed. */
  reason?: string;
};

export type VerifyResult = {
  ok: boolean;
  entries: VerifyEntryResult[];
};

/*
 * List the override dirs for an id. The dir is "<id>-<version>"; versions start with a digit, so
 * anchoring on "-[0-9]" stops a shorter id (…-org) prefix-matching a longer sibling (…-org-browser).
 * More or fewer than one match is itself a failure (a leftover dir is the false-green we guard).
 */
const listOverrideDirs = (runner: CommandRunner, container: string, id: string): string[] =>
  runner('docker', ['exec', container, 'bash', '-lc', `ls -d ${OVERRIDES_DIR}/${id}-[0-9]* 2>/dev/null || true`])
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

const digestsMatch = (
  expected: { pkgJsonDigest: string; bundleDigest: string | null },
  actual: { pkgJsonDigest: string; bundleDigest: string | null }
): boolean => expected.pkgJsonDigest === actual.pkgJsonDigest && expected.bundleDigest === actual.bundleDigest;

/*
 * Verify the container against the manifest. Copies each override dir out to a host work dir, recomputes
 * the composite digest, and asserts exactly-one-dir + version + digest per entry. Returns a structured
 * result; callers decide how loud to be (assertVerified below throws for the CI gate).
 */
export const verifyExtensions = (container: string, manifest: Manifest, options: VerifyOptions = {}): VerifyResult => {
  const runner = options.runner ?? defaultRunner;
  const workDir = options.workDir ?? mkdtempSync(join(tmpdir(), 'cb-verify-'));
  const ownWorkDir = options.workDir === undefined;

  const entries: VerifyEntryResult[] = [];
  try {
    for (const entry of manifest.entries) {
      const { id, version } = entry;
      const dirs = listOverrideDirs(runner, container, id);
      if (dirs.length !== 1) {
        entries.push({
          id,
          version,
          ok: false,
          reason: `expected exactly 1 override dir, found ${dirs.length}${dirs.length > 0 ? `: ${dirs.join(' ')}` : ''}`
        });
        continue;
      }

      // Copy the installed override tree out to the host and recompute the digest there.
      const dest = join(workDir, `${id}-${version}`);
      runner('docker', ['cp', `${container}:${dirs[0]}/.`, dest]);

      let actual;
      try {
        actual = computeExtensionDigest(dest);
      } catch (err) {
        entries.push({ id, version, ok: false, reason: `digest failed: ${(err as Error).message}` });
        continue;
      }

      if (!digestsMatch(entry, actual)) {
        entries.push({
          id,
          version,
          ok: false,
          reason:
            'content digest mismatch — the swap did not take (stale/wrong bytes installed). ' +
            `expected pkgJson=${entry.pkgJsonDigest.slice(0, 12)} bundle=${entry.bundleDigest?.slice(0, 12) ?? 'null'}; ` +
            `got pkgJson=${actual.pkgJsonDigest.slice(0, 12)} bundle=${actual.bundleDigest?.slice(0, 12) ?? 'null'}`
        });
        continue;
      }

      entries.push({ id, version, ok: true });
    }
  } finally {
    if (ownWorkDir) {
      rmSync(workDir, { recursive: true, force: true });
    }
  }

  return { ok: entries.every(e => e.ok), entries };
};

/*
 * CI gate wrapper: run verifyExtensions and throw loud on any failure. A mismatch means the swap
 * didn't take, not a test bug — the message says so, so it isn't misread as a spec failure.
 */
export const assertVerified = (container: string, manifest: Manifest, options: VerifyOptions = {}): void => {
  const result = verifyExtensions(container, manifest, options);
  for (const e of result.entries) {
    console.log(e.ok ? `OK   ${e.id}@${e.version}` : `FAIL ${e.id}@${e.version}: ${e.reason}`);
  }
  if (!result.ok) {
    throw new Error(
      'Code Builder extension gate failed — container is running wrong/mixed/stale versions (the swap did not take).'
    );
  }

  console.log('==> Gate passed: all extensions present exactly once at the expected version and bytes.');
};
