/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Option from 'effect/Option';
import { type URI, Utils } from 'vscode-uri';

export class NotInBundleError extends Data.TaggedError('NotInBundleError')<{
  readonly sourceUri: string;
  readonly message: string;
}> {}

export const LWC_FOLDER = 'lwc';
export const AURA_FOLDER = 'aura';
export const TEST_FOLDER = '__tests__';

export const LWC_TYPE = 'LightningComponentBundle';
export const AURA_TYPE = 'AuraDefinitionBundle';

export type LightningComponentKind = 'lwc' | 'aura';

/** Pattern of bundle filenames that should be renamed when the bundle name changes.
 * LWC: <name>.{html,js,ts,js-meta.xml,css,svg,test.js,test.ts}
 * Aura: <name>{Controller|Renderer|Helper}?.js, <name>.{cmp,app,css,design,auradoc,svg,evt} */
export const bundleFilePattern = (componentName: string, kind: LightningComponentKind): RegExp => {
  const escaped = componentName.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return kind === 'lwc'
    ? new RegExp(`^${escaped}\\.(html|js|ts|js-meta\\.xml|css|svg|test\\.js|test\\.ts)$`)
    : new RegExp(`^${escaped}((Controller|Renderer|Helper)?\\.js|\\.(cmp|app|css|design|auradoc|svg|evt))$`);
};

/** Walk up to the bundle directory. Given a URI inside an `lwc/<bundle>` or `aura/<bundle>`
 * subtree (or the bundle folder itself, or any descendant file), return the URI of `<bundle>`. */
export const getBundleUri = (sourceUri: URI): Option.Option<URI> => {
  const segments = sourceUri.path.split('/');
  const lwcIdx = segments.lastIndexOf(LWC_FOLDER);
  const auraIdx = segments.lastIndexOf(AURA_FOLDER);
  const rootIdx = Math.max(lwcIdx, auraIdx);
  if (rootIdx === -1 || rootIdx + 1 >= segments.length) return Option.none();
  const bundlePath = segments.slice(0, rootIdx + 2).join('/');
  return Option.some(sourceUri.with({ path: bundlePath }));
};

/** The component kind for a bundle URI, by inspecting its parent folder name. */
export const getBundleKind = (bundleUri: URI): LightningComponentKind | undefined => {
  const parent = Utils.basename(Utils.dirname(bundleUri));
  return parent === LWC_FOLDER ? 'lwc' : parent === AURA_FOLDER ? 'aura' : undefined;
};

/** Within-bundle file-name collision check: does any existing file (incl. __tests__) collide with `newName`?
 * Strips the first dotted segment, compares case-insensitive. */
export const hasFileNameCollision = (existingFiles: readonly string[], newName: string): boolean => {
  const lower = newName.toLowerCase();
  return existingFiles.some(f => {
    const stem = f.split('.')[0];
    return stem ? stem.toLowerCase() === lower : false;
  });
};

/** Normalize the typed name for a given component kind. LWC requires lowercase first char.
 * Aura is conventionally PascalCase but we leave casing untouched. */
export const normalizeComponentName = (raw: string, kind: LightningComponentKind): string =>
  kind === 'lwc' ? raw.charAt(0).toLowerCase() + raw.slice(1) : raw;
