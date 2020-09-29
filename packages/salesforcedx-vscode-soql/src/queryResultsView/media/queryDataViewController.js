/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

(function() {
  /* interface queryData {
    done: boolean;
    nextRecordsUrl?: string;
    totalSize: number;
    records: T[];
  } */
  const vscode = acquireVsCodeApi();

  function updateUIWith(queryData, documentName) {
    // Display the .soql file name as the title
    const titleEl = document.getElementById('webview-title');
    titleEl.innerText = documentName;
    // Display the total number of records returned from the query
    const totalRecordsSizeEl = document.getElementById('total-records-size');
    totalRecordsSizeEl.innerText = `Returned ${queryData.records.length} of ${queryData.totalSize} total records`; // TODO: i18n

    renderTableWith(queryData);
  }

  function loadState() {
    const state = vscode.getState();
    if (state) {
      updateUIWith(state.data, state.documentName);
    }
  }

  loadState();

  function renderTableWith(tableData) {
    new Tabulator('#data-table', {
      data: tableData.records,
      autoColumns: true,
      pagination: 'local',
      layout: 'fitColumns',
      height: '60vh'
    });
  }

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
})();
