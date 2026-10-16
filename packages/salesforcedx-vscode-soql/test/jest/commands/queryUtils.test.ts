/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { EditorService } from 'salesforcedx-vscode-services/out/src/vscode/editorService';
import { PromptService } from 'salesforcedx-vscode-services/out/src/vscode/prompts/promptService';
import * as vscode from 'vscode';
import {
  getDocumentQueryAndApiInputs,
  getDocumentQueryInputsForPlan,
  getQueryAndApiInputs,
  getQueryInputsForPlan
} from '../../../src/commands/queryUtils';

describe('SOQL command inputs', () => {
  const getActiveEditorText = jest.fn();

  beforeEach(() => {
    (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
      isActive: true,
      exports: {
        services: {
          EditorService: Effect.succeed({ getActiveEditorText }),
          PromptService: Effect.succeed({ considerUndefinedAsCancellation: (value: string) => Effect.succeed(value) })
        }
      }
    });
    (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ api: 'REST' });
  });

  afterEach(() => jest.clearAllMocks());

  const run = <A, E>(effect: Effect.Effect<A, E, EditorService | PromptService>) =>
    Effect.runPromise(
      effect.pipe(
        Effect.provideService(EditorService, {} as EditorService),
        Effect.provideService(PromptService, {} as PromptService)
      )
    );

  it.each([
    [true, getQueryAndApiInputs],
    [false, getDocumentQueryAndApiInputs]
  ])('prepares Run Query text (useSelection=%s) before collapsing newlines', async (useSelection, getInputs) => {
    getActiveEditorText.mockReturnValue(
      Effect.succeed('// header\n   // indented\n\n[SELECT Id\nFROM Account ALL ROWS;]')
    );

    expect(await run(getInputs())).toEqual({
      query: { soql: 'SELECT Id FROM Account', scanAll: true },
      api: 'REST'
    });
    expect(getActiveEditorText).toHaveBeenCalledWith(useSelection);
  });

  it.each([
    [true, getQueryInputsForPlan],
    [false, getDocumentQueryInputsForPlan]
  ])('prepares query plan text (useSelection=%s) before collapsing newlines', async (useSelection, getInputs) => {
    getActiveEditorText.mockReturnValue(Effect.succeed('// header\nSELECT Id FROM Account;'));

    expect(await run(getInputs())).toBe('SELECT Id FROM Account');
    expect(getActiveEditorText).toHaveBeenCalledWith(useSelection);
  });
});
