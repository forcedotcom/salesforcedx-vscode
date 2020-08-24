import { debounce } from 'debounce';
import * as vscode from 'vscode';

interface SoqlEditorEvent {
  type: string;
  message: string;
}

export class SOQLEditorInstance {
  // handlers assigned in constructor
  private updateWebview: () => void;
  private onDidRecieveMessageHandler: (e: SoqlEditorEvent) => void;
  private onTextDocumentChangeHandler: (
    e: vscode.TextDocumentChangeEvent
  ) => void;

  // when destroyed, dispose of all event listeners.
  // might need to use context.subscriptions
  public subscriptions: vscode.Disposable[] = [];

  // Notify soqlEditorProvider when destroyed
  private disposedCallback:
    | ((instance: SOQLEditorInstance) => void)
    | undefined;

  constructor(
    private document: vscode.TextDocument,
    private webviewPanel: vscode.WebviewPanel,
    private _token: vscode.CancellationToken
  ) {
    this.updateWebview = this.createWebviewUpdater(
      webviewPanel.webview,
      document
    );
    this.onDidRecieveMessageHandler = this.createOnDidRecieveMessageHandler(
      document
    );
    this.onTextDocumentChangeHandler = debounce(
      this.createDocumentChangeHandler(document),
      1000
    );

    // Update the UI when the Text Document is changed, if its the same document.
    vscode.workspace.onDidChangeTextDocument(
      this.onTextDocumentChangeHandler,
      this,
      this.subscriptions
    );

    // Update the text document when message recieved
    webviewPanel.webview.onDidReceiveMessage(
      this.onDidRecieveMessageHandler,
      this,
      this.subscriptions
    );

    // Make sure we get rid of the event listeners when our editor is closed.
    webviewPanel.onDidDispose(this.dispose, this, this.subscriptions);
  }

  private createWebviewUpdater(
    webview: vscode.Webview,
    document: vscode.TextDocument
  ) {
    return function updateWebview() {
      webview.postMessage({
        type: 'update',
        message: document.getText()
      });
    };
  }

  private createDocumentChangeHandler(document: vscode.TextDocument) {
    return (e: vscode.TextDocumentChangeEvent) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.updateWebview();
      }
    };
  }

  private createOnDidRecieveMessageHandler(document: vscode.TextDocument) {
    return (e: SoqlEditorEvent) => {
      switch (e.type) {
        case 'activated': {
          this.updateWebview();
          break;
        }
        case 'query': {
          this.updateTextDocument(document, e.message);
          break;
        }
        default: {
          console.log('message type is not supported');
        }
      }
    };
  }

  // Write out the json to a given document. //
  private updateTextDocument(document: vscode.TextDocument, message: any) {
    const edit = new vscode.WorkspaceEdit();

    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      // NOTE: Instead we would convert the UImodel JSON into a Query String before applyEdit
      message
    );

    return vscode.workspace.applyEdit(edit);
  }

  private dispose() {
    this.subscriptions.forEach(dispposable => dispposable.dispose());
    if (this.disposedCallback) {
      this.disposedCallback(this);
    }
  }

  public onDispose(callback: (instance: SOQLEditorInstance) => void) {
    this.disposedCallback = callback;
  }
}
