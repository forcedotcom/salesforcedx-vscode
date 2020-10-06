/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  Command,
  EventEmitter,
  ExtensionContext,
  languages,
  Position,
  Range,
  TextDocument
} from 'vscode';
import { nls } from '../../messages';
import { FUNCTION_PAYLOAD_DOCUMENT_SELECTOR } from './types/constants';

/**
 * Code Lens Provider providing "Invoke"
 */
class ForceFunctionInvokeCodeLensProvider implements CodeLensProvider {
  private onDidChangeCodeLensesEventEmitter = new EventEmitter<void>();
  public onDidChangeCodeLenses = this.onDidChangeCodeLensesEventEmitter.event;

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
  public async provideCodeLenses(
    document: TextDocument,
    token: CancellationToken
  ): Promise<CodeLens[]> {
    return provideFunctionInvokeCodeLens(document, token);
  }
}

export const functionInvokeCodeLensProvider = new ForceFunctionInvokeCodeLensProvider();

/**
 * Register Code Lens Provider with the extension context
 * @param context Extension context
 */
export function registerFunctionInvokeCodeLensProvider(
  context: ExtensionContext
) {
  context.subscriptions.push(
    languages.registerCodeLensProvider(
      FUNCTION_PAYLOAD_DOCUMENT_SELECTOR,
      functionInvokeCodeLensProvider
    )
  );
}

export async function provideFunctionInvokeCodeLens(
  document: TextDocument,
  token: CancellationToken
): Promise<CodeLens[]> {
  const nonpayloadJsons = [
    'package.json',
    'package-lock.json',
    'tslint.json',
    'lerna.json',
    'tsconfig.json'
  ];
  if (nonpayloadJsons.includes(path.basename(document.uri.fsPath))) {
    return [];
  }
  const range = new Range(new Position(0, 0), new Position(0, 1));

  const commandTitle = nls.localize('force_function_invoke_tooltip');
  const functionInvokeCommand: Command = {
    command: 'sfdx.force.function.invoke',
    title: commandTitle,
    tooltip: commandTitle,
    arguments: [document.uri]
  };
  const invokeCodeLens = new CodeLens(range, functionInvokeCommand);

  // TODO: i18n
  const debugCommandTitle = 'Debug Send Request';
  const functionDebugInvokeCommand: Command = {
    command: 'sfdx.force.function.debugInvoke',
    title: debugCommandTitle,
    tooltip: debugCommandTitle,
    arguments: [document.uri]
  };
  const debugInvokeCodeLens = new CodeLens(range, functionDebugInvokeCommand);

  return [invokeCodeLens, debugInvokeCodeLens];
}
