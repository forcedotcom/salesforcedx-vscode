/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-param-reassign, @typescript-eslint/consistent-type-assertions */
import * as Impl from './impl';
import { AndOr, Condition } from './model';


export namespace SoqlModelUtils {
  /**
   * This method returns quickly as soon as it finds unmodeled syntax.
   *
   * @param model
   */

  export function containsUnmodeledSyntax(model: Record<string, any>): boolean {
    if (isUnmodeledSyntax(model)) {
      return true;
    }
    for (const property in model) {
      if (typeof model[property] === 'object') {
        const hasUnmodeledSyntax = containsUnmodeledSyntax(model[property]);
        if (hasUnmodeledSyntax) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * This method determins whether the model object is an instance of unmodeled syntax, without checking property objects.
   *
   * @param model
   */

  export function isUnmodeledSyntax(model: Record<string, any>): boolean {
    return 'unmodeledSyntax' in model;
  }

  /**
   * This method collects all the unmodelled syntax it finds into a collection and returns it.
   *
   * @param model
   * @param collector
   */
  export function getUnmodeledSyntax(

    model: Record<string, any>,
    collector?: Impl.UnmodeledSyntaxImpl[]
  ): Impl.UnmodeledSyntaxImpl[] {
    collector = collector || [];
    if ('unmodeledSyntax' in model) {
      collector.push(model as Impl.UnmodeledSyntaxImpl);
      return collector;
    }
    for (const property in model) {
      if (typeof model[property] === 'object') {
        getUnmodeledSyntax(model[property], collector);
      }
    }
    return collector;
  }


  export function containsError(model: Record<string, any>): boolean {
    if ('errors' in model && Array.isArray(model.errors) && model.errors.length > 0) {
      return true;
    }
    for (const property in model) {
      if (typeof model[property] === 'object') {
        const hasError = containsError(model[property]);
        if (hasError) {
          return true;
        }
      }
    }
    return false;
  }

  export function simpleGroupToArray(condition: Condition): { conditions: Condition[]; andOr?: AndOr } {
    if (!isSimpleGroup(condition)) {
      throw Error('not simple group');
    }
    condition = stripNesting(condition);
    let conditions: Condition[] = [];
    let andOr: AndOr | undefined;
    if (condition instanceof Impl.AndOrConditionImpl) {
      conditions = conditions.concat(simpleGroupToArray(condition.leftCondition).conditions);
      conditions = conditions.concat(simpleGroupToArray(condition.rightCondition).conditions);
      andOr = condition.andOr;
    } else {
      conditions.push(condition);
    }
    return { conditions, andOr };
  }

  export function arrayToSimpleGroup(conditions: Condition[], andOr?: AndOr): Condition {
    if (conditions.length > 1 && andOr === undefined) {
      throw Error('no operator supplied for conditions');
    }
    if (conditions.length === 0) {
      throw Error('no conditions');
    }

    if (conditions.length === 1) {
      return conditions[0];
    } else {
      const [left, ...rest] = conditions;
      return new Impl.AndOrConditionImpl(left, andOr as AndOr, arrayToSimpleGroup(rest, andOr));
    }
  }

  export function isSimpleGroup(condition: Condition, andOr?: AndOr): boolean {
    // a simple group is a condition that can be expressed as an ANY or ALL group of conditions
    // ANY: simple conditions all joined by OR
    // ALL: simple conditions all joined by AND
    condition = stripNesting(condition);
    if (condition instanceof Impl.AndOrConditionImpl) {
      if (!andOr) {
        andOr = condition.andOr;
      }
      return (
        condition.andOr === andOr &&
        isSimpleGroup(condition.leftCondition, andOr) &&
        isSimpleGroup(condition.rightCondition, andOr)
      );
    }
    return isSimpleCondition(condition);
  }

  export function isSimpleCondition(condition: Condition): boolean {
    condition = stripNesting(condition);
    return (
      condition instanceof Impl.FieldCompareConditionImpl ||
      condition instanceof Impl.IncludesConditionImpl ||
      condition instanceof Impl.InListConditionImpl ||
      condition instanceof Impl.UnmodeledSyntaxImpl
    );
  }

  export function getKeyByValue(object: { [key: string]: string }, value: string): string | undefined {
    return Object.keys(object).find((key: string) => object[key] === value);
  }


  function stripNesting(condition: Condition): Condition {
    while (condition instanceof Impl.NestedConditionImpl) {
      condition = condition.condition;
    }
    return condition;
  }
}
