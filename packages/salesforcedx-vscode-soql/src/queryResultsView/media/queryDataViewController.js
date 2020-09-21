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
      paginationSize: 10,
      layout: 'fitColumns',
      maxHeight: '100%'
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
