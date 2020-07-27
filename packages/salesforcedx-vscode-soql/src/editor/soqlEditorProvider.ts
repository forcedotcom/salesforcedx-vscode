import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class SOQLEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext) {
    const provider = new SOQLEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      SOQLEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }

  private static readonly viewType = 'soqlCustom.soql';
  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'node_modules'))
      ]
    };

    webviewPanel.webview.html = this.getWebViewContent(webviewPanel.webview);
  }

  private getWebViewContent(webview: vscode.Webview): string {
    const pathToLwcDist = path.join(
      this.context.extensionPath,
      'node_modules/@salesforce/soql-builder-ui/dist'
    );
    const pathToHtml = path.join(pathToLwcDist, 'index.html');
    let html = fs.readFileSync(pathToHtml).toString();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(pathToLwcDist, 'app.js'))
    );
    const zeroDotScriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(pathToLwcDist, '0.app.js'))
    );

    html = html.replace('./0.app.js', `${zeroDotScriptUri}`);
    html = html.replace('./app.js', `${scriptUri}`);

    return html;
  }
}
