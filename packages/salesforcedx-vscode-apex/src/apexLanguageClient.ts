import {
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
    serverOptions: ServerOptions,
    clientOptions: LanguageClientOptions,
    forceDebug?: boolean
  ) {
    clientOptions.errorHandler = new ApexErrorHandler();
    super(id, name, serverOptions, clientOptions, forceDebug);
    this._errorHandler = clientOptions.errorHandler as ApexErrorHandler;
  }

  public get errorHandler(): ApexErrorHandler | undefined {
    return this._errorHandler;
  }
}
