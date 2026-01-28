/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AndOrConditionImpl } from '../../../../src/soql-model/model/impl/andOrConditionImpl';
import { FieldCompareConditionImpl } from '../../../../src/soql-model/model/impl/fieldCompareConditionImpl';
import { FieldRefImpl } from '../../../../src/soql-model/model/impl/fieldRefImpl';
import { FieldSelectionImpl } from '../../../../src/soql-model/model/impl/fieldSelectionImpl';
import { FromImpl } from '../../../../src/soql-model/model/impl/fromImpl';
import { IncludesConditionImpl } from '../../../../src/soql-model/model/impl/includesConditionImpl';
import { InListConditionImpl } from '../../../../src/soql-model/model/impl/inListConditionImpl';
import { LiteralImpl } from '../../../../src/soql-model/model/impl/literalImpl';
import { NestedConditionImpl } from '../../../../src/soql-model/model/impl/nestedConditionImpl';
import { NotConditionImpl } from '../../../../src/soql-model/model/impl/notConditionImpl';
import { QueryImpl } from '../../../../src/soql-model/model/impl/queryImpl';
import { SelectExprsImpl } from '../../../../src/soql-model/model/impl/selectExprsImpl';
import { UnmodeledSyntaxImpl } from '../../../../src/soql-model/model/impl/unmodeledSyntaxImpl';
import * as Soql from '../../../../src/soql-model/model/model';
import { SoqlModelUtils } from '../../../../src/soql-model/model/util';

const field = new FieldRefImpl('field');
const literal = new LiteralImpl("'Hello'");
const conditionFieldCompare = new FieldCompareConditionImpl(field, Soql.ConditionOperator.Equals, literal);
const conditionLike = new FieldCompareConditionImpl(field, Soql.ConditionOperator.Like, literal);
const conditionInList = new InListConditionImpl(field, Soql.ConditionOperator.In, [literal]);
const conditionIncludes = new IncludesConditionImpl(field, Soql.ConditionOperator.Includes, [literal]);
const conditionUnmodeled = new UnmodeledSyntaxImpl('A + B > 10', Soql.REASON_UNMODELED_CALCULATEDCONDITION);
const conditionAndOr = new AndOrConditionImpl(conditionFieldCompare, Soql.AndOr.And, conditionLike);
const conditionNested = new NestedConditionImpl(conditionFieldCompare);
const conditionNot = new NotConditionImpl(conditionFieldCompare);

