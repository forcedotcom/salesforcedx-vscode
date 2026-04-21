/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

(function () {
  /* interface queryData {
      done: boolean;
      nextRecordsUrl?: string;
      totalSize: number;
      records: T[];
    } */
  const FileType = {
    JSON: 'json',
    CSV: 'csv'
  };
  const vscode = acquireVsCodeApi();

  /** @type {any} */
  // Must be declared before `loadState()` runs: function declarations are hoisted,
  // but `let` bindings stay in the TDZ until this line executes. `renderTableWith`
  // reads `mainTable`, so calling it before this declaration throws ReferenceError,
  // which aborts the rest of the IIFE (message listeners, save-button handlers,
  // and the `activate` postMessage all fail to register).
  let mainTable;

  // load previous state if webview was moved from background.
  function loadState() {
    const state = vscode.getState();
    if (state) {
      updateUIWith(state.data, state.documentName);
    }
  }

  function adjustContainerHeight() {
    var tEl = document.querySelector('#data-table');
    if (!tEl || !mainTable) {
      return;
    }
    var pageHeader = document.querySelector('header');
    var pageHeaderH = pageHeader ? pageHeader.offsetHeight : 0;
    var colHeaderEl = tEl.querySelector('.tabulator-header');
    var colHeaderH = colHeaderEl ? Math.max(colHeaderEl.offsetHeight, colHeaderEl.scrollHeight) : 0;
    var rowsH = (tEl.querySelector('.tabulator-tableHolder .tabulator-table') || {}).offsetHeight || 0;
    var footerH = (tEl.querySelector('.tabulator-footer') || {}).offsetHeight || 0;
    var tableHolder = tEl.querySelector('.tabulator-tableHolder');
    var hScrollbarH = tableHolder ? Math.max(0, tableHolder.offsetHeight - tableHolder.clientHeight) : 0;
    var contentH = colHeaderH + rowsH + hScrollbarH + footerH + 2;
    var maxH = window.innerHeight - pageHeaderH - 20;
    var container = document.querySelector('body > div');
    if (!container) {
      return;
    }
    if (contentH < maxH) {
      // Small table: shrink container to exact content height, no gray space
      container.style.setProperty('--soql-table-height', pageHeaderH + contentH + 'px');
      mainTable.setHeight(contentH + 'px');
    } else {
      // Large table: let CSS fill the full available height reliably
      container.style.setProperty('--soql-table-height', 'calc(100% - 20px)');
      mainTable.setHeight('100%');
    }
    // After height is set, the vertical scrollbar may have appeared, reducing
    // the available width. Redraw forces fitColumns to recalculate column
    // widths accounting for the scrollbar, preventing a spurious horizontal
    // scrollbar.
    mainTable.redraw(true);
  }

  // ---- RENDER THE WEBVIEW CONTENT ---- //

  function updateUIWith(queryData, documentName) {
    // Display the .soql file name as the title
    const titleEl = document.getElementById('webview-title');
    titleEl.innerText = documentName;
    // Display the total number of records returned from the query
    const totalRecordsSizeEl = document.getElementById('total-records-size');
    totalRecordsSizeEl.innerText = `Returned ${queryData.records.length} of ${queryData.totalSize} total records`; // TODO: i18n

    renderTableWith(queryData);
  }

  function renderTableWith(tableData) {
    if (mainTable) {
      mainTable.destroy();
      mainTable = undefined;
    }

    var fg = tableData.flattenedGrid;
    if (fg && Array.isArray(fg.fields) && fg.fields.length > 0 && Array.isArray(fg.rowData)) {
      mainTable = new Tabulator('#data-table', {
        data: fg.rowData,
        pagination: 'local',
        paginationSize: 50,
        layout: 'fitColumns',
        height: '100%',
        virtualDom: false,
        columns: getFlattenedGridColumns(fg.fields)
      });
      adjustContainerHeight();
      return;
    }

    mainTable = new Tabulator('#data-table', {
      data: tableData.records,
      pagination: 'local',
      paginationSize: 50,
      layout: 'fitColumns',
      height: '100%',
      virtualDom: false,
      columns: getColumns(tableData, tableData.columnData),
      rowFormatter: row => {
        tableData.columnData.subTables.forEach(subTable => {
          const key = Object.keys(row.getData()).find(k => k.toLowerCase() === subTable.objectName.toLowerCase());
          if (key && row.getData()[key]) {
            var data = row.getData()[key];
            var holderEl = document.createElement('div');
            var tableEl = document.createElement('div');

            holderEl.style.boxSizing = 'border-box';
            holderEl.style.padding = '10px 30px 10px 10px';
            holderEl.style.borderTop = '1px solid #333';
            holderEl.style.borderBotom = '1px solid #333';
            holderEl.style.background = '#ddd';

            tableEl.style.border = '1px solid #333';

            holderEl.appendChild(tableEl);

            row.getElement().appendChild(holderEl);

            try {
              new Tabulator(tableEl, {
                layout: 'fitColumns',
                virtualDom: false,
                data: data.records,
                columns: getColumns(data, subTable)
              });
            } catch (e) {
              console.error('SOQL nested Tabulator failed', e);
            }
          }
        });
      }
    });
    adjustContainerHeight();
  }

  function getFlattenedGridColumns(fields) {
    var filteredFields = fields.filter(function (fieldName) {
      return !fields.some(function (candidate) {
        return candidate !== fieldName && candidate.indexOf(fieldName + '.') === 0;
      });
    });
    var root = { groups: {}, leaves: [] };

    filteredFields.forEach(function (fieldName) {
      var parts = fieldName.split('.');
      if (parts.length < 2) {
        root.leaves.push({ title: fieldName, field: fieldName });
        return;
      }

      var current = root;
      for (var i = 0; i < parts.length - 1; i++) {
        var segment = parts[i];
        if (!current.groups[segment]) {
          current.groups[segment] = { groups: {}, leaves: [] };
        }
        current = current.groups[segment];
      }
      var leafTitle = parts[parts.length - 1];
      current.leaves.push(createFlattenedLeafColumn(fieldName, leafTitle));
    });

    return buildGroupedColumns(root);
  }

  function buildGroupedColumns(node) {
    var columns = node.leaves.slice();
    Object.keys(node.groups).forEach(function (groupTitle) {
      columns.push({
        title: groupTitle,
        columns: buildGroupedColumns(node.groups[groupTitle])
      });
    });
    return columns;
  }

  function createFlattenedLeafColumn(fieldName, title) {
    // Tabulator (v4.x) treats dots in `field` as nested paths (row.Contacts.Id).
    // Flattened SOQL rows use one object key per column, e.g. row["Contacts.Id"].
    return {
      title: title,
      field: fieldName,
      formatter: function (cell) {
        var v = cell.getRow().getData()[fieldName];
        return v === undefined || v === null ? '' : String(v);
      }
    };
  }

  // getColumns uses ColumnData to match QueryResult fields to columns.
  // The columnData object contains metadata about the columns of a
  // given SELECT clause and is defined as follows:
  //    export interface ColumnData {
  //      objectName: string;
  //      columns: Column[];
  //      subTables: ColumnData[];
  //    }
  //    export interface Column {
  //      title: string;
  //      fieldHelper: string[];
  //    }
  // The Column.fieldHelper property contains the expected field path in
  // the QueryResult object, but since the column data metadata is calculated
  // by analyzing the text of the (case insensitive) SELECT statement, so
  // the expected field path may not match that in the actual QueryResult
  // object.

  function getColumns(obj, columnData) {
    var columns = [];
    var record = obj.records && obj.records.length ? obj.records[0] : undefined;
    if (record) {
      columnData.columns.forEach(col => {
        let field = '';
        let currentObject = record;
        col.fieldHelper.forEach(segment => {
          var key = Object.keys(currentObject).find(k => k.toLowerCase() === segment.toLowerCase());
          if (key) {
            field = field.length === 0 ? key : field + '.' + key;
            currentObject = currentObject[key];
          }
        });
        columns.push({
          title: col.title,
          field
        });
      });
    }
    return columns;
  }

  // ---- EVENT LISTENERS ---- //

  const saveCsvButtonEl = document.getElementById('save-csv-button');
  saveCsvButtonEl.addEventListener('click', () => {
    vscode.postMessage({
      type: 'save_records',
      format: FileType.CSV
    });
  });

  const saveJsonButtonEl = document.getElementById('save-json-button');
  saveJsonButtonEl.addEventListener('click', () => {
    vscode.postMessage({
      type: 'save_records',
      format: FileType.JSON
    });
  });
  // incoming messages from VS Code
  window.addEventListener('message', event => {
    const { type, data, documentName } = event.data;
    switch (type) {
      case 'update':
        updateUIWith(data, documentName);
        vscode.setState({
          data,
          documentName
        });
        return;
      default:
        console.log('oops! No message type');
    }
  });

  // Restore any cached data from a prior run so the table re-renders immediately
  // when the webview is re-shown (e.g. after the user switches tabs away and back
  // and VS Code tears down the webview's JS context). Called after all event
  // listeners are registered so that any unexpected failure inside `loadState()`
  // cannot prevent the `activate` postMessage below — the extension's response
  // to `activate` is the fallback path that re-pushes fresh data.
  loadState();

  // Ensure the UI is loaded before receiving 'update' from extension
  vscode.postMessage({
    type: 'activate'
  });
})();
