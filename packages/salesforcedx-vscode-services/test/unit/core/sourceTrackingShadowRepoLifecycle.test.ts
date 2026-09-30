/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { releaseSourceTrackingShadowRepo } from '../../../src/core/sourceTrackingShadowRepoLifecycle';

describe('releaseSourceTrackingShadowRepo', () => {
  it('releases the project-scoped source tracking shadow repository', () => {
    const projectPath = '/workspace/project';
    const instanceMap = new Map([[projectPath, { orgId: 'old-org' }]]);

    expect(releaseSourceTrackingShadowRepo(projectPath, { instanceMap })).toBe(true);
    expect(instanceMap.has(projectPath)).toBe(false);
  });

  it('does nothing when the dependency no longer exposes its internal cache', () => {
    expect(releaseSourceTrackingShadowRepo('/workspace/project', {})).toBe(false);
  });
});
