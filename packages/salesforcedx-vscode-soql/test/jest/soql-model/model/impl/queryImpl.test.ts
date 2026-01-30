/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'node:os';
import { FieldCompareConditionImpl } from '../../../../../src/soql-model/model/impl/fieldCompareConditionImpl';
import { FieldRefImpl } from '../../../../../src/soql-model/model/impl/fieldRefImpl';
import { FromImpl } from '../../../../../src/soql-model/model/impl/fromImpl';
import { LimitImpl } from '../../../../../src/soql-model/model/impl/limitImpl';
import { LiteralImpl } from '../../../../../src/soql-model/model/impl/literalImpl';
import { OrderByExpressionImpl } from '../../../../../src/soql-model/model/impl/orderByExpressionImpl';
import { OrderByImpl } from '../../../../../src/soql-model/model/impl/orderByImpl';
import { QueryImpl } from '../../../../../src/soql-model/model/impl/queryImpl';
import { SelectExprsImpl } from '../../../../../src/soql-model/model/impl/selectExprsImpl';
import { UnmodeledSyntaxImpl } from '../../../../../src/soql-model/model/impl/unmodeledSyntaxImpl';
import { WhereImpl } from '../../../../../src/soql-model/model/impl/whereImpl';
import {
  ConditionOperator,
  REASON_UNMODELED_BIND,
  REASON_UNMODELED_GROUPBY,
  REASON_UNMODELED_OFFSET,
  REASON_UNMODELED_RECORDTRACKING,
  REASON_UNMODELED_UPDATE,
  REASON_UNMODELED_WITH
} from '../../../../../src/soql-model/model/model';

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
        reason: REASON_UNMODELED_WITH
      },
      groupBy: {
        unmodeledSyntax: 'start me up',
        reason: REASON_UNMODELED_GROUPBY
      },
      orderBy: { orderByExpressions: [{ field: { fieldName: 'angie' } }] },
      limit: { limit: 5 },
      offset: {
        unmodeledSyntax: 'wild horses',
        reason: REASON_UNMODELED_OFFSET
      },
      bind: { unmodeledSyntax: 'miss you', reason: REASON_UNMODELED_BIND },
      recordTrackingType: {
        unmodeledSyntax: 'satisfaction',
        reason: REASON_UNMODELED_RECORDTRACKING
      },
      update: {
        unmodeledSyntax: 'under my thumb',
        reason: REASON_UNMODELED_UPDATE
      }
    };
    const actual = new QueryImpl(
      new SelectExprsImpl([]),
      new FromImpl(expected.from.sobjectName),
      new WhereImpl(
        new FieldCompareConditionImpl(
          new FieldRefImpl(expected.where.condition.field.fieldName),
          ConditionOperator.Equals,
          new LiteralImpl(expected.where.condition.compareValue.value)
        )
      ),
      new UnmodeledSyntaxImpl(expected.with.unmodeledSyntax, REASON_UNMODELED_WITH),
      new UnmodeledSyntaxImpl(expected.groupBy.unmodeledSyntax, REASON_UNMODELED_GROUPBY),
      new OrderByImpl([
        new OrderByExpressionImpl(new FieldRefImpl(expected.orderBy.orderByExpressions[0].field.fieldName))
      ]),
      new LimitImpl(expected.limit.limit),
      new UnmodeledSyntaxImpl(expected.offset.unmodeledSyntax, REASON_UNMODELED_OFFSET),
      new UnmodeledSyntaxImpl(expected.bind.unmodeledSyntax, REASON_UNMODELED_BIND),
      new UnmodeledSyntaxImpl(expected.recordTrackingType.unmodeledSyntax, REASON_UNMODELED_RECORDTRACKING),
      new UnmodeledSyntaxImpl(expected.update.unmodeledSyntax, REASON_UNMODELED_UPDATE)
    );
    expect(actual).toEqual(expected);
  });
  it('return query string, one line per clause with all but SELECT clause indented for toSoqlSyntax()', () => {
    const expected = `SELECT ${EOL}` + `  FROM songs${EOL}` + `  WHERE paint_it = 'black'${EOL}`;
    const actual = new QueryImpl(
      new SelectExprsImpl([]),
      new FromImpl('songs'),
      new WhereImpl(
        new FieldCompareConditionImpl(
          new FieldRefImpl('paint_it'),
          ConditionOperator.Equals,
          new LiteralImpl("'black'")
        )
      )
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
