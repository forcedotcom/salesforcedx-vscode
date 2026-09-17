/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { QueryService } from 'salesforcedx-vscode-services/src/core/queryService';
import { gatherOrgInfo, renderMarkdown } from '../../../src/commands/projectInfo';

const runGatherOrgInfo = (query: jest.Mock) =>
  Effect.runPromise(
    gatherOrgInfo().pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({
          services: {
            QueryService,
            TargetOrgRef: () =>
              SubscriptionRef.make({
                isScratch: true,
                isSandbox: false,
                tracksSource: true
              })
          }
        })
      } as unknown as ExtensionProviderService),
      Effect.provideService(QueryService, { query } as unknown as QueryService)
    )
  );

describe('gatherOrgInfo', () => {
  it('queries SourceMember count through the Tooling API', async () => {
    const query = jest.fn(() => Effect.succeed({ totalSize: 12 }));

    await expect(runGatherOrgInfo(query)).resolves.toEqual({
      orgType: 'scratch',
      tracksSource: true,
      sourceMemberCount: 12
    });
    expect(query).toHaveBeenCalledWith({ soql: 'SELECT COUNT() FROM SourceMember', tooling: true }, expect.anything());
  });

  it('reports a query failure without failing project info', async () => {
    const query = jest.fn(() => Effect.fail(new Error('query failed')));

    await expect(runGatherOrgInfo(query)).resolves.toEqual({
      orgType: 'scratch',
      tracksSource: true,
      sourceMemberCount: 'query failed'
    });
  });
});

describe('projectInfo renderMarkdown', () => {
  const render = (appName: string) =>
    renderMarkdown({
      metadataInfo: { typeStats: [], sourceApiVersion: '60.0', packageDirCount: 1, namespace: 'none' },
      orgInfo: { orgType: 'scratch', tracksSource: true, sourceMemberCount: 0 },
      settings: [],
      envInfo: {
        cliVersion: 'sf 2.0.0',
        javaVersion: 'openjdk 17',
        appName,
        vscodeVersion: '1.90.0',
        nodeVersion: 'v20.0.0',
        os: 'Darwin 24.0.0',
        extensions: []
      }
    });

  it('renders the editor app name row', () => {
    expect(render('Visual Studio Code')).toContain('| Editor | Visual Studio Code |');
  });

  it('does not render an undefined editor row', () => {
    expect(render('Visual Studio Code')).not.toContain('| Editor | undefined |');
  });
});
