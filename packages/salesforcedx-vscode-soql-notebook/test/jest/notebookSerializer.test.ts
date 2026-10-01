/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

jest.mock('vscode', () => ({
  env: { language: 'en' },
  NotebookCellKind: { Markup: 1, Code: 2 },
  NotebookCellData: class {
    public outputs?: unknown;
    public metadata?: unknown;
    constructor(
      public kind: number,
      public value: string,
      public languageId: string
    ) {}
  },
  NotebookData: class {
    constructor(public cells: unknown[]) {}
  },
  NotebookCellOutput: class {
    constructor(public items: unknown[]) {}
  },
  NotebookCellOutputItem: {
    json: (data: unknown, mime: string) => ({ mime, data: new TextEncoder().encode(JSON.stringify(data)) })
  }
}));

import type * as vscode from 'vscode';
import { createUntitledSoqlNotebookData } from '../../src/commands/createSoqlNotebook';
import { deserializeSoqlNotebook, serializeSoqlNotebook } from '../../src/notebookSerializer';

const MARKUP = 1;
const CODE = 2;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const notebookData = (cells: ReadonlyArray<Record<string, unknown>>): vscode.NotebookData =>
  ({ cells } as unknown as vscode.NotebookData);

describe('SOQL notebook serializer', () => {
  it('round-trips code and markup cells', () => {
    const original = notebookData([
      { kind: MARKUP, languageId: 'markdown', value: 'Choose a query.' },
      { kind: CODE, languageId: 'soql', value: 'SELECT Id FROM Account LIMIT 10' }
    ]);

    const result = deserializeSoqlNotebook(serializeSoqlNotebook(original));

    expect(result.cells).toEqual([
      expect.objectContaining({ kind: MARKUP, languageId: 'markdown', value: 'Choose a query.' }),
      expect.objectContaining({ kind: CODE, languageId: 'soql', value: 'SELECT Id FROM Account LIMIT 10' })
    ]);
  });

  it('round-trips an empty notebook', () => {
    expect(deserializeSoqlNotebook(serializeSoqlNotebook(notebookData([]))).cells).toEqual([]);
  });

  it('deserializes an empty file to an empty notebook', () => {
    expect(deserializeSoqlNotebook(new Uint8Array()).cells).toEqual([]);
    expect(deserializeSoqlNotebook(encoder.encode('  \n\t')).cells).toEqual([]);
  });

  it('preserves unicode and newlines through a round trip', () => {
    const value = 'Accounts 🌎\nSELECT Name\nFROM Account';
    const result = deserializeSoqlNotebook(
      serializeSoqlNotebook(notebookData([{ kind: CODE, languageId: 'soql', value }]))
    );

    expect(result.cells[0].value).toBe(value);
  });

  it('persists query-result outputs and restores them', () => {
    const queryResult = {
      totalSize: 1,
      done: true,
      records: [{ Id: '001' }],
      queryText: 'SELECT Id FROM Account',
      columnData: {
        objectName: 'Account',
        columns: [{ title: 'Id', fieldHelper: ['Id'] }],
        subTables: []
      }
    };
    const original = notebookData([
      {
        kind: CODE,
        languageId: 'soql',
        value: 'SELECT Id FROM Account',
        outputs: [
          {
            items: [
              {
                mime: 'application/vnd.salesforce.soql-query-result+json',
                data: encoder.encode(JSON.stringify(queryResult))
              }
            ]
          }
        ],
        executionSummary: { executionOrder: 7 }
      }
    ]);

    const serialized = serializeSoqlNotebook(original);
    expect(JSON.parse(decoder.decode(serialized))).toEqual({
      version: 1,
      cells: [
        {
          kind: 'code',
          language: 'soql',
          value: 'SELECT Id FROM Account',
          outputs: [{ mime: 'application/vnd.salesforce.soql-query-result+json', data: queryResult }]
        }
      ]
    });

    const restored = deserializeSoqlNotebook(serialized);
    expect(restored.cells[0].outputs).toEqual([
      {
        items: [
          {
            mime: 'application/vnd.salesforce.soql-query-result+json',
            data: encoder.encode(JSON.stringify(queryResult))
          }
        ]
      }
    ]);
  });

  it('persists and restores the Tooling API cell flag', () => {
    const original = notebookData([
      {
        kind: CODE,
        languageId: 'soql',
        value: 'SELECT Id FROM ApexClass',
        metadata: { useToolingApi: true }
      }
    ]);

    const serialized = serializeSoqlNotebook(original);
    expect(JSON.parse(decoder.decode(serialized))).toEqual({
      version: 1,
      cells: [{ kind: 'code', language: 'soql', value: 'SELECT Id FROM ApexClass', useToolingApi: true }]
    });

    expect(deserializeSoqlNotebook(serialized).cells[0].metadata).toEqual({ useToolingApi: true });
  });

  it('persists query-plan outputs and the Query Plan cell flag', () => {
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
    const original = notebookData([
      {
        kind: CODE,
        languageId: 'soql',
        value: 'SELECT Id FROM Account',
        metadata: { includeQueryPlan: true },
        outputs: [
          {
            items: [
              {
                mime: 'application/vnd.salesforce.soql-query-plan+json',
                data: encoder.encode(JSON.stringify(queryPlan))
              }
            ]
          }
        ]
      }
    ]);

    const serialized = serializeSoqlNotebook(original);
    expect(JSON.parse(decoder.decode(serialized))).toEqual({
      version: 1,
      cells: [
        {
          kind: 'code',
          language: 'soql',
          value: 'SELECT Id FROM Account',
          includeQueryPlan: true,
          outputs: [{ mime: 'application/vnd.salesforce.soql-query-plan+json', data: queryPlan }]
        }
      ]
    });
    expect(deserializeSoqlNotebook(serialized).cells[0].metadata).toEqual({ includeQueryPlan: true });
  });

  it('persists last edited and last run timestamps', () => {
    const original = notebookData([
      {
        kind: CODE,
        languageId: 'soql',
        value: 'SELECT Id FROM Account',
        metadata: { lastEditedAt: 11, lastRunAt: 22 }
      }
    ]);

    const serialized = serializeSoqlNotebook(original);
    expect(JSON.parse(decoder.decode(serialized)).cells[0]).toEqual({
      kind: 'code',
      language: 'soql',
      value: 'SELECT Id FROM Account',
      lastEditedAt: 11,
      lastRunAt: 22
    });
    expect(deserializeSoqlNotebook(serialized).cells[0].metadata).toEqual({ lastEditedAt: 11, lastRunAt: 22 });
  });

  it('does not persist the live stale flag on query outputs', () => {
    const queryResult = {
      totalSize: 1,
      done: true,
      records: [{ Id: '001' }],
      queryText: 'SELECT Id FROM Account',
      stale: true,
      columnData: {
        objectName: 'Account',
        columns: [{ title: 'Id', fieldHelper: ['Id'] }],
        subTables: []
      }
    };
    const serialized = serializeSoqlNotebook(
      notebookData([
        {
          kind: CODE,
          languageId: 'soql',
          value: 'SELECT Name FROM Account',
          outputs: [
            {
              items: [
                {
                  mime: 'application/vnd.salesforce.soql-query-result+json',
                  data: encoder.encode(JSON.stringify(queryResult))
                }
              ]
            }
          ]
        }
      ])
    );

    expect(JSON.parse(decoder.decode(serialized)).cells[0].outputs[0].data.stale).toBeUndefined();
  });

  it('does not persist error outputs or execution order', () => {
    const serialized = serializeSoqlNotebook(
      notebookData([
        {
          kind: CODE,
          languageId: 'soql',
          value: 'SELECT Id FROM Account',
          outputs: [{ items: [{ mime: 'application/vnd.code.notebook.error', data: encoder.encode('boom') }] }],
          executionSummary: { executionOrder: 7 }
        }
      ])
    );

    expect(JSON.parse(decoder.decode(serialized))).toEqual({
      version: 1,
      cells: [{ kind: 'code', language: 'soql', value: 'SELECT Id FROM Account' }]
    });
  });

  it('throws for invalid JSON', () => {
    expect(() => deserializeSoqlNotebook(encoder.encode('{invalid'))).toThrow('Invalid SOQL notebook JSON');
  });

  it('throws for an unknown version', () => {
    expect(() => deserializeSoqlNotebook(encoder.encode('{"version":2,"cells":[]}'))).toThrow(
      'Unsupported SOQL notebook version: 2'
    );
  });

  it('throws for a missing version', () => {
    expect(() => deserializeSoqlNotebook(encoder.encode('{"cells":[]}'))).toThrow(
      'SOQL notebook version is required'
    );
  });

  it('throws for an unknown cell kind', () => {
    expect(() =>
      deserializeSoqlNotebook(
        encoder.encode('{"version":1,"cells":[{"kind":"raw","language":"text","value":"hi"}]}')
      )
    ).toThrow('Unknown SOQL notebook cell kind: raw');
  });
});

describe('create SOQL notebook command', () => {
  it('creates introductory markup and an empty SOQL cell', () => {
    expect(createUntitledSoqlNotebookData().cells).toEqual([
      expect.objectContaining({
        kind: MARKUP,
        languageId: 'markdown',
        value:
          'Run each SOQL cell against the default org. Use the Tooling and Query Plan checkboxes under a cell to choose extras.'
      }),
      expect.objectContaining({ kind: CODE, languageId: 'soql', value: '' })
    ]);
  });
});
