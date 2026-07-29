/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, type SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { URI } from 'vscode-uri';
import { orgMetadataUri } from 'salesforcedx-vscode-services/src/orgVfs/orgMetadataUris';
import { OrgBrowserRetrieveService } from '../../src/services/orgBrowserMetadataRetrieveService';

describe('OrgBrowserRetrieveService', () => {
  it('invalidates catalog presence before resolving the post-retrieve document URI', async () => {
    const workspaceUri = URI.file('/workspace/force-app/main/default/tabs/Broker__c.tab-meta.xml');
    const catalogInvalidate = jest.fn(() => Effect.sync(() => undefined));
    const resolverInvalidate = jest.fn(() => Effect.sync(() => undefined));
    const getUriForFile = jest.fn(() =>
      Effect.sync(() => {
        expect(catalogInvalidate).toHaveBeenCalledTimes(1);
        expect(resolverInvalidate).toHaveBeenCalledTimes(1);
        return workspaceUri;
      })
    );
    const showTextDocument = jest.fn(() => Effect.void);
    const retrieve = jest.fn(() =>
      Effect.succeed({
        getFileResponses: () => [{ filePath: workspaceUri.fsPath, type: 'CustomTab' }]
      })
    );
    const servicesApi = {
      services: {
        prebuiltServicesDependencies: Context.empty(),
        ChannelService: Effect.succeed({ appendToChannel: () => Effect.void }),
        FsService: Effect.succeed({ showTextDocument }),
        MetadataRetrieveService: { retrieve },
        OrgMetadataCatalog: Effect.succeed({ invalidate: catalogInvalidate }),
        OrgMetadataResolver: Effect.succeed({
          getUriForFile,
          invalidate: resolverInvalidate
        }),
        TargetOrgRef: () => SubscriptionRef.make({ orgId: '00DTEST' }),
        orgMetadataUri
      }
    } as unknown as SalesforceVSCodeServicesApi;
    const extensionProviderLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(servicesApi)
    });

    await Effect.runPromise(
      OrgBrowserRetrieveService.retrieve([{ type: 'CustomTab', fullName: 'Broker__c' }], true).pipe(
        Effect.provide(OrgBrowserRetrieveService.Default),
        Effect.provide(extensionProviderLayer),
        Effect.provide(Layer.succeedContext(servicesApi.services.prebuiltServicesDependencies))
      )
    );

    expect(retrieve).toHaveBeenCalledWith([{ type: 'CustomTab', fullName: 'Broker__c' }], { ignoreConflicts: true });
    expect(getUriForFile).toHaveBeenCalledWith(
      orgMetadataUri({
        orgKey: '00DTEST',
        xmlName: 'CustomTab',
        fullName: 'Broker__c'
      })
    );
    expect(showTextDocument).toHaveBeenCalledWith(workspaceUri);
  });
});
