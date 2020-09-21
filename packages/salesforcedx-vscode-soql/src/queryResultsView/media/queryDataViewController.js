(function() {
  const vscode = acquireVsCodeApi();
  function loadState() {
    const state = vscode.getState();
    if (state) {
      renderTableWith(state.text);
    }
  }

  loadState();

  window.addEventListener('message', event => {
    const postMessage = event.data;
    switch (postMessage.type) {
      case 'update':
        renderTableWith(postMessage.text);

        // Then persist state information.
        // TODO: This state is returned in the call to `vscode.getState` below when a webview is reloaded.
        vscode.setState({
          text: postMessage.text
        });
        return;
      default:
        console.log('oops! No message type');
    }
  });

  function renderTableWith(tableData) {
    new Tabulator('#data-table', {
      data: tableData, //assign data to table
      autoColumns: true, //create columns from data field names
      pagination: 'local',
      paginationSize: 6,
      layout: 'fitColumns',
      maxHeight: '100%'
    });
  }
})();
