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

describe('LWC Hovers', function() {
  this.timeout(4000);

  let lwcDir: string;

  before(async function() {
    lwcDir = path.join(
      workspace.workspaceFolders![0].uri.fsPath,
      'force-app',
      'main',
      'default',
      'lwc'
    );

    await new Promise(r => setTimeout(r, 1000));
  });

  afterEach(async function() {
    await commands.executeCommand('workbench.action.closeActiveEditor');
  });

  it('Should provide additional details when hovering over a LWC tag', async function() {
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

    const content = findContentFromInstances(hoverInstances, 'lightning-card');

    expect(content).not.to.be.undefined;
    expect(content).not.to.be.null;

    expect(content!.value).to.include('lightning-card');
    expect(content!.value).to.include('View in Component Library');
  });

  it('Should provide additional details when hovering over a LWC attribute', async function() {
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

    const content = findContentFromInstances(hoverInstances, '**title**');

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
