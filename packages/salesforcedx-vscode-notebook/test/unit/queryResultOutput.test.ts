/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { stripAttributes, toQueryResultPayload } from '../../src/queryResultOutput';

describe('query result output', () => {
  it('maps an empty query result', () => {
    expect(toQueryResultPayload({ totalSize: 0, done: true, records: [] })).toEqual({
      totalSize: 0,
      done: true,
      records: []
    });
  });

  it('preserves a nested parent relationship without attributes', () => {
    expect(
      toQueryResultPayload({
        totalSize: 1,
        done: true,
        records: [
          {
            attributes: { type: 'Contact' },
            Id: '003000000000001',
            Account: {
              attributes: { type: 'Account' },
              Id: '001000000000001',
              Name: 'Acme'
            }
          }
        ]
      })
    ).toEqual({
      totalSize: 1,
      done: true,
      records: [
        {
          Id: '003000000000001',
          Account: { Id: '001000000000001', Name: 'Acme' }
        }
      ]
    });
  });

  it('preserves subquery metadata and strips attributes from nested records', () => {
    expect(
      toQueryResultPayload({
        totalSize: 1,
        done: true,
        records: [
          {
            Name: 'Acme',
            Contacts: {
              totalSize: 1,
              done: true,
              records: [{ attributes: { type: 'Contact' }, Id: '003000000000001', Name: 'Ada' }]
            }
          }
        ]
      })
    ).toEqual({
      totalSize: 1,
      done: true,
      records: [
        {
          Name: 'Acme',
          Contacts: {
            totalSize: 1,
            done: true,
            records: [{ Id: '003000000000001', Name: 'Ada' }]
          }
        }
      ]
    });
  });

  it('strips only attributes and preserves other keys', () => {
    expect(
      stripAttributes({
        attributes: { type: 'Account' },
        Attributes: 'preserved',
        Name: 'Acme',
        Active: false,
        Score: 0,
        ParentId: undefined
      })
    ).toEqual({
      Attributes: 'preserved',
      Name: 'Acme',
      Active: false,
      Score: 0,
      ParentId: undefined
    });
  });
});
