/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as url from 'url';
import { DocumentContext } from 'vscode-html-languageservice';
import { WorkspaceFolder } from 'vscode-languageserver';
import { endsWith, startsWith } from '../utils/strings';

export function getDocumentContext(
  documentUri: string,
  workspaceFolders: WorkspaceFolder[]
): DocumentContext {
  function getRootFolder(): string | undefined {
    for (const folder of workspaceFolders) {
      let folderURI = folder.uri;
      if (!endsWith(folderURI, '/')) {
        folderURI = folderURI + '/';
      }
      if (startsWith(documentUri, folderURI)) {
        return folderURI;
      }
    }
    return undefined;
  }

  return {
    resolveReference: (ref, base = documentUri) => {
      if (ref[0] === '/') {
        // resolve absolute path against the current workspace folder
        if (startsWith(base, 'file://')) {
          const folderUri = getRootFolder();
          if (folderUri) {
            return folderUri + ref.substr(1);
          }
        }
      }
      return url.resolve(base, ref);
    }
  };
}
