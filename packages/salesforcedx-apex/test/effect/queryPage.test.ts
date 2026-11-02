/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { QueryPageSchema } from '../../src/effect/schema/queryPage';

const Page = QueryPageSchema(Schema.String);

describe('query pages', () => {
  it('decodes terminal and continuing pages with distinct continuation fields', () => {
    expect(Schema.decodeUnknownSync(Page)({ totalSize: 0 })).toEqual({ totalSize: 0, done: true, records: [] });
    expect(
      Schema.decodeUnknownSync(Page)({ totalSize: 2, done: false, nextRecordsUrl: '/next', records: ['one'] })
    ).toEqual({ totalSize: 2, done: false, nextRecordsUrl: '/next', records: ['one'] });
  });

  it.each([
    { totalSize: 1, done: true, nextRecordsUrl: '/next' },
    { totalSize: 1, nextRecordsUrl: '/next' },
    { totalSize: 1, done: false },
    { totalSize: 1, done: false, nextRecordsUrl: '' }
  ])('rejects contradictory or missing continuation state: %j', page => {
    expect(Schema.decodeUnknownEither(Page)(page)).toMatchObject({ _tag: 'Left' });
  });
});
