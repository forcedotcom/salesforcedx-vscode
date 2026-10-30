/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  MetadataChangeNotificationService,
  MetadataRetrieveService,
  OrgMetadataCatalog,
  OrgId,
  ConnectionService
} from '@salesforce/vscode-services-v2';
import coreFs from '@salesforce/core/fs';
import { SourceTracking } from '@salesforce/source-tracking';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import { SourceTrackingResultUpdates } from '../../src/sourceTrackingService.js';
import { OrgChanges } from '../../src/targetOrgRef.js';
import { createMetadataOperationTest } from '../support/metadataOperation.js';

// Actual Metadata API ZIP: unpackaged/classes/Remote.cls, descriptor and package.xml.
const zipFile =
  'UEsDBBQAAAAIAAAAXl1Bt1XwGAAAABYAAAAdAAAAdW5wYWNrYWdlZC9jbGFzc2VzL1JlbW90ZS5jbHMrKE3KyUxWSM5JLC5WCErNzS9JVaiuBQBQSwMEFAAAAAgAAABeXS43Yz1jAAAAewAAACYAAAB1bnBhY2thZ2VkL2NsYXNzZXMvUmVtb3RlLmNscy1tZXRhLnhtbE3NwQmAMAxA0VXEAZoioiCxIO7gPdSIBWuLieL4XkQ8/nf5OGS+x41Eijtuu/Tlqpo7AEmUjSzp8Gx8ilBZ24CtIbLSTEqlQ8ph4kNC2l3TGovwAxQlPcUNXsPFCG8ifD/3AFBLAwQUAAAACAAAAF5dS7BNbnYAAACYAAAAFgAAAHVucGFja2FnZWQvcGFja2FnZS54bWw1zm0KwkAMRdGtSBcwGUQqSAyIGxB3EMf4gc1kaILU3SvS/jxwHzw8cXnxXVaTDtX33SOi7QDcuCW/2VgkFVNY59xD3oBK8JWDO8L4NHFCFb3I6HQWtRCExVhZhQ5NpuPA7gh/I8yz9695WqV+mzLCIoT5Dn0BUEsBAhQDFAAAAAgAAABeXUG3VfAYAAAAFgAAAB0AAAAAAAAAAAAAAIABAAAAAHVucGFja2FnZWQvY2xhc3Nlcy9SZW1vdGUuY2xzUEsBAhQDFAAAAAgAAABeXS43Yz1jAAAAewAAACYAAAAAAAAAAAAAAIABUwAAAHVucGFja2FnZWQvY2xhc3Nlcy9SZW1vdGUuY2xzLW1ldGEueG1sUEsBAhQDFAAAAAgAAABeXUuwTW52AAAAmAAAABYAAAAAAAAAAAAAAIAB+gAAAHVucGFja2FnZWQvcGFja2FnZS54bWxQSwUGAAAAAAMAAwDjAAAApAEAAAAA';

const installRetrieveTransport = (fixture: Awaited<ReturnType<typeof createMetadataOperationTest>>) => {
  const response = {
    id: '09S000000000001',
    done: true,
    success: true,
    status: 'Succeeded',
    zipFile,
    fileProperties: [
      {
        fullName: 'Remote',
        type: 'ApexClass',
        fileName: 'unpackaged/classes/Remote.cls',
        lastModifiedDate: '2026-10-30T00:00:00.000Z'
      }
    ]
  } as Awaited<ReturnType<typeof fixture.connection.metadata.checkRetrieveStatus>>;
  return {
    response,
    start: vi
      .spyOn(fixture.connection.metadata, 'retrieve')
      .mockResolvedValue({ id: response.id, done: false, state: 'InProgress' }),
    poll: vi.spyOn(fixture.connection.metadata, 'checkRetrieveStatus').mockResolvedValue(response)
  };
};

it('invalidates primed workspace-type membership before publishing the first retrieved local ApexClass', async () => {
  const test = await createMetadataOperationTest({ withApexClass: false });
  try {
    vi.spyOn(test.connection.metadata, 'describe').mockResolvedValue({
      metadataObjects: [
        {
          xmlName: 'ApexClass',
          directoryName: 'classes',
          inFolder: false,
          metaFile: true,
          suffix: 'cls',
          childXmlNames: []
        }
      ],
      organizationNamespace: '',
      partialSaveAllowed: true,
      testRequired: false
    });
    installRetrieveTransport(test);
    await test.runtime.runPromise(
      Effect.gen(function* () {
        const catalog = yield* OrgMetadataCatalog;
        expect((yield* catalog.getChildren()).find(entry => entry.name === 'ApexClass')).toMatchObject({
          inOrg: true,
          inWorkspace: false
        });
        const subscription = yield* MetadataChangeNotificationService.use(service => PubSub.subscribe(service.pubsub));
        const requery = yield* PubSub.take(subscription).pipe(
          Effect.flatMap(notification =>
            catalog.getChildren().pipe(Effect.map(entries => ({ event: notification, children: entries })))
          ),
          Effect.forkChild
        );
        yield* MetadataRetrieveService.use(service => service.retrieve([{ type: 'ApexClass', fullName: 'Remote' }]));
        const { event, children } = yield* Fiber.join(requery);
        expect(event).toMatchObject({ operation: 'retrieve', orgId: test.orgId });
        expect(children.find(entry => entry.name === 'ApexClass')).toMatchObject({
          inOrg: true,
          inWorkspace: true
        });
      }).pipe(Effect.scoped)
    );
    expect(String(await coreFs.fs.promises.readFile(test.source.fsPath))).toBe('public class Remote {}');
  } finally {
    await test.dispose();
  }
});

