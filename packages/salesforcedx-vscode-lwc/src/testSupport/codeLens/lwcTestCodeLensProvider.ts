/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  EventEmitter,
  ExtensionContext,
  extensions,
  languages,
  TextDocument,
  window
} from 'vscode';

import { nls } from '../../messages';
import { LWC_JEST_RUNNER_DUPLICATE_LENS_NOTICE_DISMISSED, LWC_TEST_DOCUMENT_SELECTOR } from '../types/constants';
import { provideLwcTestCodeLens } from './provideLwcTestCodeLens';

/**
 * Code Lens Provider providing "Run Test" and "Debug Test" code lenses in LWC tests.
 */
class LwcTestCodeLensProvider implements CodeLensProvider {
  private onDidChangeCodeLensesEventEmitter = new EventEmitter<void>();
  public onDidChangeCodeLenses = this.onDidChangeCodeLensesEventEmitter.event;
  private notifiedThisSession = false;

  constructor(private readonly context: ExtensionContext) {}

  /**
   * Refresh code lenses
   */
  public refresh(): void {
    this.onDidChangeCodeLensesEventEmitter.fire();
  }

  /**
   * Invoked by VS Code to provide code lenses
   * @param document text document
   * @param token cancellation token
   */
  public provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] {
    const lenses = provideLwcTestCodeLens(document, token);

    // Show one-time notification if Jest Runner is active and we're showing lenses
    if (lenses.length > 0) {
      void this.maybeNotifyJestRunnerDuplicate();
    }

    return lenses;
  }

  /**
   * Show a one-time notification when Jest Runner extension is active
   */
  private maybeNotifyJestRunnerDuplicate(): void {
    // Check if Jest Runner is active
    if (extensions.getExtension('firsttris.vscode-jest-runner')?.isActive !== true) {
      return;
    }

    // Check if already dismissed via globalState
    if (this.context.globalState.get<boolean>(LWC_JEST_RUNNER_DUPLICATE_LENS_NOTICE_DISMISSED) === true) {
      return;
    }

    // Check if already notified this session
    if (this.notifiedThisSession) {
      return;
    }

    // Mark as notified this session
    this.notifiedThisSession = true;

    // Show notification (non-blocking)
    const dontShowAgain = nls.localize('jest_runner_dont_show_again_button');
    void window
      .showInformationMessage(nls.localize('jest_runner_duplicate_codelens_message'), dontShowAgain)
      .then(choice => {
        if (choice === dontShowAgain) {
          void this.context.globalState.update(LWC_JEST_RUNNER_DUPLICATE_LENS_NOTICE_DISMISSED, true);
        }
      });
  }
}

let lwcTestCodeLensProvider: LwcTestCodeLensProvider;

/**
 * Register Code Lens Provider with the extension context
 * @param extensionContext Extension context
 */
export const registerLwcTestCodeLensProvider = (extensionContext: ExtensionContext) => {
  // Create provider with context
  lwcTestCodeLensProvider = new LwcTestCodeLensProvider(extensionContext);

  extensionContext.subscriptions.push(
    languages.registerCodeLensProvider(LWC_TEST_DOCUMENT_SELECTOR, lwcTestCodeLensProvider)
  );
};

/**
 * Get the current provider instance (for testing or refresh)
 */
export const getLwcTestCodeLensProvider = (): LwcTestCodeLensProvider | undefined => lwcTestCodeLensProvider;
