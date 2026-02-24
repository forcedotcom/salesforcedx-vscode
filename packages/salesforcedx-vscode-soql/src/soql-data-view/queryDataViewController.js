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
    CSV: 'csv',
  };
  const vscode = acquireVsCodeApi();

  // load previous state if webview was moved from background.
  function loadState() {
    const state = vscode.getState();
    if (state) {
      updateUIWith(state.data, state.documentName);
    }
  }

  loadState();

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
    new Tabulator('#data-table', {
      data: tableData.records,
      pagination: 'local',
      layout: 'fitColumns',
      height: '60vh',
      columns: getColumns(tableData, tableData.columnData),
      rowFormatter: row => {
        tableData.columnData.subTables.forEach(subTable => {

          const key = Object.keys(row.getData()).find(k => k.toLowerCase() === subTable.objectName.toLowerCase());
          if (key && row.getData()[key]) {
            var data = row.getData()[key];
            //create and style holder elements
            var holderEl = document.createElement("div");
            var tableEl = document.createElement("div");

            holderEl.style.boxSizing = "border-box";
            holderEl.style.padding = "10px 30px 10px 10px";
            holderEl.style.borderTop = "1px solid #333";
            holderEl.style.borderBotom = "1px solid #333";
            holderEl.style.background = "#ddd";

            tableEl.style.border = "1px solid #333";

            holderEl.appendChild(tableEl);

            row.getElement().appendChild(holderEl);

            new Tabulator(tableEl, {
              layout:"fitColumns",
              data: data.records,
              columns: getColumns(data, subTable)
            });
          }
        });
      }
    });
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
    var record = obj.records && obj.records.length
      ? obj.records[0]
      : undefined;
    if (record) {
      columnData.columns.forEach(col => {
        let field = '';
        let currentObject = record;
        col.fieldHelper.forEach(segment => {
          var key = Object.keys(currentObject).find(k => k.toLowerCase() === segment.toLowerCase());
          if (key) {
            field = field.length === 0
              ? key
              : field + '.' + key;
            currentObject = currentObject[key];
          }
        });
        columns.push({
          title: col.title,
          field
        })
      });
    }
    return columns;
  }

  // ---- EVENT LISTENERS ---- //

  const saveCsvButtonEl = document.getElementById('save-csv-button');
  saveCsvButtonEl.addEventListener('click', () => {
    vscode.postMessage({
      type: 'save_records',
      format: FileType.CSV,
    });
  });

  const saveJsonButtonEl = document.getElementById('save-json-button');
  saveJsonButtonEl.addEventListener('click', () => {
    vscode.postMessage({
      type: 'save_records',
      format: FileType.JSON,
    });
  });
  // incoming messages from VS Code
  window.addEventListener('message', (event) => {
    const { type, data, documentName } = event.data;
    switch (type) {
      case 'update':
        updateUIWith(data, documentName);
        vscode.setState({
          data,
          documentName,
        });
        return;
      default:
        console.log('oops! No message type');
    }
  });
  // Ensure the UI is loaded before receiving 'update' from extension
  vscode.postMessage({
    type: 'activate',
  });
})();
