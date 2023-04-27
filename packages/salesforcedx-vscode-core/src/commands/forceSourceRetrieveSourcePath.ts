/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { getUriFromActiveEditorRetrieve } from './getUriFromActiveEditorRetrieve';
import { LibraryRetrieveSourcePathExecutor } from './libraryRetrieveSourcePathExecutor';
import { SourcePathChecker } from './sourcePathChecker';
import {
  LibraryPathsGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './util';

export const forceSourceRetrieveSourcePaths = async (
  sourceUri: vscode.Uri | undefined,
  uris: vscode.Uri[] | undefined
) => {
  if (!sourceUri) {
    // When the source is retrieved via the command palette, both sourceUri and uris are
    // each undefined, and sourceUri needs to be obtained from the active text editor.
    sourceUri = getUriFromActiveEditorRetrieve();
    if (!sourceUri) {
      return;
    }
  }

  // When a single file is selected and "Retrieve Source from Org" is executed,
  // sourceUri is passed, and the uris array contains a single element, the same
  // path as sourceUri.
  //
  // When multiple files are selected and "Retrieve Source from Org" is executed,
  // sourceUri is passed, and is the path to the first selected file, and the uris
  // array contains an array of all paths that were selected.
  //
  // When editing a file and "Retrieve This Source from Org" is executed,
  // sourceUri is passed, but uris is undefined.
  if (!uris || uris.length < 1) {
    uris = [];
    uris.push(sourceUri);
  }

  const commandlet = new SfdxCommandlet<string[]>(
    new SfdxWorkspaceChecker(),
    new LibraryPathsGatherer(uris),
    new LibraryRetrieveSourcePathExecutor(),
    new SourcePathChecker()
  );

  await commandlet.run();
};
