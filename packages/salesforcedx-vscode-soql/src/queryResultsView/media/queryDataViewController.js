(function() {
  console.log('controller is loaded!');
  const vscode = acquireVsCodeApi();
  const dataTableEl = document.getElementById('data-table');

  function loadState() {
    console.log('load state');
    const state = vscode.getState();
    if (state) {
      dataTableEl.innerText = JSON.stringify(state.text, null, 2);
    }
  }

  loadState();

  window.addEventListener('message', event => {
    const postMessage = event.data;
    switch (postMessage.type) {
      case 'update':
        console.log('Update message sent!', postMessage.text);
        dataTableEl.innerText = JSON.stringify(postMessage.text, null, 2);

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
})();
