/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { toProjectInfo } from '../../src/owned/projectInfoMapper';

describe('toProjectInfo', () => {
  it('maps SfProject fields to owned ProjectInfo', () => {
    const fake = {
      getPath: () => '/proj',
      getSfProjectJson: () => ({ getContents: () => ({ namespace: 'ns', sourceApiVersion: '62.0' }) }),
      getPackageDirectories: () => [
        { name: 'force-app', path: 'force-app', default: true, fullPath: '/proj/force-app' }
      ],
      getDefaultPackage: () => ({ name: 'force-app', path: 'force-app', default: true, fullPath: '/proj/force-app' })
    };
    const info = toProjectInfo(fake as never, {
      soqlMetadataPath: '/m',
      soqlCustomObjectsPath: '/c',
      soqlStandardObjectsPath: '/s',
      fauxStandardObjectsPath: '/fs',
      fauxCustomObjectsPath: '/fc',
      typingsPath: '/t',
      name: 'proj'
    });
    expect(info.path).toBe('/proj');
    expect(info.namespace).toBe('ns');
    expect(info.sourceApiVersion).toBe('62.0');
    expect(info.packageDirectories).toHaveLength(1);
    expect(info.packageDirectories[0].path).toBe('force-app');
    expect(info.defaultPackage.path).toBe('force-app');
    expect(info.soqlMetadataPath).toBe('/m');
    expect(info.soqlCustomObjectsPath).toBe('/c');
    expect(info.soqlStandardObjectsPath).toBe('/s');
    expect(info.fauxStandardObjectsPath).toBe('/fs');
    expect(info.fauxCustomObjectsPath).toBe('/fc');
    expect(info.typingsPath).toBe('/t');
    expect(info.name).toBe('proj');
  });
});
