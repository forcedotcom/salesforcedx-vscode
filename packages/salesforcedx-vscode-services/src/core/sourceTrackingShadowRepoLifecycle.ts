/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ShadowRepo } from '@salesforce/source-tracking/lib/shared/local/localShadowRepo';

/**
 * Source Tracking caches local shadow repositories by project path even though
 * each repository is stored under an org-specific directory. Release that
 * project-scoped instance before creating Source Tracking for another org.
 *
 * This compatibility boundary can be removed when Source Tracking keys its
 * cache by both project and org, or exposes an equivalent lifecycle API.
 */
export const releaseSourceTrackingShadowRepo = (
  projectPath: string,
  shadowRepoConstructor: object = ShadowRepo
): boolean => {
  const instances: unknown = Reflect.get(shadowRepoConstructor, 'instanceMap');
  return instances instanceof Map ? instances.delete(projectPath) : false;
};