describe('SoqlModelUtils should', () => {
  it('isUnmodeledSyntax should return true if the model object is unmodeled syntax', () => {
    const actual = SoqlModelUtils.isUnmodeledSyntax(
      new UnmodeledSyntaxImpl('foo', { reasonCode: 'unmodeled:foo', message: 'foo' })
    );
    expect(actual).toBeTruthy();
  });
  it('isUnmodeledSyntax should return false if the model object is not unmodeled syntax, even if child objects are unmodeled', () => {
    const actual = SoqlModelUtils.isUnmodeledSyntax(
      new QueryImpl(
        new SelectExprsImpl([
          new FieldSelectionImpl(
            new FieldRefImpl('field1'),
            new UnmodeledSyntaxImpl('alias1', Soql.REASON_UNMODELED_ALIAS)
          )
        ]),
        new FromImpl('object1')
      )
    );
    expect(actual).toBeFalsy();
  });
  it('return true if SOQL query model contains unmodeled syntax', () => {
    const actual = SoqlModelUtils.containsUnmodeledSyntax(
      new QueryImpl(
        new SelectExprsImpl([
          new FieldSelectionImpl(
            new FieldRefImpl('field1'),
            new UnmodeledSyntaxImpl('alias1', Soql.REASON_UNMODELED_ALIAS)
          )
        ]),
        new FromImpl('object1')
      )
    );
    expect(actual).toBeTruthy();
  });
  it('returns an array explaining what is unsupported', () => {
    const unmodeled1 = {
      syntax: 'alias',
      reason: Soql.REASON_UNMODELED_ALIAS
    };
    const unmodeled2 = {
      syntax: 'COUNT(Id) recordCount',
      reason: Soql.REASON_UNMODELED_FUNCTIONREFERENCE
    };
    const actual = SoqlModelUtils.getUnmodeledSyntax(
      new QueryImpl(
        new SelectExprsImpl([
          new FieldSelectionImpl(
            new FieldRefImpl('field1'),
            new UnmodeledSyntaxImpl(unmodeled1.syntax, unmodeled1.reason)
          ),
          new FieldSelectionImpl(
            new FieldRefImpl('field2'),
            new UnmodeledSyntaxImpl(unmodeled2.syntax, unmodeled2.reason)
          )
        ]),
        new FromImpl('object1')
      )
    );
    expect(actual.length).toEqual(2);
    expect(actual[0].reason).toEqual(unmodeled1.reason);
    expect(actual[0].unmodeledSyntax).toEqual(unmodeled1.syntax);
    expect(actual[1].reason).toEqual(unmodeled2.reason);
    expect(actual[1].unmodeledSyntax).toEqual(unmodeled2.syntax);
  });
  it('return false if SOQL query model does not contain unmodeled syntax', () => {
    const actual = SoqlModelUtils.containsUnmodeledSyntax(
      new QueryImpl(new SelectExprsImpl([new FieldRefImpl('field1')]), new FromImpl('object1'))
    );
    expect(actual).toBeFalsy();
  });
  it('return true from isSimpleCondition for simple conditions', () => {
    const simpleConditions: Soql.Condition[] = [
      conditionFieldCompare,
      conditionLike,
      conditionIncludes,
      conditionInList,
      conditionUnmodeled,
      conditionNested
    ];
    let actual = true;
    simpleConditions.forEach(condition => (actual &&= SoqlModelUtils.isSimpleCondition(condition)));
    expect(actual).toBeTruthy();
  });
  it('return false from isSimpleCondition for non-simple conditions', () => {
    const complexConditions: Soql.Condition[] = [
      conditionAndOr,
      conditionNot,
      new NestedConditionImpl(conditionAndOr)
    ];
    let actual = true;
    complexConditions.forEach(condition => (actual &&= !SoqlModelUtils.isSimpleCondition(condition)));
    expect(actual).toBeTruthy();
  });
  it('return true from isSimpleGroup for simple group of conditions', () => {
    const simpleGroups: Soql.Condition[] = [
      conditionFieldCompare,
      conditionAndOr,
      new AndOrConditionImpl(conditionFieldCompare, Soql.AndOr.And, conditionAndOr),
      new NestedConditionImpl(conditionAndOr)
    ];
    let actual = true;
    simpleGroups.forEach(condition => (actual &&= SoqlModelUtils.isSimpleGroup(condition)));
    expect(actual).toBeTruthy();
  });
  it('return false from isSimpleGroup for non-simple group of conditions', () => {
    const nonSimpleGroups: Soql.Condition[] = [
      // NOT
      conditionNot,
      // mixing AND and OR
      new AndOrConditionImpl(conditionFieldCompare, Soql.AndOr.Or, conditionAndOr),
      // combined simple groups
      new AndOrConditionImpl(
        new NestedConditionImpl(conditionAndOr),
        Soql.AndOr.Or,
        new NestedConditionImpl(conditionAndOr)
      )
    ];
    let actual = true;
    nonSimpleGroups.forEach(condition => (actual &&= !SoqlModelUtils.isSimpleGroup(condition)));
    expect(actual).toBeTruthy();
  });
  it('throws from simpleGroupToArray if condition not simple group', () => {
    const nonSimpleGroup = new AndOrConditionImpl(conditionFieldCompare, Soql.AndOr.Or, conditionAndOr);
    expect(() => SoqlModelUtils.simpleGroupToArray(nonSimpleGroup)).toThrow();
  });
  it('returns array and operator from simpleGroupToArray for simple group', () => {
    const simpleGroup = new AndOrConditionImpl(conditionFieldCompare, Soql.AndOr.And, conditionAndOr);
    const { conditions, andOr } = SoqlModelUtils.simpleGroupToArray(simpleGroup);
    expect(conditions.length).toEqual(3);
    expect(andOr).toEqual(Soql.AndOr.And);
  });
  it('throws from arrayToSimpleGroup if conditions array empty', () => {
    const conditions: Soql.Condition[] = [];
    expect(() => SoqlModelUtils.arrayToSimpleGroup(conditions)).toThrow();
  });
  it('throws from arrayToSimpleGroup if >1 condition and operator missing', () => {
    const conditions: Soql.Condition[] = [conditionFieldCompare, conditionLike];
    expect(() => SoqlModelUtils.arrayToSimpleGroup(conditions)).toThrow();
  });
  it('returns simple group condition from arrayToSimpleGroup', () => {
    const conditions = [conditionFieldCompare, conditionLike, conditionInList];
    const andOr = Soql.AndOr.Or;

    const expected = new AndOrConditionImpl(
      conditions[0],
      andOr,
      new AndOrConditionImpl(conditions[1], andOr, conditions[2])
    );
    const actual = SoqlModelUtils.arrayToSimpleGroup(conditions, andOr);
    expect(actual).toEqual(expected);
  });
});
