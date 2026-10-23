/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, type SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type {
  OrgMetadataCatalogComponentEntry,
  OrgMetadataCatalogComponentReference
} from 'salesforcedx-vscode-services';
import { OrgMetadataCatalog } from 'salesforcedx-vscode-services/src/orgCatalog/orgMetadataCatalog';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { resolveReplaySourceUris } from '../../../src/services/replaySourceUris';

const component = (
  type: string,
  fullName: string,
  workspaceUri?: URI,
  namespacePrefix?: string
): OrgMetadataCatalogComponentEntry => ({
  kind: 'component',
  reference: { type, fullName },
  orgId: '00D000000000001',
  name: fullName,
  namespacePrefix,
  observedAt: '2026-10-20T00:00:00.000Z',
  provenance: 'metadata-api',
  inOrg: true,
  inWorkspace: Boolean(workspaceUri),
  documentUri: URI.parse(
    `sf-org-metadata:/orgs/00D000000000001/${type}/${fullName}.${type === 'ApexClass' ? 'cls' : 'trigger'}`
  ),
  ...(workspaceUri ? { workspaceUri } : {})
});

describe('replay source URI resolution', () => {
  const getEntries =
    vi.fn<
      (
        references: readonly OrgMetadataCatalogComponentReference[]
      ) => Effect.Effect<(OrgMetadataCatalogComponentEntry | undefined)[], Error>
    >();
  const layer = Layer.mergeAll(
    Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed({
        services: { OrgMetadataCatalog }
      } as unknown as SalesforceVSCodeServicesApi)
    }),
    Layer.succeed(OrgMetadataCatalog, { getEntries } as unknown as OrgMetadataCatalog)
  );

  beforeEach(() => {
    getEntries.mockReturnValue(Effect.succeed([]));
  });

  it('does not query the catalog for types already mapped by the workspace', async () => {
    const info = [{ typeref: 'ns/Outer', uri: 'memfs:/workspace/Outer.cls', lines: [3] }];
    const result = await Effect.runPromise(
      resolveReplaySourceUris('time|METHOD_ENTRY|[1]|01p|ns.Outer.Inner.run()', info).pipe(Effect.provide(layer))
    );

    expect(result).toEqual({});
    expect(getEntries).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(info).toEqual([{ typeref: 'ns/Outer', uri: 'memfs:/workspace/Outer.cls', lines: [3] }]);
  });

  it('resolves unique class and trigger references in one batch, including outer classes and catalog workspace source', async () => {
    const remote = component('ApexClass', 'Remote');
    const namespaced = component('ApexClass', 'Outer', undefined, 'ns');
    const trigger = component('ApexTrigger', 'MyTrigger', undefined, 'ns');
    const local = component('ApexClass', 'Local', URI.parse('memfs:/workspace/Local.cls'));
    const entries = [remote, namespaced, trigger, local];
    getEntries.mockImplementation(references =>
      Effect.succeed(
        references.map(reference =>
          entries.find(
            entry => entry.reference.type === reference.type && entry.reference.fullName === reference.fullName
          )
        )
      )
    );
    const log = [
      'time|CODE_UNIT_STARTED|[EXTERNAL]|01p|Remote.run()',
      'time|METHOD_ENTRY|[1]|01p|Remote.run()',
      'time|CONSTRUCTOR_ENTRY|[1]|01p|<init>()|Remote.Inner',
      'time|METHOD_ENTRY|[1]|01p|Remote.Inner.run()',
      'time|CONSTRUCTOR_ENTRY|[1]|01p|<init>()|ns/Outer.Inner',
      'time|METHOD_ENTRY|[1]|01p|ns.Outer.Inner.run()',
      'time|CODE_UNIT_STARTED|[EXTERNAL]|01q|__sfdc_trigger/ns/MyTrigger',
      'time|CONSTRUCTOR_ENTRY|[1]|01q|<init>()|__sfdc_trigger/ns/MyTrigger$Inner',
      'time|VF_APEX_CALL_START|[EXTERNAL]|Local invoke(save)|Local',
      'time|VF_APEX_CALL_START|[EXTERNAL]|Ignored get(message)|Ignored',
      'time|CODE_UNIT_STARTED|[EXTERNAL]|execute_anonymous_apex',
      'time|USER_DEBUG|[1]|DEBUG|NotAClass.run()',
      'time|METHOD_EXIT|[1]|01p|NotAnEntry.run()'
    ].join('\n');

    const result = await Effect.runPromise(resolveReplaySourceUris(log, []).pipe(Effect.provide(layer)));

    expect(getEntries).toHaveBeenCalledExactlyOnceWith([
      { type: 'ApexClass', fullName: 'Remote' },
      { type: 'ApexClass', fullName: 'Outer' },
      { type: 'ApexTrigger', fullName: 'MyTrigger' },
      { type: 'ApexClass', fullName: 'Local' }
    ]);
    expect(result).toEqual({
      Remote: remote.documentUri.toString(),
      'Remote.Inner': remote.documentUri.toString(),
      'ns/Outer.Inner': namespaced.documentUri.toString(),
      'ns.Outer.Inner': namespaced.documentUri.toString(),
      '__sfdc_trigger/ns/MyTrigger': trigger.documentUri.toString(),
      Local: local.workspaceUri!.toString()
    });
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  it.each(['ns/Outer.run()', 'ns.Outer.run()'])(
    'does not use an unrelated class named after the namespace for %s',
    async signature => {
      const unrelated = component('ApexClass', 'ns');
      getEntries.mockImplementation(references =>
        Effect.succeed(references.map(reference => (reference.fullName === 'ns' ? unrelated : undefined)))
      );

      const result = await Effect.runPromise(
        resolveReplaySourceUris(`time|METHOD_ENTRY|[1]|01p|${signature}`, []).pipe(Effect.provide(layer))
      );

      expect(result).toEqual({});
      expect(getEntries).toHaveBeenCalledExactlyOnceWith([{ type: 'ApexClass', fullName: 'Outer' }]);
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    }
  );

  it('does not use a component from a different namespace', async () => {
    getEntries.mockReturnValue(Effect.succeed([component('ApexClass', 'Outer', undefined, 'other')]));
    const result = await Effect.runPromise(
      resolveReplaySourceUris('time|METHOD_ENTRY|[1]|01p|ns/Outer.run()', []).pipe(Effect.provide(layer))
    );

    expect(result).toEqual({});
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  it.each([
    ['__sfdc_trigger/MyTrigger$Inner', 'ApexTrigger', 'MyTrigger', undefined, '__sfdc_trigger/MyTrigger'],
    ['__sfdc_trigger/ns/MyTrigger$Inner', 'ApexTrigger', 'MyTrigger', 'ns', '__sfdc_trigger/ns/MyTrigger'],
    ['Outer$Inner', 'ApexClass', 'Outer', undefined, 'Outer$Inner'],
    ['ns/Outer.Inner', 'ApexClass', 'Outer', 'ns', 'ns/Outer.Inner'],
    ['ns.Outer.Inner', 'ApexClass', 'Outer', 'ns', 'ns.Outer.Inner']
  ] as const)(
    'resolves an org-only nested type without a separately logged outer type: %s',
    async (typeref, type, fullName, namespacePrefix, sourceType) => {
      const outer = component(type, fullName, undefined, namespacePrefix);
      getEntries.mockReturnValue(Effect.succeed([outer]));

      const result = await Effect.runPromise(
        resolveReplaySourceUris(`time|CONSTRUCTOR_ENTRY|[1]|01p|<init>()|${typeref}`, []).pipe(Effect.provide(layer))
      );

      expect(getEntries).toHaveBeenCalledExactlyOnceWith([{ type, fullName }]);
      expect(result).toEqual({ [sourceType]: outer.documentUri.toString() });
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    }
  );

  it('continues with an empty mapping when the catalog service is absent', async () => {
    const result = await Effect.runPromise(
      resolveReplaySourceUris('time|METHOD_ENTRY|[1]|01p|Missing.run()', []).pipe(
        Effect.provide(
          Layer.succeed(ExtensionProviderService, {
            getServicesApi: Effect.succeed({ services: {} } as unknown as SalesforceVSCodeServicesApi)
          })
        ),
        Effect.provide(layer)
      )
    );

    expect(result).toEqual({});
    expect(getEntries).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });

  it('keeps found source and leaves missing types unmapped without a warning', async () => {
    const found = component('ApexClass', 'Found');
    getEntries.mockReturnValue(Effect.succeed([found, undefined, undefined]));
    const log = [
      'time|METHOD_ENTRY|[1]|01p|Found.run()',
      'time|METHOD_ENTRY|[1]|01p|Missing.run()',
      'time|CODE_UNIT_STARTED|[EXTERNAL]|01q|__sfdc_trigger/MissingTrigger'
    ].join('\n');

    const result = await Effect.runPromise(resolveReplaySourceUris(log, []).pipe(Effect.provide(layer)));

    expect(result).toEqual({ Found: found.documentUri.toString() });
    expect(getEntries).toHaveBeenCalledTimes(1);
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('continues with an empty mapping when catalog lookup is unavailable', async () => {
    getEntries.mockReturnValue(Effect.fail(new Error('No currently selected org')));
    const result = await Effect.runPromise(
      resolveReplaySourceUris('time|METHOD_ENTRY|[1]|01p|Missing.run()', []).pipe(Effect.provide(layer))
    );

    expect(result).toEqual({});
    expect(getEntries).toHaveBeenCalledTimes(1);
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });
});
