/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as TestClock from 'effect/TestClock';
import * as TestContext from 'effect/TestContext';
import { URI } from 'vscode-uri';
import {
  dedupeMetadataChanges,
  MetadataChangeNotificationService,
  type MetadataChangeEvent
} from '../../../src/core/metadataChangeNotificationService';

describe('dedupeMetadataChanges', () => {
  it('collapses source and metadata file responses to one component and prefers the source file', () => {
    const metadataUri = URI.file('/workspace/classes/Foo.cls-meta.xml');
    const sourceUri = URI.file('/workspace/classes/Foo.cls');

    const changes: MetadataChangeEvent[] = [
      {
        metadataType: 'ApexClass',
        fullName: 'Foo',
        changeType: 'changed',
        fileUri: Option.some(metadataUri)
      },
      {
        metadataType: 'ApexClass',
        fullName: 'Foo',
        changeType: 'changed',
        fileUri: Option.some(sourceUri)
      }
    ];

    const result = dedupeMetadataChanges(changes);

    expect(result).toHaveLength(1);
    expect(Option.getOrUndefined(result[0].fileUri)).toBe(sourceUri);
    expect(result[0].fileUris).toEqual([metadataUri, sourceUri]);
  });

  it('retains distinct component identities', () => {
    const changes: MetadataChangeEvent[] = [
      {
        metadataType: 'ApexClass',
        fullName: 'Foo',
        changeType: 'created',
        fileUri: Option.none()
      },
      {
        metadataType: 'ApexClass',
        fullName: 'Bar',
        changeType: 'created',
        fileUri: Option.none()
      },
      {
        metadataType: 'ApexTestSuite',
        fullName: 'Foo',
        changeType: 'created',
        fileUri: Option.none()
      }
    ];

    expect(dedupeMetadataChanges(changes)).toHaveLength(3);
  });

  it('retains every distinct bundle file URI on the deduplicated component', () => {
    const controller = URI.file('/workspace/lwc/example/example.js');
    const template = URI.file('/workspace/lwc/example/example.html');
    const metadata = URI.file('/workspace/lwc/example/example.js-meta.xml');

    const result = dedupeMetadataChanges([
      {
        metadataType: 'LightningComponentBundle',
        fullName: 'example',
        changeType: 'changed',
        fileUri: Option.some(controller)
      },
      {
        metadataType: 'LightningComponentBundle',
        fullName: 'example',
        changeType: 'changed',
        fileUri: Option.some(template)
      },
      {
        metadataType: 'LightningComponentBundle',
        fullName: 'example',
        changeType: 'changed',
        fileUri: Option.some(metadata)
      }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].fileUris).toEqual([controller, template, metadata]);
  });
});

describe('MetadataChangeNotificationService workspace correlation', () => {
  it('suppresses matching source and sidecar events while retaining unrelated workspace changes', async () => {
    const sourceUri = URI.file('/workspace/classes/Foo.cls');
    const metadataUri = URI.file('/workspace/classes/Foo.cls-meta.xml');
    const unrelatedUri = URI.file('/workspace/classes/Bar.cls');

    const [unmatched, repeatedWorkspaceEvents] = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* MetadataChangeNotificationService;
        yield* service.publishOperation({
          orgId: 'org-one',
          operation: 'retrieve',
          completedAt: '2026-07-30T00:00:00.000Z',
          changes: [
            {
              metadataType: 'ApexClass',
              fullName: 'Foo',
              changeType: 'created',
              fileUri: Option.some(sourceUri),
              fileUris: [sourceUri]
            }
          ]
        });
        const first = yield* service.dedupeWorkspaceEvents([
          { type: 'create', uri: sourceUri },
          { type: 'create', uri: metadataUri },
          { type: 'change', uri: unrelatedUri }
        ]);
        const second = yield* service.dedupeWorkspaceEvents([
          { type: 'change', uri: sourceUri },
          { type: 'change', uri: metadataUri }
        ]);
        return [first, second] as const;
      }).pipe(Effect.provide(MetadataChangeNotificationService.Default))
    );

    expect(unmatched).toEqual([{ type: 'change', uri: unrelatedUri }]);
    expect(repeatedWorkspaceEvents).toEqual([]);
  });

  it('suppresses every recorded bundle path from one operation envelope', async () => {
    const controller = URI.file('/workspace/lwc/example/example.js');
    const template = URI.file('/workspace/lwc/example/example.html');
    const metadata = URI.file('/workspace/lwc/example/example.js-meta.xml');
    const changes = dedupeMetadataChanges([
      {
        metadataType: 'LightningComponentBundle',
        fullName: 'example',
        changeType: 'changed',
        fileUri: Option.some(controller)
      },
      {
        metadataType: 'LightningComponentBundle',
        fullName: 'example',
        changeType: 'changed',
        fileUri: Option.some(template)
      },
      {
        metadataType: 'LightningComponentBundle',
        fullName: 'example',
        changeType: 'changed',
        fileUri: Option.some(metadata)
      }
    ]);

    const unmatched = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* MetadataChangeNotificationService;
        yield* service.publishOperation({
          operation: 'deploy',
          completedAt: '2026-07-30T00:00:00.000Z',
          changes: [...changes]
        });
        return yield* service.dedupeWorkspaceEvents([
          { type: 'change', uri: controller },
          { type: 'change', uri: template },
          { type: 'change', uri: metadata }
        ]);
      }).pipe(Effect.provide(MetadataChangeNotificationService.Default))
    );

    expect(unmatched).toEqual([]);
  });

  it('allows later manual changes after the operation correlation window expires', async () => {
    const sourceUri = URI.file('/workspace/classes/Foo.cls');

    const unmatched = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* MetadataChangeNotificationService;
        yield* service.publishOperation({
          operation: 'retrieve',
          completedAt: '2026-07-30T00:00:00.000Z',
          changes: [
            {
              metadataType: 'ApexClass',
              fullName: 'Foo',
              changeType: 'created',
              fileUri: Option.some(sourceUri)
            }
          ]
        });
        yield* TestClock.adjust('2100 millis');
        return yield* service.dedupeWorkspaceEvents([{ type: 'change', uri: sourceUri }]);
      }).pipe(Effect.provide(MetadataChangeNotificationService.Default), Effect.provide(TestContext.TestContext))
    );

    expect(unmatched).toEqual([{ type: 'change', uri: sourceUri }]);
  });

  it('does not suppress a manual deletion that contradicts a recent retrieve', async () => {
    const sourceUri = URI.file('/workspace/classes/Foo.cls');
    const metadataUri = URI.file('/workspace/classes/Foo.cls-meta.xml');

    const unmatched = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* MetadataChangeNotificationService;
        yield* service.publishOperation({
          operation: 'retrieve',
          completedAt: '2026-07-30T00:00:00.000Z',
          changes: [
            {
              metadataType: 'ApexClass',
              fullName: 'Foo',
              changeType: 'created',
              fileUri: Option.some(sourceUri),
              fileUris: [sourceUri, metadataUri]
            }
          ]
        });
        return yield* service.dedupeWorkspaceEvents([
          { type: 'delete', uri: sourceUri },
          { type: 'delete', uri: metadataUri }
        ]);
      }).pipe(Effect.provide(MetadataChangeNotificationService.Default))
    );

    expect(unmatched).toEqual([
      { type: 'delete', uri: sourceUri },
      { type: 'delete', uri: metadataUri }
    ]);
  });
});
