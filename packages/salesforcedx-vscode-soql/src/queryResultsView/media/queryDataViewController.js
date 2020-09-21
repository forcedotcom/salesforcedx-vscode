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
      data: tableData,
      autoColumns: true,
      pagination: 'local',
      paginationSize: 10,
      layout: 'fitColumns',
      maxHeight: '100%'
    });
  }
})();
