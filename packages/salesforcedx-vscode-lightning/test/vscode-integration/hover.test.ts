/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { Hover, Position, MarkdownString, commands, window, workspace } from 'vscode';

describe('Aura Hovers', function () {
  this.timeout(4000);

  let auraDir: string;

  beforeEach(async () => {
    auraDir = path.join(workspace.workspaceFolders![0].uri.fsPath, 'force-app', 'main', 'default', 'aura');

    await new Promise(r => setTimeout(r, 1000));
  });

  afterEach(async () => {
    await commands.executeCommand('workbench.action.closeActiveEditor');
  });

  // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
  it('Should provide additional details when hovering over an aura tag', async function () {
    const doc = await workspace.openTextDocument(
      path.join(auraDir, 'auraPubsubSubscriber', 'auraPubsubSubscriber.cmp')
    );
    const editor = await window.showTextDocument(doc);

    // hover over the 'lightning:card' tag
    const position = new Position(25, 17);

    const hoverInstances = (await commands.executeCommand(
      'vscode.executeHoverProvider',
      editor.document.uri,
      position
    )) as Hover[];

    expect(hoverInstances).to.have.lengthOf.at.least(1);

    const content = findContentFromInstances(hoverInstances, 'lightning:card');

    expect(content).not.to.be.undefined;
    expect(content).not.to.be.null;

    expect(content!.value).to.include('lightning:card');
    expect(content!.value).to.include('View in Component Library');
  });

  // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
  it('Should provide additional details when hovering over an aura attribute', async function () {
    const doc = await workspace.openTextDocument(
      path.join(auraDir, 'auraPubsubSubscriber', 'auraPubsubSubscriber.cmp')
    );
    const editor = await window.showTextDocument(doc);

    // hover over the 'title' attribute
    const position = new Position(25, 24);

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
      'The title can include text or another component, and is displayed in the header.'
    );
  });
});

/** Helper to find the expected hover content
 *
 * @param instances - hover instances
 * @param expectedContent - content that is being searched for
 * @returns the first content which includes the expected value || undefined
 */
const findContentFromInstances = (instances: Hover[], expectedContent: string) => {
  for (const instance of instances) {
    // type assertion to prevent using a deprecated type

    const contents = instance!.contents as MarkdownString[];

    const content = contents.find(cncnt => cncnt.value.includes(expectedContent));

    // return the first found match
    if (content) {
      return content;
    }
  }
};
