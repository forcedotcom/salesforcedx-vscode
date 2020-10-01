/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
    <link href="${tabulatorStyleUri}" rel="stylesheet" />
    <link href="${baseStyleUri}" rel="stylesheet" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- CSP TAG -->
    <title>SOQL Query Data View</title>
  </head>
  <body>
    <div>
      <header>
        <div>
          <h3 id="webview-title"></h3>
          <p id="total-records-size"></p>
        </div>
        <button id="save-csv-button" class="button__save">Save Records (csv)</button>
      </header>
      <div id="data-table"></div>
    </div>
  </body>
  <script src="${tabulatorUri}"></script>
  <script src="${viewControllerUri}"></script>
</html>
`;
}
