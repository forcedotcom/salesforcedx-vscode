/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Hand-authored, services-owned. NO imports from @salesforce/*, jsforce, or effect.
import type { ComponentSetInfo, ComponentInfo, OwnedMetadataMember } from './components';

const matches = (c: ComponentInfo, m: OwnedMetadataMember): boolean => c.type === m.type && c.fullName === m.fullName;
/** True when a component of the given type+fullName is present in the set. */
export const componentSetHas = (info: ComponentSetInfo, member: OwnedMetadataMember): boolean =>
  info.components.some(c => matches(c, member));
/** The on-disk file paths for a component of the given type+fullName (empty if absent). */
export const componentFilenamesByNameAndType = (
  info: ComponentSetInfo,
  member: OwnedMetadataMember
): readonly string[] => info.components.find(c => matches(c, member))?.contentPaths ?? [];
