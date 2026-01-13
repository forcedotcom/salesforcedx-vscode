/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'os';
import { Soql } from '@salesforce/soql-model';
import {
  convertUiModelToSoql,
  convertSoqlToUiModel,
  soqlStringLiteralToDisplayValue,
  displayValueToSoqlStringLiteral,
  isLikeContains,
  isLikeEnds,
  isLikeStart,
  addWildCardToValue,
  stripWildCardPadding
} from './soqlUtils';
import { SELECT_COUNT, ToolingModelJson } from './model';

describe('SoqlUtils', () => {
  const uiModelOne: ToolingModelJson = {
    sObject: 'Account',
    fields: ['Name', 'Id'],
    where: {
      conditions: [
        {
          condition: {
            field: { fieldName: 'Name' },
            operator: '=',
            compareValue: {
              type: 'STRING',
              value: "'pwt'"
            }
          },
          index: 0
        },
        {
          condition: {
            field: { fieldName: 'Id' },
            operator: '=',
            compareValue: {
              type: 'NUMBER',
              value: '123456'
            }
          },
          index: 1
        }
      ],
      andOr: 'AND'
    },
    orderBy: [{ field: 'Name', order: 'ASC', nulls: 'NULLS FIRST' }],
    limit: '11',
    errors: [],
    unsupported: [],
    originalSoqlStatement: ''
  };
  const uiModelCount: ToolingModelJson = {
    sObject: 'Account',
    fields: [SELECT_COUNT],
    where: {
      conditions: [],
      andOr: undefined
    },
    orderBy: [],
    limit: '',
    errors: [],
    unsupported: [],
    originalSoqlStatement: ''
  };
  const uiModelErrors: ToolingModelJson = {
    sObject: 'Account',
    fields: ['Name'],
    orderBy: [],
    limit: '',
    errors: [
      {
        type: 'UNEXPECTEDEOF'
      }
    ],
    where: { conditions: [], andOr: undefined },
    unsupported: [
      {
        unmodeledSyntax: 'GROUP BY',
        reason: Soql.REASON_UNMODELED_GROUPBY
      }
    ],
    originalSoqlStatement: ''
  };
  const soqlOne =
    "Select Name, Id from Account WHERE Name = 'pwt' AND Id = 123456 ORDER BY Name ASC NULLS FIRST LIMIT 11";
  const soqlCount = 'SELECT COUNT() FROM Account';
  const unsupportedWhereExpr =
    "Select Name, Id from Account WHERE (Name = 'pwt' AND Id = 123456) OR Id = 654321 ORDER BY Name ASC NULLS FIRST LIMIT 11";
  const soqlError = 'Select Name from Account GROUP BY';
  it('transform UI Model to Soql', () => {
    const transformedSoql = convertUiModelToSoql(uiModelOne);
    expect(transformedSoql).toMatch(/^SELECT/);
    expect(transformedSoql).toContain(uiModelOne.fields[0]);
    expect(transformedSoql).toContain(uiModelOne.fields[1]);
    expect(transformedSoql).toContain(uiModelOne.sObject);
    expect(transformedSoql).toContain(
      uiModelOne.where.conditions[0].condition.compareValue.value
    );
    expect(transformedSoql).toContain(
      uiModelOne.where.conditions[1].condition.compareValue.value
    );
    expect(transformedSoql).toContain(uiModelOne.where.andOr);
    expect(transformedSoql).toContain('=');
    expect(transformedSoql).toContain(uiModelOne.orderBy[0].field);
    expect(transformedSoql).toContain(uiModelOne.orderBy[0].order);
    expect(transformedSoql).toContain(uiModelOne.orderBy[0].nulls);
    expect(transformedSoql).toContain('11');
  });

  it('transform UI Model to SOQL with SELECT COUNT() clause', () => {
    const transformedSoql = convertUiModelToSoql(uiModelCount);
    expect(transformedSoql).toContain('SELECT COUNT()');
  });

  it('transform UI Model to Soql but leaves out errors/unsupported', () => {
    const transformedSoql = convertUiModelToSoql(uiModelErrors);
    expect(transformedSoql).not.toContain(
      uiModelErrors.unsupported[0].unmodeledSyntax
    );
    expect(transformedSoql).not.toContain(uiModelErrors.errors[0].type);
  });

  it('transform UI Model with comments to Soql Model', () => {
    const modelWithComments: ToolingModelJson = {
      headerComments: `// Comments here${EOL}`,
      sObject: 'Foo',
      fields: ['Id'],
      where: { andOr: undefined, conditions: [] },
      orderBy: [],
      limit: '',
      errors: [],
      unsupported: [],
      originalSoqlStatement: `// Comments here${EOL}SELECT Id FROM Foo`
    };
    const transformedSoql = convertUiModelToSoql(modelWithComments);
    const transformedSoqlNormalized = transformedSoql.replace(/\n\s+/g, '\n');
    expect(transformedSoqlNormalized).toEqual(
      `// Comments here${EOL}SELECT Id${EOL}FROM Foo${EOL}`
    );
  });

  it('transforms Soql to UI Model', () => {
    const transformedUiModel = convertSoqlToUiModel(soqlOne);
    const expectedUiModel = { ...uiModelOne } as any;
    delete expectedUiModel.originalSoqlStatement;
    expect(JSON.stringify(transformedUiModel)).toEqual(
      JSON.stringify(expectedUiModel)
    );
  });

  it('transforms SOQL to UI Model with SELECT COUNT() clause', () => {
    const transformedUiModel = convertSoqlToUiModel(soqlCount);
    const expected = { ...uiModelCount } as any;
    delete expected.originalSoqlStatement;
    expect(JSON.stringify(transformedUiModel)).toEqual(
      JSON.stringify(expected)
    );
  });

  it('transforms Soql with comments to UI', () => {
    const transformedUiModel = convertSoqlToUiModel(
      `// Comments here${EOL}SELECT Id FROM Foo`
    );
    const expectedUiModel: ToolingModelJson = {
      headerComments: `// Comments here${EOL}`,
      sObject: 'Foo',
      fields: ['Id'],
      where: { andOr: undefined, conditions: [] },
      orderBy: [],
      limit: '',
      errors: [],
      unsupported: [],
      originalSoqlStatement: `// Comments here${EOL}SELECT Id FROM Foo`
    };
    delete expectedUiModel.originalSoqlStatement;
    expect(transformedUiModel).toEqual(expectedUiModel);

    expect(JSON.stringify(transformedUiModel)).toEqual(
      JSON.stringify(expectedUiModel)
    );
  });

  it('catches unsupported syntax in where', () => {
    const transformedUiModel = convertSoqlToUiModel(unsupportedWhereExpr);
    expect(transformedUiModel.where.conditions.length).toBe(0);
    expect(transformedUiModel.unsupported.length).toBe(1);
    expect(transformedUiModel.unsupported[0].reason).toEqual(
      Soql.REASON_UNMODELED_COMPLEXGROUP
    );
  });

  it('transforms Soql to UI Model with errors in soql syntax', () => {
    const transformedUiModel = convertSoqlToUiModel(soqlError);
    expect(transformedUiModel.errors[0].type).toEqual(
      uiModelErrors.errors[0].type
    );
    expect(transformedUiModel.unsupported[0].reason).toEqual(
      uiModelErrors.unsupported[0].reason
    );
  });

  describe('soqlStringLiteralToDisplayValue should', () => {
    it('strip quotes from SOQL string literal', () => {
      const expected = 'hello';
      const actual = soqlStringLiteralToDisplayValue("'hello'");
      expect(actual).toEqual(expected);
    });
    it('strip SOQL literal string escape characters', () => {
      const expected = '\'"\\';
      const actual = soqlStringLiteralToDisplayValue("'\\'\\\"\\\\'");
      expect(actual).toEqual(expected);
    });
  });

  describe('displayValueToSoqlStringLiteral should', () => {
    it('surround display value with quotes', () => {
      const expected = "'hello'";
      const actual = displayValueToSoqlStringLiteral('hello');
      expect(actual).toEqual(expected);
    });
    it('escape characters that need to be escaped in SOQL string literals', () => {
      const expected = "'\\'\\\"\\\\'";
      const actual = displayValueToSoqlStringLiteral('\'"\\');
      expect(actual).toEqual(expected);
    });
  });

  describe('LIKE OPERATOR UTILS', () => {
    it('isLikeStart() should return true with compareValue of ABC%', () => {
      expect(isLikeStart('ABC%')).toBe(true);
      expect(isLikeStart("'ABC%'")).toBe(true);
      expect(isLikeStart("A'BC%'")).toBe(true);
      expect(isLikeStart('A%BC%')).toBe(true);

      expect(isLikeStart('')).toBe(false);
      expect(isLikeStart('%ABC')).toBe(false);
      expect(isLikeStart('%ABC%')).toBe(false);
      expect(isLikeStart('A%BC')).toBe(false);
    });
    it('isLikeEnds() should return true with compareValue of %ABC', () => {
      expect(isLikeEnds('%ABC')).toBe(true);
      expect(isLikeEnds("'%ABC'")).toBe(true);
      expect(isLikeEnds("%AB'C'")).toBe(true);

      expect(isLikeEnds('ABC%')).toBe(false);
      expect(isLikeEnds('')).toBe(false);
      expect(isLikeEnds('%ABC%')).toBe(false);
      expect(isLikeEnds('A%BC')).toBe(false);
      expect(isLikeEnds('A%BC%')).toBe(false);
    });
    it('isLikeContains() should return true with compareValue of %ABC%', () => {
      expect(isLikeContains('%ABC%')).toBe(true);
      expect(isLikeContains("'%ABC%'")).toBe(true);
      expect(isLikeContains("'%A'BC%'")).toBe(true);

      expect(isLikeContains('ABC%')).toBe(false);
      expect(isLikeContains('')).toBe(false);
      expect(isLikeContains('%ABC')).toBe(false);
      expect(isLikeContains('A%BC')).toBe(false);
      expect(isLikeContains('A%BC%')).toBe(false);
    });

    it('addWildCardToValue() should clean value & add % in right place', () => {
      const rawValue = 'ABC';
      expect(
        addWildCardToValue(Soql.UiOperatorValue.LIKE_START, rawValue)
      ).toEqual('ABC%');
      expect(
        addWildCardToValue(Soql.UiOperatorValue.LIKE_END, rawValue)
      ).toEqual('%ABC');
      expect(
        addWildCardToValue(Soql.UiOperatorValue.LIKE_CONTAINS, rawValue)
      ).toEqual('%ABC%');
      expect(addWildCardToValue(Soql.UiOperatorValue.LIKE, rawValue)).toEqual(
        'ABC'
      );
      expect(addWildCardToValue(Soql.UiOperatorValue.EQ, rawValue)).toEqual(
        'ABC'
      );
      expect(
        addWildCardToValue(Soql.UiOperatorValue.LIKE_START, '%%A%%%BC')
      ).toEqual('A%%%BC%');
    });

    it('stripWildCardPadding() should remove any wildcards before the first non-wildcard char', () => {
      expect(stripWildCardPadding('abc')).toEqual('abc');
      expect(stripWildCardPadding('%%abc%%')).toEqual('abc');
      expect(stripWildCardPadding('%%abc%')).toEqual('abc');
      expect(stripWildCardPadding('abc%%%')).toEqual('abc');
      expect(stripWildCardPadding('a%bc%%')).toEqual('a%bc');
      expect(stripWildCardPadding('%bc%%100%%')).toEqual('bc%%100');
    });
  });
});
