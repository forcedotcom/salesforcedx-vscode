/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import tabulatorCss from './tabulator.min.css';
import rendererCss from './queryResultRenderer.css';
import Tabulator from './tabulator.min.js';
import { queryPlanColumns, toQueryPlanTableRows } from '../queryPlanView';
import { getColumns } from '../queryResultColumns';
import { measuredTableHeight, TABLE_MAX_HEIGHT_PX } from '../tableHeight';

const ensureRendererStyles = () => {
  if (document.getElementById('soql-notebook-renderer-styles')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'soql-notebook-renderer-styles';
  style.textContent = `${tabulatorCss}\n${rendererCss}`;
  document.head.appendChild(style);
};

const measureElementHeight = element => {
  if (!element) {
    return 0;
  }
  return Math.max(element.offsetHeight, element.scrollHeight);
};

const fitTableHeight = table => {
  const root = table.element;
  const headerHeight = measureElementHeight(root.querySelector('.tabulator-header'));
  const rowsHeight = measureElementHeight(root.querySelector('.tabulator-tableHolder .tabulator-table'));
  const footer = root.querySelector('.tabulator-footer');
  const footerVisible = footer && getComputedStyle(footer).display !== 'none';
  const footerHeight = footerVisible ? measureElementHeight(footer) : 0;
  table.setHeight(`${measuredTableHeight({ headerHeight, rowsHeight, footerHeight })}px`);
};

const renderNestedTables = (row, columnData) => {
  if (!columnData || !Array.isArray(columnData.subTables)) {
    return;
  }
  columnData.subTables.forEach(subTable => {
    const key = Object.keys(row.getData()).find(k => k.toLowerCase() === subTable.objectName.toLowerCase());
    if (!key || !row.getData()[key]) {
      return;
    }
    const data = row.getData()[key];
    const holderEl = document.createElement('div');
    const tableEl = document.createElement('div');
    holderEl.style.boxSizing = 'border-box';
    holderEl.style.padding = '10px 30px 10px 10px';
    holderEl.style.borderTop = '1px solid #333';
    holderEl.style.background = '#ddd';
    tableEl.style.border = '1px solid #333';
    holderEl.appendChild(tableEl);
    row.getElement().appendChild(holderEl);
    new Tabulator(tableEl, {
      layout: 'fitColumns',
      virtualDom: false,
      data: data.records,
      columns: getColumns(data, subTable)
    });
  });
};

export const activate = () => ({
  renderOutputItem(outputItem, element) {
    ensureRendererStyles();
    const payload = outputItem.json();
    element.replaceChildren();
    const tableHost = document.createElement('div');
    tableHost.className = 'soql-notebook-table';
    element.appendChild(tableHost);

    if (!payload) {
      tableHost.textContent = 'Unable to render SOQL results.';
      return;
    }

    if (typeof payload.success === 'boolean' && typeof payload.compiled === 'boolean') {
      const message = payload.success
        ? 'Anonymous Apex executed successfully.'
        : !payload.compiled
          ? `Compile error at line ${payload.line}, column ${payload.column}: ${payload.compileProblem ?? 'Unknown error'}`
          : `Runtime error: ${payload.exceptionMessage ?? 'Unknown error'}${payload.exceptionStackTrace ? `\n${payload.exceptionStackTrace}` : ''}`;
      tableHost.textContent = message;
      return;
    }

    if (typeof Tabulator !== 'function') {
      tableHost.textContent = 'Unable to render SOQL results.';
      return;
    }

    if (payload.stale === true) {
      tableHost.classList.add('soql-notebook-table--stale');
      const banner = document.createElement('div');
      banner.className = 'soql-notebook-stale-banner';
      banner.textContent = 'Results out of date';
      element.insertBefore(banner, tableHost);
    }

    const isQueryPlan = Array.isArray(payload.plans);
    const rows = isQueryPlan ? toQueryPlanTableRows(payload) : payload.records;
    if (!Array.isArray(rows)) {
      tableHost.textContent = 'Unable to render SOQL results.';
      return;
    }

    const paginated = rows.length > 20;
    if (paginated) {
      tableHost.dataset.paginated = 'true';
    }
    const table = new Tabulator(tableHost, {
      data: rows,
      pagination: paginated ? 'local' : false,
      paginationSize: 20,
      layout: 'fitDataStretch',
      height: paginated ? `${TABLE_MAX_HEIGHT_PX}px` : undefined,
      virtualDom: false,
      columns: isQueryPlan ? queryPlanColumns : getColumns(payload, payload.columnData),
      rowFormatter: row => (isQueryPlan ? undefined : renderNestedTables(row, payload.columnData))
    });
    if (!paginated) {
      table.redraw(true);
      fitTableHeight(table);
    }
  }
});
