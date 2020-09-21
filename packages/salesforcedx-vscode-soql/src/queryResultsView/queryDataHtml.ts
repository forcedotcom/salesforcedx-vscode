import { Uri } from 'vscode';

export function html(assets: { [index: string]: Uri }): string {
  const {
    baseStyleUri,
    tabulatorStyleUri,
    viewControllerUri,
    tabulatorUri
  } = assets;

  return `
  <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link href="${baseStyleUri}" rel="stylesheet" />
    <link href="${tabulatorStyleUri}" rel="stylesheet" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SOQL Query</title>
  </head>
  <body>
    <div>
      <h3>Query Results</h3>
      <div id="data-table"></div>
    </div>
  </body>
  <script src="${tabulatorUri}"></script>
  <script src="${viewControllerUri}"></script>
</html>
`;
}
