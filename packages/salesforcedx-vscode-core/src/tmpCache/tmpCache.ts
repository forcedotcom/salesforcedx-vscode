import * as vscode from 'vscode';

export class TmpCacheService {
  private static instance: TmpCacheService;
  private context: vscode.ExtensionContext | undefined;

  public static getInstance() {
    if (!TmpCacheService.instance) {
      TmpCacheService.instance = new TmpCacheService();
    }
    return TmpCacheService.instance;
  }

  public initializeService(context: vscode.ExtensionContext): void {
    this.context = context;
  }

  public getValue(key: string): any {
    if (this.context === undefined) {
      return undefined;
    }
    // if cache has a value, verify if it's still valid
    // if cached value has expired, remove it from cache and return undefined
    return this.context.globalState.get(key);
  }

  public setValue(key: string, value: any): void {
    if (this.context === undefined) {
      return;
    }
    // TODO: add an expiration date utc field as part of the value
    this.context.globalState.update(key, value);
  }
}
