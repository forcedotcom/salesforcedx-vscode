/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { Location, Position, commands, window, workspace } from 'vscode';
import URI from 'vscode-uri';

describe('Aura Definition Linking', () => {
  let auraDir: string;
  let lwcDir: string;

  beforeEach(async () => {
    auraDir = path.join(workspace.workspaceFolders![0].uri.fsPath, 'force-app', 'main', 'default', 'aura');

    lwcDir = path.join(workspace.workspaceFolders![0].uri.fsPath, 'force-app', 'main', 'default', 'lwc');

    await new Promise(r => setTimeout(r, 1500));
  });

  afterEach(async () => {
    await commands.executeCommand('workbench.action.closeActiveEditor');
  });

  it('Should provide navigation to a selected Aura tag', async () => {
    // select the 'c:DemoComponent' Aura tag
    await testDefinitionNavigation(
      path.join(auraDir, 'DemoApp', 'DemoApp.app'),
      path.join(auraDir, 'DemoComponent', 'DemoComponent.cmp'),
      new Position(1, 12)
    );
  });

  it('Should provide navigation to a selected LWC tag', async () => {
    // select the 'c:contactList' LWC tag
    await testDefinitionNavigation(
      path.join(auraDir, 'auraEmbeddedLWC', 'auraEmbeddedLWC.cmp'),
      path.join(lwcDir, 'contactList', 'contactList.js'),
      new Position(20, 28)
    );
  });
});

/** Helper to test the definition provider
 *
 * @param startLocation - starting location
 * @param endLocation - expected definition location given the position
 * @param position - position to initiate the definition lookup
 */
const testDefinitionNavigation = async (startLocation: string, endLocation: string, position: Position) => {
  const doc = await workspace.openTextDocument(startLocation);
  const editor = await window.showTextDocument(doc);

  const locations = (await commands.executeCommand(
    'vscode.executeDefinitionProvider',
    editor.document.uri,
    position
  )) as Location[];

  expect(locations).to.have.lengthOf(1);

  const location = locations![0];

  expect(location).to.have.property('uri');

  const expectedURI = URI.file(endLocation);

  expect(location.uri.toString()).to.equal(expectedURI.toString());
};
