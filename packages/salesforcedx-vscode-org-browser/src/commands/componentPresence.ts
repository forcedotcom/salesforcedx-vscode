/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ComponentSet, MetadataMember } from '@salesforce/source-deploy-retrieve';

/**
 * ComponentSet.has() can miss decomposed metadata whose source is represented by
 * child files. Fall back to SDR's filename index for every metadata type.
 */
export const isMemberPresentInProject = (projectComponentSet: ComponentSet, member: MetadataMember): boolean =>
  projectComponentSet.has(member) ||
  projectComponentSet.getComponentFilenamesByNameAndType({
    fullName: member.fullName,
    type: member.type
  }).length > 0;
