/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'node:os';
import * as Impl from '../../../../../src/soql-model/model/impl';
import * as Soql from '../../../../../src/soql-model/model/model';

describe('QueryImpl should', () => {
  it('store query components as appropriate model objects', () => {
    const expected = {
      select: { selectExpressions: [] },
      from: { sobjectName: 'songs' },
      where: {
        condition: {
          field: { fieldName: 'paint_it' },
          operator: '=',
          compareValue: { value: "'black'" }
        }
      },
      with: {
        unmodeledSyntax: 'gimme shelter',
        reason: Soql.REASON_UNMODELED_WITH
      },
      groupBy: {
        unmodeledSyntax: 'start me up',
        reason: Soql.REASON_UNMODELED_GROUPBY
      },
      orderBy: { orderByExpressions: [{ field: { fieldName: 'angie' } }] },
      limit: { limit: 5 },
      offset: {
        unmodeledSyntax: 'wild horses',
        reason: Soql.REASON_UNMODELED_OFFSET
      },
      bind: { unmodeledSyntax: 'miss you', reason: Soql.REASON_UNMODELED_BIND },
      recordTrackingType: {
        unmodeledSyntax: 'satisfaction',
        reason: Soql.REASON_UNMODELED_RECORDTRACKING
      },
      update: {
        unmodeledSyntax: 'under my thumb',
        reason: Soql.REASON_UNMODELED_UPDATE
      }
    };
    const actual = new Impl.QueryImpl(
      new Impl.SelectExprsImpl([]),
      new Impl.FromImpl(expected.from.sobjectName),
      new Impl.WhereImpl(
        new Impl.FieldCompareConditionImpl(
          new Impl.FieldRefImpl(expected.where.condition.field.fieldName),
          Soql.ConditionOperator.Equals,
          new Impl.LiteralImpl(expected.where.condition.compareValue.value)
        )
      ),
      new Impl.UnmodeledSyntaxImpl(expected.with.unmodeledSyntax, Soql.REASON_UNMODELED_WITH),
      new Impl.UnmodeledSyntaxImpl(expected.groupBy.unmodeledSyntax, Soql.REASON_UNMODELED_GROUPBY),
      new Impl.OrderByImpl([
        new Impl.OrderByExpressionImpl(new Impl.FieldRefImpl(expected.orderBy.orderByExpressions[0].field.fieldName))
      ]),
      new Impl.LimitImpl(expected.limit.limit),
      new Impl.UnmodeledSyntaxImpl(expected.offset.unmodeledSyntax, Soql.REASON_UNMODELED_OFFSET),
      new Impl.UnmodeledSyntaxImpl(expected.bind.unmodeledSyntax, Soql.REASON_UNMODELED_BIND),
      new Impl.UnmodeledSyntaxImpl(expected.recordTrackingType.unmodeledSyntax, Soql.REASON_UNMODELED_RECORDTRACKING),
      new Impl.UnmodeledSyntaxImpl(expected.update.unmodeledSyntax, Soql.REASON_UNMODELED_UPDATE)
    );
    expect(actual).toEqual(expected);
  });
  it('return query string, one line per clause with all but SELECT clause indented for toSoqlSyntax()', () => {
    const expected = `SELECT ${EOL}` + `  FROM songs${EOL}` + `  WHERE paint_it = 'black'${EOL}`;
    const actual = new Impl.QueryImpl(
      new Impl.SelectExprsImpl([]),
      new Impl.FromImpl('songs'),
      new Impl.WhereImpl(
        new Impl.FieldCompareConditionImpl(
          new Impl.FieldRefImpl('paint_it'),
          Soql.ConditionOperator.Equals,
          new Impl.LiteralImpl("'black'")
        )
      )
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
