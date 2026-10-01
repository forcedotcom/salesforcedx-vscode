/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

jest.mock('vscode', () => ({
  env: { language: 'en' }
}));

import {
  CellExecutionLike,
  CellLike,
  executeSoqlNotebookCell,
  shouldExecuteCell
} from '../../src/notebookController';

const queryPayload = {
  totalSize: 1,
  done: true,
  records: [{ Id: '001000000000001' }]
};

const codeCell = (text = 'SELECT Id FROM Account'): CellLike => ({
  document: { getText: () => text },
  kind: 2,
  documentLanguageId: 'soql'
});

const setup = () => {
  const events: string[] = [];
  const execution: CellExecutionLike = {
    start: jest.fn(() => events.push('start')),
    end: jest.fn(success => events.push(`end:${String(success)}`)),
    replaceOutput: jest.fn(() => {
      events.push('replaceOutput');
    }),
    token: { isCancellationRequested: false }
  };
  const runQuery = jest.fn().mockResolvedValue(queryPayload);

  return {
    deps: {
      runQuery,
      createExecution: jest.fn().mockReturnValue(execution)
    },
    events,
    execution,
    runQuery
  };
};

describe('SOQL notebook cell execution', () => {
  it('writes an error output for an empty cell and ends unsuccessfully', async () => {
    const emptyQueryError = new Error('SOQL cell is empty.');
    const { deps, events, execution, runQuery } = setup();
    runQuery.mockRejectedValue(emptyQueryError);

    await executeSoqlNotebookCell(codeCell(''), deps);

    expect(runQuery).toHaveBeenCalledWith('', 'rest');
    expect(execution.replaceOutput).toHaveBeenCalledWith({
      items: [{ mime: 'application/vnd.code.notebook.stderr', text: emptyQueryError.message }]
    });
    expect(execution.end).toHaveBeenCalledWith(false);
    expect(events).toEqual(['start', 'replaceOutput', 'end:false']);
  });

  it('writes JSON and record status outputs for a successful query', async () => {
    const { deps, execution } = setup();

    await executeSoqlNotebookCell(codeCell(), deps);

    expect(execution.replaceOutput).toHaveBeenCalledWith([
      {
        items: [
          {
            mime: 'application/vnd.salesforce.soql-query-result+json',
            data: {
              ...queryPayload,
              queryText: 'SELECT Id FROM Account',
              columnData: {
                objectName: 'Account',
                columns: [{ title: 'Id', fieldHelper: ['Id'] }],
                subTables: []
              }
            }
          }
        ]
      }
    ]);
    expect(execution.end).toHaveBeenCalledWith(true);
  });

  it('writes an error output when the query rejects', async () => {
    const queryError = new Error('No default org');
    const { deps, execution, runQuery } = setup();
    runQuery.mockRejectedValue(queryError);

    await executeSoqlNotebookCell(codeCell(), deps);

    expect(execution.replaceOutput).toHaveBeenCalledWith({
      items: [{ mime: 'application/vnd.code.notebook.stderr', text: queryError.message }]
    });
    expect(execution.end).toHaveBeenCalledWith(false);
  });

  it('does not run or replace output when already cancelled', async () => {
    const { deps, execution, runQuery } = setup();
    execution.token.isCancellationRequested = true;

    await executeSoqlNotebookCell(codeCell(), deps);

    expect(runQuery).not.toHaveBeenCalled();
    expect(execution.replaceOutput).not.toHaveBeenCalled();
    expect(execution.end).toHaveBeenCalledWith(false);
  });

  it('does not replace output when cancelled while the query runs', async () => {
    const { deps, execution, runQuery } = setup();
    runQuery.mockImplementation(() => {
      execution.token.isCancellationRequested = true;
      return Promise.resolve(queryPayload);
    });

    await executeSoqlNotebookCell(codeCell(), deps);

    expect(execution.replaceOutput).not.toHaveBeenCalled();
    expect(execution.end).toHaveBeenCalledWith(false);
  });

  it('ends exactly once on success', async () => {
    const { deps, execution } = setup();

    await executeSoqlNotebookCell(codeCell(), deps);

    expect(execution.end).toHaveBeenCalledTimes(1);
  });

  it('ends exactly once on failure', async () => {
    const { deps, execution, runQuery } = setup();
    runQuery.mockRejectedValue(new Error('query failed'));

    await executeSoqlNotebookCell(codeCell(), deps);

    expect(execution.end).toHaveBeenCalledTimes(1);
  });

  it('runs a Tooling API cell against the tooling query path', async () => {
    const { deps, runQuery } = setup();

    await executeSoqlNotebookCell({ ...codeCell('SELECT Id FROM ApexClass'), useToolingApi: true }, deps);

    expect(runQuery).toHaveBeenCalledWith('SELECT Id FROM ApexClass', 'tooling');
  });

  it('adds a query-plan output when the cell requests it', async () => {
    const { deps, execution } = setup();
    const queryPlan = {
      queryText: 'SELECT Id FROM Account',
      plans: [
        {
          cardinality: 1,
          fields: ['Id'],
          leadingOperationType: 'Index',
          notes: [],
          relativeCost: 0.1,
          sobjectCardinality: 2,
          sobjectType: 'Account'
        }
      ]
    };
    const runQueryPlan = jest.fn().mockResolvedValue(queryPlan);
    const clearQueryPlanRequest = jest.fn();
    await executeSoqlNotebookCell(
      { ...codeCell(), includeQueryPlan: true },
      { ...deps, runQueryPlan, clearQueryPlanRequest }
    );

    expect(runQueryPlan).toHaveBeenCalledWith('SELECT Id FROM Account');
    expect(clearQueryPlanRequest).toHaveBeenCalled();
    expect(execution.replaceOutput).toHaveBeenCalledWith([
      {
        items: [
          {
            mime: 'application/vnd.salesforce.soql-query-result+json',
            data: expect.objectContaining({ queryText: 'SELECT Id FROM Account' })
          }
        ]
      },
      {
        items: [{ mime: 'application/vnd.salesforce.soql-query-plan+json', data: queryPlan }]
      }
    ]);
  });
});

describe('SOQL notebook cell filtering', () => {
  it.each([
    { kind: 1, documentLanguageId: 'markdown' },
    { kind: 2, documentLanguageId: 'markdown' }
  ])('skips non-SOQL cell %#', cell => {
    expect(shouldExecuteCell({ ...cell, document: { getText: () => 'Not SOQL' } })).toBe(false);
  });

  it('executes a SOQL code cell', () => {
    expect(shouldExecuteCell(codeCell())).toBe(true);
  });
});
