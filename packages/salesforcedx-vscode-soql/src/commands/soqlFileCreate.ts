/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { BUILDER_VIEW_TYPE, OPEN_WITH_COMMAND } from '../constants';

export const soqlOpenNew = Effect.fn('soql_builder_open_new')(function* () {
  if (vscode.workspace) {
    const fileName = 'untitled.soql';
    const newUri = URI.file(fileName).with({
      scheme: 'untitled',
      path: fileName
    });
    yield* Effect.promise(() => vscode.commands.executeCommand(OPEN_WITH_COMMAND, newUri, BUILDER_VIEW_TYPE));
  }
});
