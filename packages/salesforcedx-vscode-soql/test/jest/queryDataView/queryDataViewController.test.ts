/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

type TableOptions = {
  data: unknown[];
  pagination: string;
  paginationSize: number;
  layout: string;
  height: string;
  virtualDom: boolean;
  columns: Array<{
    title: string;
    field?: string;
    columns?: TableOptions['columns'];
    formatter?: (cell: { getRow: () => { getData: () => Record<string, unknown> } }) => string;
  }>;
};

class FakeTabulator {
  public static readonly instances: FakeTabulator[] = [];

  public readonly destroy = jest.fn();
  public readonly redraw = jest.fn();
  public readonly setHeight = jest.fn();

  constructor(
    public readonly target: string | HTMLElement,
    public readonly options: TableOptions
  ) {
    FakeTabulator.instances.push(this);
  }
}

describe('Query Data View controller baseline', () => {
  const getState = jest.fn();
  const setState = jest.fn();
  const postMessage = jest.fn();

  beforeEach(() => {
    FakeTabulator.instances.length = 0;
    document.body.innerHTML = `
      <div>
        <header>
          <h3 id="webview-title"></h3>
          <span id="total-records-size"></span>
          <span id="max-rows-hint" hidden><span class="info-tooltip__text"></span></span>
          <button id="save-csv-button">.csv</button>
          <button id="save-json-button">.json</button>
        </header>
        <div id="data-table"></div>
      </div>`;

    getState.mockReturnValue({
      documentName: 'restored.soql',
      data: {
        done: true,
        totalSize: 52,
        records: Array.from({ length: 51 }, (_, index) => ({ Id: String(index + 1).padStart(3, '0') })),
        flattenedGrid: {
          fields: ['Id', 'Owner', 'Owner.Name', 'Owner.Email'],
          rowData: Array.from({ length: 51 }, (_, index) => ({
            Id: String(index + 1).padStart(3, '0'),
            'Owner.Name': index === 0 ? 'Ada' : 'Grace',
            'Owner.Email': index === 0 ? null : 'owner@example.com'
          }))
        },
        columnData: { columns: [], subTables: [] }
      }
    });

    Object.defineProperty(globalThis, 'acquireVsCodeApi', {
      configurable: true,
      value: () => ({ getState, setState, postMessage })
    });
    Object.defineProperty(globalThis, 'Tabulator', {
      configurable: true,
      value: FakeTabulator
    });

    jest.requireActual('../../../src/soql-data-view/queryDataViewController.js');
  });

  it('restores, renders, updates, exports, and resizes through the existing protocol', () => {
    expect(getState).toHaveBeenCalledTimes(1);
    expect(document.getElementById('webview-title')?.innerText).toBe('restored.soql');
    expect(document.getElementById('total-records-size')?.innerText).toBe('Returned 51 of 52 total records');
    expect(document.getElementById('max-rows-hint')?.hasAttribute('hidden')).toBe(false);
    expect((document.querySelector('.info-tooltip__text') as HTMLElement | null)?.innerText).toContain(
      'Max Query Limit'
    );
    expect(postMessage).toHaveBeenCalledWith({ type: 'activate' });

    const restoredTable = FakeTabulator.instances[0];
    expect(restoredTable.target).toBe('#data-table');
    expect(restoredTable.options).toMatchObject({
      pagination: 'local',
      paginationSize: 50,
      layout: 'fitColumns',
      height: '100%',
      virtualDom: false
    });
    expect(restoredTable.options.columns).toHaveLength(2);
    expect(restoredTable.options.columns[0]).toMatchObject({ title: 'Id', field: 'Id' });
    expect(restoredTable.options.columns[1]).toMatchObject({
      title: 'Owner',
      columns: [
        { title: 'Name', field: 'Owner.Name' },
        { title: 'Email', field: 'Owner.Email' }
      ]
    });
    expect(
      restoredTable.options.columns[1].columns?.[1].formatter?.({
        getRow: () => ({ getData: () => ({ 'Owner.Email': null }) })
      })
    ).toBe('');

    const updatedData = {
      done: true,
      totalSize: 1,
      records: [{ ID: '003', NAME: 'Katherine' }],
      columnData: {
        columns: [
          { title: 'Id', fieldHelper: ['id'] },
          { title: 'Name', fieldHelper: ['name'] }
        ],
        subTables: []
      }
    };
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'update', data: updatedData, documentName: 'updated.soql' }
      })
    );

    expect(restoredTable.destroy).toHaveBeenCalledTimes(1);
    expect(document.getElementById('webview-title')?.innerText).toBe('updated.soql');
    expect(document.getElementById('total-records-size')?.innerText).toBe('Returned 1 of 1 total records');
    expect(document.getElementById('max-rows-hint')?.hasAttribute('hidden')).toBe(true);
    expect(setState).toHaveBeenCalledWith({ data: updatedData, documentName: 'updated.soql' });
    expect(FakeTabulator.instances[1].options.columns).toEqual([
      { title: 'Id', field: 'ID' },
      { title: 'Name', field: 'NAME' }
    ]);

    const emptyData = {
      done: true,
      totalSize: 0,
      records: [],
      columnData: { columns: [{ title: 'Id', fieldHelper: ['Id'] }], subTables: [] }
    };
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'update', data: emptyData, documentName: 'empty.soql' }
      })
    );
    expect(FakeTabulator.instances[1].destroy).toHaveBeenCalledTimes(1);
    expect(FakeTabulator.instances[2].options.columns).toEqual([]);

    document.getElementById('save-csv-button')?.click();
    document.getElementById('save-json-button')?.click();
    expect(postMessage).toHaveBeenCalledWith({ type: 'save_records', format: 'csv' });
    expect(postMessage).toHaveBeenCalledWith({ type: 'save_records', format: 'json' });

    window.dispatchEvent(new Event('resize'));
    expect(FakeTabulator.instances[2].setHeight).toHaveBeenCalled();
    expect(FakeTabulator.instances[2].redraw).toHaveBeenCalledWith(true);
  });
});
