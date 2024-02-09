/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import {
  Hover,
  Position,
  MarkdownString,
  commands,
  window,
  workspace
} from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { createLanguageClient } from '../../src/languageClient';
import { before } from 'mocha';

describe('LWC Hovers', () => {
  let lwcDir = path.join(
    workspace.workspaceFolders![0].uri.fsPath,
    'force-app',
    'main',
    'default',
    'lwc'
  );

  let client: LanguageClient;

  before(async function() {
    this.timeout(10000);
    // creating a new client so that we can wait on its ready status before the
    // tests begin. set the timeout at the suite level to give the client some time
    // to get ready
    client = createLanguageClient(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        '..',
        'node_modules',
        '@salesforce',
        'lwc-language-server',
        'lib',
        'server.js'
      )
    );
    client.start();
    await client.onReady();
  });

  afterEach(async () => {
    await commands.executeCommand('workbench.action.closeActiveEditor');
  });

  after(() => client.stop());

  it('Should provide additional details when hovering over a LWC tag', async () => {
    const doc = await workspace.openTextDocument(
      path.join(lwcDir, 'hello', 'hello.html')
    );
    const editor = await window.showTextDocument(doc);

    // hover over the 'lightning-card' tag
    const position = new Position(1, 14);

    const hoverInstances = (await commands.executeCommand(
      'vscode.executeHoverProvider',
      editor.document.uri,
      position
    )) as Hover[];

    expect(hoverInstances).to.have.lengthOf.at.least(1);

    const content = findContentFromInstances(hoverInstances, 'Cards apply a');

    expect(content).not.to.be.undefined;
    expect(content).not.to.be.null;

    expect(content!.value).to.include('Attributes');
    expect(content!.value).to.include('View in Component Library');
  });

  it('Should provide additional details when hovering over a LWC attribute', async () => {
    const doc = await workspace.openTextDocument(
      path.join(lwcDir, 'hello', 'hello.html')
    );
    const editor = await window.showTextDocument(doc);

    // hover over the 'title' attribute
    const position = new Position(1, 22);

    const hoverInstances = (await commands.executeCommand(
      'vscode.executeHoverProvider',
      editor.document.uri,
      position
    )) as Hover[];

    expect(hoverInstances).to.have.lengthOf.at.least(1);

    const content = findContentFromInstances(hoverInstances, 'The title can');

    expect(content).not.to.be.undefined;
    expect(content).not.to.be.null;

    expect(content!.value).to.include('title');
    expect(content!.value).to.include(
      'The title can include text, and is displayed in the header.\nTo include additional markup or another component, use the title slot.'
    );
  });
});

/** Helper to find the expected hover content
 *
 * @param instances - hover instances
 * @param expectedContent - content that is being searched for
 * @returns the first content which includes the expected value || undefined
 */
function findContentFromInstances(instances: Hover[], expectedContent: string) {
  for (const instance of instances) {
    // type assertion to prevent using a deprecated type
    const contents = instance!.contents as MarkdownString[];

    const content = contents.find(content =>
      content.value.includes(expectedContent)
    );

    // return the first found match
    if (content) {
      return content;
    }
  }
}
