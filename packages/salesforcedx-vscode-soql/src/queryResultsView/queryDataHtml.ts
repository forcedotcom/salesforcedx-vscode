import { Uri } from 'vscode';

export function html(styleUri: Uri, scriptUri: Uri): string {
  return `
  <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link href="${styleUri}" rel="stylesheet" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SOQL Query</title>
  </head>
  <body>
    <div>
      <h3>Query Results</h3>
      <div id="data-table"></div>
    </div>
  </body>
  <script src="${scriptUri}"></script>
</html>
`;
}
