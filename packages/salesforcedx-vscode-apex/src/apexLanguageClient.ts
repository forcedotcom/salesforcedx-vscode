/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import { ApexErrorHandler } from './apexErrorHandler';

export class ApexLanguageClient extends LanguageClient {
  private _errorHandler: ApexErrorHandler | undefined;
  public constructor(
    id: string,
    name: string,
    private serverOptions: ServerOptions,
    clientOptions: LanguageClientOptions,
    forceDebug?: boolean
  ) {
    super(id, name, serverOptions, clientOptions, forceDebug);
    this._errorHandler = clientOptions.errorHandler as ApexErrorHandler;
  }

  public get errorHandler(): ApexErrorHandler | undefined {
    return this._errorHandler;
  }

  public async stop(): Promise<void> {
    await super.stop();
  }
}
