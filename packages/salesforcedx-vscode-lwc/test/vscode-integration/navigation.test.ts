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

describe('LWC Definition Linking', () => {
  const lwcDir = path.join(
    workspace.workspaceFolders![0].uri.fsPath,
    'force-app',
    'main',
    'default',
    'lwc'
  );

  afterEach(async () => {
    await commands.executeCommand('workbench.action.closeActiveEditor');
  });

  it('Should provide navigation to a selected LWC tag', async () => {
    // select the 'c-view-source' tag
    testDefinitionNavigation(
      path.join(lwcDir, 'hello', 'hello.html'),
      path.join(lwcDir, 'viewSource', 'viewSource.js'),
      new Position(6, 16)
    );
  });
});

/** Helper to test the definition provider
 *
 * @param startLocation - starting location
 * @param endLocation - expected definition location given the position
 * @param position - position to initiate the definition lookup
 */
async function testDefinitionNavigation(
  startLocation: string,
  endLocation: string,
  position: Position
) {
  const doc = await workspace.openTextDocument(startLocation);
  const editor = await window.showTextDocument(doc);

  const locations = (await commands.executeCommand(
    'vscode.executeDefinitionProvider',
    editor.document.uri,
    position
  )) as Location[];

  expect(locations).to.have.lengthOf(3);

  const location = locations![0];

  expect(location).to.have.property('uri');

  const expectedURI = URI.file(endLocation);

  expect(location.uri.toString()).to.equal(expectedURI.toString());
}
