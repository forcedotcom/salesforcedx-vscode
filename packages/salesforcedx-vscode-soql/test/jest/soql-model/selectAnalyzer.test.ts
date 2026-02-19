/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ColumnData, SelectAnalyzer, Selection } from '../../../src/soql-model/analyzers/selectAnalyzer';

describe('SelectAnalyzer should', () => {
  const simpleA: Selection = {
    selectionQueryText: 'A',
    queryResultsPath: ['A'],
    objectName: 'X',
    columnName: 'A',
    isSubQuerySelection: false,
  };
  const simpleAColumn = { title: simpleA.columnName, fieldHelper: simpleA.queryResultsPath };
  const simpleB: Selection = {
    selectionQueryText: 'B',
    queryResultsPath: ['B'],
    objectName: 'X',
    columnName: 'B',
    isSubQuerySelection: false,
  };
  const simpleBColumn = { title: simpleB.columnName, fieldHelper: simpleB.queryResultsPath };
  const simpleColumnData: ColumnData = {
    objectName: 'X',
    columns: [simpleAColumn, simpleBColumn],
    subTables: [],
  };
  const innerA: Selection = {
    selectionQueryText: 'A',
    queryResultsPath: ['A'],
    objectName: 'Y',
    columnName: 'Y.A',
    isSubQuerySelection: true,
  };
  const innerAColumn = { title: innerA.columnName, fieldHelper: innerA.queryResultsPath };
  const innerB: Selection = {
    selectionQueryText: 'B',
    queryResultsPath: ['B'],
    objectName: 'Y',
    columnName: 'Y.B',
    isSubQuerySelection: true,
  };
  const innerBColumn = { title: innerB.columnName, fieldHelper: innerB.queryResultsPath };
  const innerColumnData = {
    objectName: 'X',
    columns: [simpleAColumn, simpleBColumn],
    subTables: [
      {
        objectName: 'Y',
        columns: [innerAColumn, innerBColumn],
        subTables: [],
      },
    ],
  };
  const parentRelationshipCD: Selection = {
    selectionQueryText: 'C.D',
    queryResultsPath: ['C', 'D'],
    objectName: 'X',
    columnName: 'C.D',
    isSubQuerySelection: false,
  };
  const parentRelationshipColumn = {
    title: parentRelationshipCD.columnName,
    fieldHelper: parentRelationshipCD.queryResultsPath,
  };
  const parentRelationshipColumnData = {
    objectName: 'X',
    columns: [parentRelationshipColumn],
    subTables: [],
  };
  const minE: Selection = {
    selectionQueryText: 'MIN(E)',
    queryResultsPath: ['expr0'],
    objectName: 'X',
    columnName: 'MIN(E)',
    isSubQuerySelection: false,
  };
  const minEColumn = { title: minE.columnName, fieldHelper: minE.queryResultsPath };
  const maxE: Selection = {
    selectionQueryText: 'MAX(E)',
    queryResultsPath: ['expr1'],
    objectName: 'X',
    columnName: 'MAX(E)',
    isSubQuerySelection: false,
  };
  const maxEColumn = { title: maxE.columnName, fieldHelper: maxE.queryResultsPath };
  const functionColumnData = {
    objectName: 'X',
    columns: [simpleAColumn, minEColumn, maxEColumn],
    subTables: [],
  };
  const alias: Selection = {
    selectionQueryText: 'MIN(E)',
    queryResultsPath: ['MIN'],
    objectName: 'X',
    columnName: 'MIN',
    isSubQuerySelection: false,
  };
  const aliasColumn = { title: alias.columnName, fieldHelper: alias.queryResultsPath };
  const aliasColumnData = {
    objectName: 'X',
    columns: [aliasColumn],
    subTables: [],
  };

  it('identify simple selections', () => {
    const analyzer = new SelectAnalyzer('SELECT A, B FROM X');
    expect(analyzer.getSelections()).toEqual([simpleA, simpleB]);
    expect(analyzer.getColumnData()).toEqual(simpleColumnData);
  });

  it('identify related selections', () => {
    const analyzer = new SelectAnalyzer('SELECT C.D FROM X');
    expect(analyzer.getSelections()).toEqual([parentRelationshipCD]);
    expect(analyzer.getColumnData()).toEqual(parentRelationshipColumnData);
  });

  it('identify inner query selections', () => {
    const analyzer = new SelectAnalyzer('SELECT A, B, (SELECT A, B FROM Y) FROM X');
    expect(analyzer.getSelections()).toEqual([simpleA, simpleB, innerA, innerB]);
    expect(analyzer.getColumnData()).toEqual(innerColumnData);
  });

  it('identify aggregate function selections', () => {
    const analyzer = new SelectAnalyzer('SELECT A, MIN(E), MAX(E) FROM X GROUP BY A');
    expect(analyzer.getSelections()).toEqual([simpleA, minE, maxE]);
    expect(analyzer.getColumnData()).toEqual(functionColumnData);
  });

  it('identify aliased selections', () => {
    const expected = [alias];
    const actual = new SelectAnalyzer('SELECT MIN(E) MIN FROM X').getSelections();
    expect(actual).toEqual(expected);
    const analyzer = new SelectAnalyzer('SELECT MIN(E) MIN FROM X');
    expect(analyzer.getSelections()).toEqual([alias]);
    expect(analyzer.getColumnData()).toEqual(aliasColumnData);
  });
});
