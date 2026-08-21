/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Composite content digest for a Code Builder extension override.
 *
 * The false-green problem (ADR 0022): the version gate compared installed *semver*, not bytes, so a
 * swap that silently no-ops still passed when an unreleased build shared a version with the baked
 * copy. The fix is a content digest computed identically on both sides of the unpack:
 *   - swap side  — extracts the .vsix host-side, digests it, records it in the Manifest
 *   - verify side — docker-cp's the installed override dir back out, recomputes, compares
 * Because a .vsix is a zip but the installed override is a loose tree, the digest is defined over
 * content that *survives unpacking*: the extension's package.json and its `main` bundle file.
 *
 * Composite = cheap gate (package.json) + byte-level catch (the shipped bundle). package.json alone
 * misses a bundle-only change; the bundle digest catches it.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

/** The two-part content digest of one extension. `bundleDigest` is null for a declarative extension (no `main`). */
export type ExtensionDigest = {
  /** sha256 of the extension's package.json bytes. */
  pkgJsonDigest: string;
  /** sha256 of the `main` bundle file bytes, or null when the extension declares no `main`. */
  bundleDigest: string | null;
};

/** Thrown when an extension declares a `main` that does not resolve to a file — a real broken build/swap. */
export class UnresolvableEntrypointError extends Error {
  constructor(
    public readonly extensionRoot: string,
    public readonly main: string
  ) {
    super(`package.json "main" (${main}) does not resolve to a file under ${extensionRoot}`);
    this.name = 'UnresolvableEntrypointError';
  }
}

const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

/*
 * Digest package.json by its CANONICAL content, not raw bytes. The swap side hashes bytes unzipped
 * from the .vsix; the verify side hashes bytes docker-cp'd from the installed override dir — and the
 * CB install path can legitimately rewrite the file (re-serialize JSON, normalize EOLs, inject a
 * `__metadata` block). Hashing raw bytes would then mismatch on every run (permanent false-RED). So
 * parse → drop install-injected keys → stably re-stringify, giving a byte-identical digest across
 * both sides whenever the *meaningful* content is the same. A genuine version/content change still
 * changes the canonical form, so the gate keeps its teeth.
 */
const INSTALL_INJECTED_KEYS = new Set(['__metadata']);
const canonicalPackageJson = (raw: string): string => {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const stableStringify = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map(stableStringify).join(',')}]`;
    }
    const entries = Object.keys(value as Record<string, unknown>)
      .filter(k => !INSTALL_INJECTED_KEYS.has(k))
      .toSorted()
      .map(k => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(',')}}`;
  };
  return stableStringify(parsed);
};

/*
 * Locate the directory that holds package.json directly. A raw .vsix unzip nests everything under
 * `extension/`; the CB image's installed override dir (`/base/extension-overrides/<id>-<ver>/`) has
 * package.json at its root. Accept either so the same digest runs on both sides of the swap.
 */
export const resolveExtensionRoot = (dir: string): string => {
  if (existsSync(join(dir, 'package.json'))) {
    return dir;
  }
  const nested = join(dir, 'extension');
  if (existsSync(join(nested, 'package.json'))) {
    return nested;
  }
  throw new Error(`no package.json found in ${dir} or ${nested} — not an extracted extension`);
};

/*
 * Resolve the shipped bundle entry file from package.json `main`.
 *
 * Policy (ADR 0022, plan §4.3):
 *   - missing `main`            → valid: declarative extension, no bundle to digest → null
 *   - `main` present, resolves  → absolute path to the bundle file, inside the extension root
 *   - `main` present, missing   → throw (strict): a declared entrypoint that isn't there is a real
 *                                  broken build/swap, never a silent pass
 *   - `main` escapes the root    → throw: an absolute path or one with `..` that resolves outside the
 *                                  extension would hash unrelated bytes and could reconcile
 *                                  differently on the swap vs verify side (different parent temp dirs)
 * `browser` is ignored on purpose — CB runs the desktop/node build (ADR 0022, plan C2).
 */
export const resolveEntrypoint = (extensionRoot: string): string | null => {
  const pkg = JSON.parse(readFileSync(join(extensionRoot, 'package.json'), 'utf-8')) as { main?: string };
  if (pkg.main === undefined || pkg.main === '') {
    return null;
  }
  const rootAbs = resolve(extensionRoot);
  const entry = resolve(rootAbs, pkg.main);
  // Must stay within the extension root (guards `..` traversal and absolute-path `main`).
  if (entry !== rootAbs && !entry.startsWith(rootAbs + sep)) {
    throw new UnresolvableEntrypointError(extensionRoot, pkg.main);
  }
  if (!existsSync(entry) || !statSync(entry).isFile()) {
    throw new UnresolvableEntrypointError(extensionRoot, pkg.main);
  }
  // Re-check containment on the REAL path: an in-root symlink pointing outside the extension would
  // pass the string check above but hash foreign bytes. realpath resolves the link, then we assert
  // the resolved target is still inside the (real) root.
  const realRoot = realpathSync(rootAbs);
  const realEntry = realpathSync(entry);
  if (realEntry !== realRoot && !realEntry.startsWith(realRoot + sep)) {
    throw new UnresolvableEntrypointError(extensionRoot, pkg.main);
  }
  return entry;
};

/*
 * Compute the composite digest of an extracted extension. `dir` may be the extension root or a
 * parent that contains it (a raw .vsix unzip); resolveExtensionRoot handles both. Sync + host-side:
 * the caller has already extracted (swap) or docker-cp'd (verify) the tree to the host.
 */
export const computeExtensionDigest = (dir: string): ExtensionDigest => {
  const root = resolveExtensionRoot(dir);
  const pkgJsonDigest = sha256(canonicalPackageJson(readFileSync(join(root, 'package.json'), 'utf-8')));
  const entry = resolveEntrypoint(root);
  const bundleDigest = entry === null ? null : sha256(readFileSync(entry));
  return { pkgJsonDigest, bundleDigest };
};
