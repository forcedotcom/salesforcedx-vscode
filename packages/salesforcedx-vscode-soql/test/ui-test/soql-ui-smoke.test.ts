/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import {
  By,
  EditorView,
  InputBox,
  TextEditor,
  VSBrowser,
  WebDriver,
  WebView,
  Workbench
} from 'vscode-extension-tester';

// tslint:disable-next-line:only-arrow-functions
describe('In project folder, SOQL files should', function () {
  this.timeout(55000);
  let browser: VSBrowser;
  let driver: WebDriver;
  const folderPath =
    path.resolve(__dirname, '..', '..', '..', 'test', 'ui-test', 'resources', 'sfdx-test-project') + path.sep;
  const filename = 'example.soql';

  const openFolder = async (folder: string) => {
    const workbench = new Workbench();
    const cmdTitle = 'Extest: Open Folder';
    await workbench.executeCommand(cmdTitle);
    const input = await InputBox.create();
    await input.setText(folder);
    await input.confirm();
    await pause(3000);
  };

  const openSoqlFile = async (folder: string, fileName: string) => {
    const workbench = new Workbench();
    const openEditors = await new EditorView().getOpenEditorTitles();
    if (!openEditors.find(title => title === fileName)) {
      // not open yet
      await workbench.executeCommand('File > Open File...');
      const input = await InputBox.create();
      await input.setText(path.resolve(folder, fileName));
      await input.confirm();
      await pause(2000);
    }
  };

  const toggleEditor = async (editorTitle: string) => {
    const editorView = new EditorView();
    await editorView.openEditor(editorTitle);

    // find toggle action and click
    const actionToolbar = await editorView.findElement(By.className('editor-actions'));
    const actions = await actionToolbar.findElements(By.className('codicon'));
    let toggle;

    for (const action of actions) {
      if ((await action.getAttribute('aria-label')) === 'Switch Between SOQL Builder and Text Editor') {
        toggle = action;
        break;
      }
    }
    expect(toggle).is.not.undefined;
    await toggle?.click();

    await pause(10000);
  };

  const pause = async (msec: number) => {
    await new Promise(res => setTimeout(res, msec));
  };

  before(async () => {
    browser = VSBrowser.instance;
    driver = browser.driver;
    await browser.waitForWorkbench();
    await openFolder(folderPath);
  });

  beforeEach(async () => {
    const editorView = new EditorView();
    await editorView.closeAllEditors();
    await pause(500);
  });

  it('pass end to end SOQL Builder test', async () => {
    // everything in one test to save time

    // should open in Text Editor by default
    await openSoqlFile(folderPath, filename);
    const textEditor = await new EditorView().openEditor(filename);
    expect(textEditor.constructor === TextEditor).to.be.true;

    // toggle editor should open in SOQL Builder
    await toggleEditor(filename);

    // UI should render
    const webview = new WebView();
    await webview.switchToFrame();
    const qbApp = await webview.findWebElement(By.css('querybuilder-app'));
    expect(qbApp).is.not.undefined;
    // TODO: do we need to check for individual form elements?
    //       they are in the shadow DOM and harder to find with webdriver
    await webview.switchBack();

    // TODO: check query results render

    return Promise.resolve();
  });
});
