/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

vi.mock('vscode', () => ({
  env: { language: 'en' },
  NotebookCellKind: { Markup: 1, Code: 2 },
  NotebookCellStatusBarAlignment: { Left: 1, Right: 2 },
  NotebookCellStatusBarItem: class {
    public command?: unknown;
    public tooltip?: string;
    public accessibilityInformation?: unknown;
    public priority?: number;
    constructor(
      public text: string,
      public alignment: number
    ) {}
  },
  NotebookCellOutput: class {
    constructor(
      public items: unknown[],
      public metadata?: unknown
    ) {}
  },
  NotebookCellOutputItem: {
    json: (data: unknown, mime: string) => ({ mime, data: new TextEncoder().encode(JSON.stringify(data)) })
  }
}));

import {
  cellHasStaleResults,
  cellOutputsNeedStaleFlag,
  createQueryPlanStatusBarItem,
  createStaleResultsStatusBarItem,
  createToolingApiStatusBarItem,
  outputsWithStaleFlag,
  queryPlanStatusBarText,
  SoqlCellOptionsStatusBarProvider,
  toolingStatusBarText
} from '../../src/toolingApiStatusBar';

describe('Tooling API cell status bar', () => {
  it('shows an unchecked Tooling checkbox for REST cells', () => {
    expect(toolingStatusBarText(false)).toBe('$(circle-large-outline) Tooling');

    const item = createToolingApiStatusBarItem({
      kind: 2,
      metadata: {}
    } as never);

    expect(item.text).toBe('$(circle-large-outline) Tooling');
    expect(item.command).toEqual(
      expect.objectContaining({
        command: 'salesforcedx-vscode-notebook.toggleToolingApi'
      })
    );
  });

  it('shows a checked Tooling checkbox when the cell uses Tooling API', () => {
    expect(toolingStatusBarText(true)).toBe('$(check) Tooling');
    expect(createToolingApiStatusBarItem({ kind: 2, metadata: { useToolingApi: true } } as never).text).toBe(
      '$(check) Tooling'
    );
  });

  it('shows an unchecked Query Plan checkbox by default', () => {
    expect(queryPlanStatusBarText(false)).toBe('$(circle-large-outline) Query Plan');
    expect(createQueryPlanStatusBarItem({ kind: 2, metadata: {} } as never).text).toBe(
      '$(circle-large-outline) Query Plan'
    );
  });

  it('shows a checked Query Plan checkbox when enabled', () => {
    expect(queryPlanStatusBarText(true)).toBe('$(check) Query Plan');
    expect(createQueryPlanStatusBarItem({ kind: 2, metadata: { includeQueryPlan: true } } as never).text).toBe(
      '$(check) Query Plan'
    );
  });

  it('detects stale results when the cell query no longer matches the stored query', () => {
    const cell = {
      document: { getText: () => 'SELECT Name FROM Account', languageId: 'soql' },
      outputs: [
        {
          items: [
            {
              data: new TextEncoder().encode(JSON.stringify({ queryText: 'SELECT Id FROM Account' }))
            }
          ]
        }
      ]
    };

    expect(cellHasStaleResults(cell as never)).toBe(true);
    expect(createStaleResultsStatusBarItem().text).toBe('Results out of date');
  });

  it('does not add SOQL-specific controls to anonymous Apex cells', () => {
    expect(
      new SoqlCellOptionsStatusBarProvider()
        .provideCellStatusBarItems({
          kind: 2,
        notebook: { notebookType: 'salesforce-notebook', uri: { toString: () => 'file:///apex.sfnb' } },
          document: { languageId: 'apex-anon' }
        } as never)
        ?.map(item => item.text)
    ).toEqual([]);
  });

  it('adds a stale status item when results no longer match the cell query', () => {
    const items = new SoqlCellOptionsStatusBarProvider().provideCellStatusBarItems({
      kind: 2,
      notebook: { notebookType: 'salesforce-notebook', uri: { toString: () => 'file:///query.sfnb' } },
      document: { getText: () => 'SELECT Name FROM Account', languageId: 'soql' },
      metadata: {},
      outputs: [
        {
          items: [
            {
              data: new TextEncoder().encode(JSON.stringify({ queryText: 'SELECT Id FROM Account' }))
            }
          ]
        }
      ]
    } as never);

    expect(items?.[0].text).toBe('Results out of date');
  });

  it('only flags query-bound outputs as needing a stale remount', () => {
    const cell = {
      kind: 2,
      document: { getText: () => 'SELECT Name FROM Account' },
      outputs: [
        {
          items: [
            {
              mime: 'application/vnd.salesforce.soql-query-result+json',
              data: new TextEncoder().encode(JSON.stringify({ queryText: 'SELECT Id FROM Account' }))
            },
            {
              mime: 'application/vnd.code.notebook.stderr',
              data: new TextEncoder().encode('ignored')
            }
          ]
        }
      ]
    };

    expect(cellOutputsNeedStaleFlag(cell as never)).toBe(true);
    expect(
      JSON.parse(
        new TextDecoder().decode(outputsWithStaleFlag(cell.outputs as never, true)[0].items[0].data as Uint8Array)
      )
    ).toEqual({
      queryText: 'SELECT Id FROM Account',
      stale: true
    });
  });
});
