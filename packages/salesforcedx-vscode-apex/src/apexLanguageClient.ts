import * as vscode from 'vscode';
import {
  Disposable,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions
} from 'vscode-languageclient';
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
