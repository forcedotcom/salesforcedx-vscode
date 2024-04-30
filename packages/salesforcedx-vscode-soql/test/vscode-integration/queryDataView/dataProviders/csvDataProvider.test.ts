/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JsonMap } from '@salesforce/ts-types';
import { expect } from 'chai';
import { CsvDataProvider } from '../../../../src/queryDataView/dataProviders/csvDataProvider';

type TestQuery = {
  queryText: string;
  queryResults: JsonMap[];
  csvOutput: string[];
};

const attributes = {
  type: 'type',
  url: 'url'
};

const simpleQuery: TestQuery = {
  queryText: 'SELECT A, B FROM C',
  queryResults: [
    {
      attributes,
      A: 'a',
      B: 'b'
    },
    {
      attributes,
      A: 'c',
      B: 'd'
    }
  ],
  csvOutput: ['A,B', 'a,b', 'c,d']
};
const childToParentRel: TestQuery = {
  queryText: 'SELECT A, B.X FROM C',
  queryResults: [
    {
      attributes,
      A: 'a',
      B: {
        attributes,
        X: 'b'
      }
    },
    {
      attributes,
      A: 'c',
      B: {
        attributes,
        X: 'd'
      }
    }
  ],
  csvOutput: ['A,B.X', 'a,b', 'c,d']
};
const parentToChildRel: TestQuery = {
  queryText: 'SELECT A, (SELECT X FROM B) FROM C',
  queryResults: [
    {
      attributes,
      A: 'a',
      B: null
    },
    {
      attributes,
      A: 'c',
      B: {
        attributes,
        records: [
          {
            attributes,
            X: 'b'
          },
          {
            attributes,
            X: 'd'
          }
        ]
      }
    }
  ],
  csvOutput: ['A,B.X', 'a,', 'c,b', 'c,d']
};
const aggFn: TestQuery = {
  queryText: 'SELECT A, MIN(B) FROM C GROUP BY A',
  queryResults: [
    {
      attributes,
      A: 'a',
      expr0: 5
    },
    {
      attributes,
      A: 'c',
      expr0: 10
    }
  ],
  csvOutput: ['A,MIN(B)', 'a,5', 'c,10']
};
const alias: TestQuery = {
  queryText: 'SELECT A, MIN(B) min FROM C GROUP BY A',
  queryResults: [
    {
      attributes,
      A: 'a',
      min: 5
    },
    {
      attributes,
      A: 'c',
      min: 10
    }
  ],
  csvOutput: ['A,min', 'a,5', 'c,10']
};

describe('CsvDataProvider', () => {
  it('should output appropriate CSV for simple selections in a query', () => {
    testQuery(simpleQuery);
  });
  it('should output appropriate CSV for child to parent relationship queries', () => {
    testQuery(childToParentRel);
  });
  it('should output appropriate CSV for parent to child relationship queries', () => {
    testQuery(parentToChildRel);
  });
  it('should output appropriate CSV for queries with aggregate functions selected', () => {
    testQuery(aggFn);
  });
  it('should output appropriate CSV for queries with aliased aggregate functions selected', () => {
    testQuery(alias);
  });
});

function testQuery(q: TestQuery): void {
  const provider = new CsvDataProvider('x.soql');
  expect(
    provider
      .getFileContent(q.queryText, q.queryResults)
      .split('\n')
      .map(s => s.trim())
  ).deep.eq(q.csvOutput);
}
