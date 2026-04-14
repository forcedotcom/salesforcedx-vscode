/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  type CancellationToken,
  type DefinitionProvider,
  type TextDocument,
  Location,
  Position,
  workspace
} from 'vscode';
import { URI, Utils } from 'vscode-uri';

// Matches controller="ClassName" or extensions="ClassName" in VF markup
const APEX_ATTR_RE = /\b(?:controller|extensions)\s*=\s*"([\w]+)"/g;

// Standard Salesforce DX class paths relative to workspace root.
const APEX_CLASS_SEARCH_PATHS = [
  ['force-app', 'main', 'default', 'classes'],
  ['src', 'classes']
];

const statUri = async (uri: URI): Promise<boolean> => {
  try {
    // vscode-uri URI is structurally compatible with vscode.Uri
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    await workspace.fs.stat(uri as unknown as import('vscode').Uri);
    return true;
  } catch {
    return false;
  }
};

export const apexControllerDefinitionProvider: DefinitionProvider = {
  provideDefinition: async (document: TextDocument, position: Position, _token: CancellationToken) => {
    const line = document.lineAt(position.line).text;
    const offset = position.character;
    for (const match of line.matchAll(APEX_ATTR_RE)) {
      const start = match.index! + match[0].indexOf(match[1]);
      const end = start + match[1].length;
      if (offset >= start && offset <= end) {
        const className = match[1];
        const fileName = `${className}.cls`;
        for (const folder of workspace.workspaceFolders ?? []) {
          const folderUri = URI.parse(folder.uri.toString());
          for (const segments of APEX_CLASS_SEARCH_PATHS) {
            const uri = Utils.joinPath(folderUri, ...segments, fileName);
            if (await statUri(uri)) {
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              return new Location(uri as unknown as import('vscode').Uri, new Position(0, 0));
            }
          }
        }
        // Fallback: workspace-wide glob search
        const files = await workspace.findFiles(`**/${fileName}`, undefined, 1);
        return files.length > 0 ? new Location(files[0], new Position(0, 0)) : undefined;
      }
    }
    return undefined;
  }
};
