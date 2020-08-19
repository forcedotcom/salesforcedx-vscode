import * as path from 'path';
import * as vscode from 'vscode';

/**
 * The index.html file in the dist folder of the @salesforce/soql-builder-ui
 * is built by webpack to be displayed in a normal web context.  however, vscode
 * uses a custom protocol ( vscode-webview-resource instead of http ) to load resources
 * so the html needs to be manipulated dynamcially to run inside of vscode.
 */
export class EditorUtils {
  /**
   * This regex will match tags in a string like this
   * <script src="./0.app.js"></script><script src="./app.js"></script>
   * And store just the filename section of the script tag as group[1]
   */
  protected static readonly scriptRegex = /script\ssrc=\"\.\/(?<app>[^\"]*app.js)\"/g;

  /**
   *
   * @param html
   * @param pathToLwcDist
   * @param webview
   */
  public static transformHtml(
    html: string,
    pathToLwcDist: string,
    webview: vscode.Webview
  ) {
    html = EditorUtils.transformScriptTags(html, pathToLwcDist, webview);
    html = EditorUtils.replaceCspMetaTag(html, webview);
    return html;
  }

  /**
   * This section replaces the relative file paths that are produced by
   * webpack in the build in the dist folder with the protocol that
   * vscode uses internally.
   *
   * Initial html script tags look like this
   * <script src="./0.app.js"></script><script src="./app.js"></script>
   *
   * Each matched script tag gets transformed into into a vscode specific url
   * <script src="vscode-webview-resource:0.app.js"><script src="vscode-webview-resource:app.js">
   *
   * Since we don't know how many bundles webpack will produce in the dist directory, we regex match and
   * replace them in a while loop.
   *
   * @param html
   * @param pathToLwcDist
   * @param webview
   */
  public static transformScriptTags(
    html: string,
    pathToLwcDist: string,
    webview: vscode.Webview
  ) {
    let matches;
    let newScriptSrc;
    // tslint:disable-next-line:no-conditional-assignment
    while ((matches = EditorUtils.scriptRegex.exec(html)) !== null) {
      newScriptSrc = webview.asWebviewUri(
        vscode.Uri.file(path.join(pathToLwcDist, matches[1]))
      );
      html = html.replace(`./${matches[1]}`, newScriptSrc.toString());
    }
    return html;
  }

  /**
   * This method adds stricter CSP for displaying this webview inside of VSCode
   * @param html
   * @param webview
   */
  public static replaceCspMetaTag(html: string, webview: vscode.Webview) {
    const cspMetaTag = `<meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none';
      img-src ${webview.cspSource} https:;
      script-src ${webview.cspSource};
      style-src 'unsafe-inline' ${webview.cspSource};"
    />`;

    html = html.replace('<!-- CSP TAG -->', cspMetaTag);
    return html;
  }
}