it('rejects an expected-org mismatch before native retrieve starts', async () => {
  const fixture = await createMetadataOperationTest();
  try {
    const transport = installRetrieveTransport(fixture);
    const wrongOrg = Schema.decodeUnknownSync(OrgId)('00D000000000002');
    expect(
      await fixture.runtime.runPromise(
        MetadataRetrieveService.use(service =>
          service.retrieve([{ type: 'ApexClass', fullName: 'Remote' }], { expectedOrgId: wrongOrg })
        ).pipe(Effect.flip)
      )
    ).toMatchObject({ _tag: 'InactiveOrgOperationError', expectedOrgId: wrongOrg });
    expect(transport.start).not.toHaveBeenCalled();
  } finally {
    await fixture.dispose();
  }
});

it.each([false, true])('uses real STL conflicts before merged retrieval, ignoreConflicts=%s', async ignoreConflicts => {
  const fixture = await createMetadataOperationTest({
    tracksSource: true,
    sourceMembers: [
      {
        MemberIdOrName: 'Remote',
        MemberType: 'ApexClass',
        MemberName: 'Remote',
        IsNameObsolete: false,
        IsNewMember: true,
        RevisionCounter: 1,
        ChangedBy: '005000000000001',
        LastModifiedDate: '2026-10-30T00:00:00.000Z'
      }
    ]
  });
  try {
    const transport = installRetrieveTransport(fixture);
    const nativeUpdate = vi.spyOn(SourceTracking.prototype, 'updateTrackingFromRetrieve');
    const result = await fixture.runtime.runPromiseExit(
      MetadataRetrieveService.use(service => service.retrieveComponentSet(fixture.components, { ignoreConflicts }))
    );
    const failure = result._tag === 'Failure' ? result.cause.reasons : [];
    expect(failure).toMatchObject(
      ignoreConflicts ? [] : [{ _tag: 'Fail', error: { _tag: 'SourceTrackingConflictError' } }]
    );
    expect(transport.start).toHaveBeenCalledTimes(ignoreConflicts ? 1 : 0);
    expect(nativeUpdate).toHaveBeenCalledTimes(ignoreConflicts ? 1 : 0);
    expect(String(await coreFs.fs.promises.readFile(fixture.source.fsPath))).toBe(
      ignoreConflicts ? 'public class Remote {}' : 'public class Remote { /* local */ }'
    );
  } finally {
    await fixture.dispose();
  }
});

it('rejects a retrieve whose captured epoch changed during native polling before tracking or notification', async () => {
  const fixture = await createMetadataOperationTest();
  const release = Promise.withResolvers<Awaited<ReturnType<typeof fixture.connection.metadata.checkRetrieveStatus>>>();
  const transport = installRetrieveTransport(fixture);
  let result: Promise<unknown> | undefined;
  try {
    const entered = Promise.withResolvers<void>();
    transport.poll.mockImplementationOnce(() => {
      entered.resolve();
      return release.promise;
    });
    const updates = await fixture.runtime.runPromise(SourceTrackingResultUpdates);
    const update = vi.spyOn(updates, 'maybeUpdateTrackingFromRetrieve');
    const notifications = await fixture.runtime.runPromise(MetadataChangeNotificationService);
    const publish = vi.spyOn(notifications, 'publishOperation');
    result = fixture.runtime.runPromise(
      MetadataRetrieveService.use(service => service.retrieve([{ type: 'ApexClass', fullName: 'Remote' }])).pipe(
        Effect.flip
      )
    );
    await entered.promise;
    await fixture.runtime.runPromise(OrgChanges.use(changes => changes.clear));
    await fixture.runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
    release.resolve(transport.response);
    expect(await result).toMatchObject({ _tag: 'InactiveOrgOperationError' });
    expect(update).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    // Native extraction already entered; its disk writes cannot be rolled back by an org epoch guard.
    expect(String(await coreFs.fs.promises.readFile(fixture.source.fsPath))).toBe('public class Remote {}');
  } finally {
    release.resolve(transport.response);
    await result;
    await fixture.dispose();
  }
});
