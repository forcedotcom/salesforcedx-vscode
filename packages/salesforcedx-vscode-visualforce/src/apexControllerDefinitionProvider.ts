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

// Matches controller="ClassName" or extensions="ClassName" in VF markup
const APEX_ATTR_RE = /\b(?:controller|extensions)\s*=\s*"([\w]+)"/g;

export const apexControllerDefinitionProvider: DefinitionProvider = {
  provideDefinition: async (document: TextDocument, position: Position, _token: CancellationToken) => {
    const line = document.lineAt(position.line).text;
    const offset = position.character;
    for (const match of line.matchAll(APEX_ATTR_RE)) {
      const start = match.index! + match[0].indexOf(match[1]);
      const end = start + match[1].length;
      if (offset >= start && offset <= end) {
        const files = await workspace.findFiles(`**/${match[1]}.cls`, undefined, 1);
        return files.length > 0 ? new Location(files[0], new Position(0, 0)) : undefined;
      }
    }
    return undefined;
  }
};
