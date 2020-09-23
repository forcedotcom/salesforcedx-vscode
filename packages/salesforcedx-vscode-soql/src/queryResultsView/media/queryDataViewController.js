/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

(function() {
  const vscode = acquireVsCodeApi();

  function updateUIWith(queryData, documentName) {
    const title = document.getElementById('webview-title');
    title.innerText = documentName;

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
      data: tableData,
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
