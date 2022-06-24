import * as vscode from "vscode";
import { getUri } from "../util/getUri";


export class OrgListPanel {
  public static current: OrgListPanel | undefined;
  private readonly _webviewPanel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._webviewPanel = panel;

    this._webviewPanel.onDidDispose(this.dispose, null, this._disposables);
    this._webviewPanel.webview.html = this._getWebviewContent(this._webviewPanel.webview, extensionUri);
    this._setWebviewMessageListener(this._webviewPanel.webview);
  }

  public dispose() {
    OrgListPanel.current = undefined;

    this._webviewPanel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const toolkitUri = getUri(webview, extensionUri, [
      "node_modules",
      "@vscode",
      "webview-ui-toolkit",
      "dist",
      "toolkit.js", // A toolkit.min.js file is also available
    ]);

    const mainUri = getUri(webview, extensionUri, ["webview-ui", "main.js"]);


    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script type="module" src="${toolkitUri}"></script>
          <script type="module" src="${mainUri}"></script>
          <title>Org List</title>
          <style>
            .connected-text {
              color: #6BDB4F;
            }

            .active-text {
              color: #6BDB4F;
            }

            .deleted-text {
              color: #EE907C;
            }
          </style>
        </head>
        <body>
          <h1>
            Org List
          </h1>

          <div id="retrieving-data">
            <p style="text-align: center;">
              Retrieving data...
            </p>

            <vscode-progress-ring style="margin: auto;">
            </vscode-progress-ring>
          </div>

          <!--
          TODO: add error section here
          <div id="error" style="display: none;">
          </div>
          -->

          <div id="org-list-content" style="display: none;">
            <vscode-panels aria-label="Org List">
              <vscode-panel-tab id="tab-1">
                CURRENT
              </vscode-panel-tab>

              <vscode-panel-tab id="tab-2">
                ALL
              </vscode-panel-tab>

              <vscode-panel-view
                id="view-1"
                style="flex-flow: column"
              >
                <h2>
                  Non Scratch Orgs
                </h2>

                <div>
                  <vscode-data-grid
                    class='non-scratch-orgs-data-grid'
                    grid-template-columns='50px 1fr 2fr 1fr 1fr'
                    aria-label='Non Scratch Orgs'
                  >
                  </vscode-data-grid>
                </div>

                <br />
                <br />
                <br />

                <h2>
                  Scratch Orgs
                </h2>

                <div>
                  <vscode-data-grid
                    class='scratch-orgs-data-grid'
                    grid-template-columns='50px 1fr 2fr 1fr 1fr'
                    aria-label='Scratch Orgs'
                  >
                  </vscode-data-grid>
                </div>
              </vscode-panel-view>

              <vscode-panel-view
                id="view-2"
                style="flex-flow: column"
              >
                <h2>
                  All Non Scratch Orgs
                </h2>

                <vscode-data-grid
                  class='all-non-scratch-orgs-data-grid'
                  grid-template-columns='50px 1fr 2fr 1fr 2fr'
                  aria-label='All Non Scratch Orgs'
                >
                </vscode-data-grid>

                <br />
                <br />
                <br />

                <h2>
                  All Scratch Orgs
                </h2>

                <vscode-data-grid
                  class='all-scratch-orgs-data-grid'
                  grid-template-columns='50px 1fr 2fr 1fr 1fr 1fr'
                  aria-label='All Scratch Orgs'
                >
                </vscode-data-grid>

              </vscode-panel-view>
            </vscode-panels>
          </div>

          <script>
            window.addEventListener('message', event => {
              const eventData = event.data;
              switch (eventData.command) {
                case 'setViewOrgListData':

                  // jab
                  debugger;

                  var result = eventData.result;

                  var retrievingDataEl = document.getElementById('retrieving-data');
                  retrievingDataEl.style.display = 'none';



                  // this is for "current" (sfdx force:org:list --json) and not "all"
                  var nonScratchOrgs = result.nonScratchOrgs;

                  const nonScratchOrgsDataGrid = document.querySelector('.non-scratch-orgs-data-grid');
                  nonScratchOrgsDataGrid.columnDefinitions = [
                    { columnDataKey: 'columnKey0', title: '' },
                    { columnDataKey: 'columnKey1', title: 'ALIAS' },
                    { columnDataKey: 'columnKey2', title: 'USERNAME' },
                    { columnDataKey: 'columnKey3', title: 'ORG ID' },
                    { columnDataKey: 'columnKey4', title: 'CONNECTED STATUS' }
                  ];

                  const nonScratchOrgsRowsData = [];
                  nonScratchOrgs.forEach(nonScratchOrg => {
                    nonScratchOrgsRowsData.push({
                      columnKey0: nonScratchOrg.isDefaultDevHubUsername ? '(D)' : '',
                      columnKey1: nonScratchOrg.alias,
                      columnKey2: nonScratchOrg.username,
                      columnKey3: nonScratchOrg.orgId,
                      columnKey4: nonScratchOrg.connectedStatus
                    });
                  });
                  nonScratchOrgsDataGrid.rowsData = nonScratchOrgsRowsData;


                  var scratchOrgs = result.scratchOrgs;

                  const scratchOrgsDataGrid = document.querySelector('.scratch-orgs-data-grid');
                  scratchOrgsDataGrid.columnDefinitions = [
                    { columnDataKey: 'columnKey0', title: '' },
                    { columnDataKey: 'columnKey1', title: 'ALIAS' },
                    { columnDataKey: 'columnKey2', title: 'USERNAME' },
                    { columnDataKey: 'columnKey3', title: 'ORG ID' },
                    { columnDataKey: 'columnKey4', title: 'EXPIRATION DATE' }
                  ];

                  const scratchOrgsRowsData = [];
                  scratchOrgs.forEach(scratchOrg => {
                    if(scratchOrg.isExpired === false) {
                      scratchOrgsRowsData.push({
                        columnKey0: scratchOrg.isDefaultUsername ? '(U)' : '',
                        columnKey1: scratchOrg.alias,
                        columnKey2: scratchOrg.username,
                        columnKey3: scratchOrg.orgId,
                        columnKey4: scratchOrg.expirationDate
                      });
                    }
                  });
                  scratchOrgsDataGrid.rowsData = scratchOrgsRowsData;






                  // jab
                  debugger;

                  // Now need to set the data for sfdx force:org:list --all


                  //var nonScratchOrgs = result.nonScratchOrgs;

                  const allNonScratchOrgsDataGrid = document.querySelector('.all-non-scratch-orgs-data-grid');
                  allNonScratchOrgsDataGrid.columnDefinitions = [
                    { columnDataKey: 'columnKey0', title: '' },
                    { columnDataKey: 'columnKey1', title: 'ALIAS' },
                    { columnDataKey: 'columnKey2', title: 'USERNAME' },
                    { columnDataKey: 'columnKey3', title: 'ORG ID' },
                    { columnDataKey: 'columnKey4', title: 'STATUS' }
                  ];

                  const allNonScratchOrgsRowsData = [];
                  nonScratchOrgs.forEach(nonScratchOrg => {
                    allNonScratchOrgsRowsData.push({
                      columnKey0: nonScratchOrg.isDefaultDevHubUsername ? '(D)' : '',
                      columnKey1: nonScratchOrg.alias,
                      columnKey2: nonScratchOrg.username,
                      columnKey3: nonScratchOrg.orgId,
                      columnKey4: nonScratchOrg.connectedStatus
                    });
                  });
                  allNonScratchOrgsDataGrid.rowsData = allNonScratchOrgsRowsData;

                  //
                  debugger;

                  //var scratchOrgs = result.scratchOrgs;

                  const allScratchOrgsDataGrid = document.querySelector('.all-scratch-orgs-data-grid');
                  allScratchOrgsDataGrid.columnDefinitions = [
                    { columnDataKey: 'columnKey0', title: '' },
                    { columnDataKey: 'columnKey1', title: 'ALIAS' },
                    { columnDataKey: 'columnKey2', title: 'USERNAME' },
                    { columnDataKey: 'columnKey3', title: 'ORG ID' },
                    { columnDataKey: 'columnKey4', title: 'STATUS' },
                    { columnDataKey: 'columnKey5', title: 'EXPIRATION' }
                  ];

                  //
                  debugger;

                  const allScratchOrgsRowsData = [];
                  scratchOrgs.forEach(scratchOrg => {
                    allScratchOrgsRowsData.push({
                      columnKey0: scratchOrg.isDefaultUsername ? '(U)' : '',
                      columnKey1: scratchOrg.alias,
                      columnKey2: scratchOrg.username,
                      columnKey3: scratchOrg.orgId,
                      columnKey4: scratchOrg.status,
                      columnKey5: scratchOrg.expirationDate
                    });
                  });
                  allScratchOrgsDataGrid.rowsData = allScratchOrgsRowsData;
                  /*
                  */





                  // Now display the the content (the panel and the grids)
                  var orgListContentEl = document.getElementById('org-list-content');
                  orgListContentEl.style.display = 'contents';

                  setTimeout(() => {
                    document.querySelectorAll('.non-scratch-orgs-data-grid [grid-column="5"]').forEach(el => {
                      if (el.textContent === 'Connected') {
                        el.classList.add('connected-text');
                      }
                    });
                    document.querySelectorAll('vscode-data-grid [grid-column="1"]').forEach(el => {
                      if (el.textContent === '(D)' || el.textContent === '(U)') {
                        el.classList.add('connected-text');
                      }
                    });
                  }, 250);
                  break;
              }

              /*
                TODO: still need to:
                1) add results for sfdx force:org:list --all
                2) color the results of all grids (at the very least, the status should be green or red)
                3) add borders to the tab control, the tab panels, and/or the grid?
                4) Add a warning to each scratch org which is about to expire.  Maybe when <= 5 days, display a waring icon with a tool tip, or maybe animate on/off every second
                5) If the "copying from a <vscode-data-grid> isn' resolved, switch to divs and spans
                6) display an error (show #error, and hide #retrieving-data and #org-list-content) when there is an error
                7) localize strings
                8) write unit tests
              */
            });
          </script>
        </body>
      </html>
    `;
  }

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;
        const text = message.text;

        switch (command) {
          case "hello":
            vscode.window.showInformationMessage(text);
            return;
        }
      },
      undefined,
      this._disposables
    );
  }

  public static render(extensionUri: vscode.Uri) {
    if (OrgListPanel.current) {
      OrgListPanel.current._webviewPanel.reveal(vscode.ViewColumn.One);
    } else {
      const panel = vscode.window.createWebviewPanel(
        'org-list',
        'Org List',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
        }
      );

      OrgListPanel.current = new OrgListPanel(panel, extensionUri);
    }
  }

  public static setViewOrgListData(result: any) {
    if (!OrgListPanel.current) {
      return;
    }

    OrgListPanel.current._webviewPanel.webview.postMessage({
      command: 'setViewOrgListData',
      result
    });
  }
}