/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { orgDataOwnerRoot, orgDataUri } from 'salesforcedx-vscode-services/src/orgVfs/orgDataUris';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { ApexTestDiscoveryService } from '../../../src/discoveryVfs/apexTestDiscoveryService';
import type { ToolingTestClass } from '../../../src/testDiscovery/schemas';

const classOf = (name: string): ToolingTestClass => ({
  id: Option.some(`id-${name}`),
  name,
  namespacePrefix: Option.none(),
  testMethods: [{ name: 'testMethod' }]
});

describe('ApexTestDiscoveryService', () => {
  it('replaces the owner snapshot and writes discovered classes through FsService', async () => {
    const clearOrgData = jest.fn(() => Effect.void);
    const createOrgDataDir = jest.fn(() => Effect.void);
    const writeOrgData = jest.fn(() => Effect.void);
    const fsLayer = Layer.succeed(FsService, {
      clearOrgData,
      createOrgDataDir,
      writeOrgData
    } as unknown as InstanceType<typeof FsService>);
    const extensionProviderLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed({
        services: {
          FsService,
          orgDataOwnerRoot,
          orgDataUri
        }
      })
    } as unknown as ExtensionProviderService);
    const layer = Layer.mergeAll(ApexTestDiscoveryService.Default, fsLayer, extensionProviderLayer);

    await Effect.runPromise(
      ApexTestDiscoveryService.saveDiscoveredClasses(
        '00DABC',
        [classOf('MyTest'), { ...classOf('NamespacedTest'), namespacePrefix: Option.some('ns') }],
        new Map([['MyTest', '@isTest class MyTest {}']])
      ).pipe(Effect.provide(layer))
    );

    expect(clearOrgData).toHaveBeenCalledWith({ orgKey: '00DABC', owner: 'apex-testing' });
    expect(writeOrgData).toHaveBeenCalledWith(
      orgDataUri({
        orgKey: '00DABC',
        owner: 'apex-testing',
        segments: ['classes', 'MyTest.cls']
      }),
      '@isTest class MyTest {}'
    );
    expect(writeOrgData).toHaveBeenCalledWith(
      orgDataUri({
        orgKey: '00DABC',
        owner: 'apex-testing',
        segments: ['classes', 'ns', 'NamespacedTest.cls']
      }),
      expect.stringContaining('ns.NamespacedTest')
    );
  });
});
