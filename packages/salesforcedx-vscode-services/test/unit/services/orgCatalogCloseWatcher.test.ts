/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OrgId } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { flushPreviousOrgOnChanges } from '../../../src/services/orgCatalog/orgCatalogCloseWatcher';

it('logs every target-org transition and flushes only the org being left', async () => {
  const orgA = Schema.decodeUnknownSync(OrgId)('00D000000000001');
  const orgB = Schema.decodeUnknownSync(OrgId)('00D000000000002');
  const flushed: OrgId[] = [];
  const messages: string[] = [];
  await Effect.runPromise(
    flushPreviousOrgOnChanges(
      Stream.fromIterable([undefined, orgA, orgB, undefined]),
      orgId =>
        Effect.sync(() => {
          flushed.push(orgId);
        }),
      message =>
        Effect.sync(() => {
          messages.push(message);
        })
    )
  );
  expect(flushed).toEqual([orgA, orgB]);
  expect(messages).toEqual([
    'Target org changed to <NOT SET>',
    `Target org changed to ${orgA}`,
    `Target org changed to ${orgB}; closing previous org ${orgA}`,
    `Target org changed to <NOT SET>; closing previous org ${orgB}`
  ]);
});

it('does not repeat catalog flushes for equal org snapshots', async () => {
  const orgId = Schema.decodeUnknownSync(OrgId)('00D000000000001');
  const flushed: OrgId[] = [];
  await Effect.runPromise(
    flushPreviousOrgOnChanges(
      Stream.fromIterable([orgId, orgId, orgId]),
      previous =>
        Effect.sync(() => {
          flushed.push(previous);
        }),
      () => Effect.void
    )
  );
  expect(flushed).toEqual([]);
});
