/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'node:os';
import * as Impl from '../../../../src/soql-model/model/impl';
import { HeaderCommentsImpl } from '../../../../src/soql-model/model/impl/headerCommentsImpl';
import { ModelSerializer } from '../../../../src/soql-model/serialization/serializer';

describe('ModelSerializer should', () => {
  it('transform model to SOQL syntax', () => {
    const expected = `SELECT field${EOL}  FROM object${EOL}`;
    const actual = new ModelSerializer(
      new Impl.QueryImpl(new Impl.SelectExprsImpl([new Impl.FieldRefImpl('field')]), new Impl.FromImpl('object'))
    ).serialize();
    expect(actual).toEqual(expected);
  });

  it('transform model with comments to SOQL syntax', () => {
    const expected = `// Comment 1${EOL}// Comment 2${EOL}SELECT field${EOL}  FROM object${EOL}`;

    const query = new Impl.QueryImpl(
      new Impl.SelectExprsImpl([new Impl.FieldRefImpl('field')]),
      new Impl.FromImpl('object')
    );
    query.headerComments = new HeaderCommentsImpl(`// Comment 1${EOL}// Comment 2${EOL}`);
    const actual = new ModelSerializer(query).serialize();
    expect(actual).toEqual(expected);
  });
});
