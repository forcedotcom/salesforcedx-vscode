import * as vscode from 'vscode';

export function useApexLibrary(): boolean {
  return vscode.workspace
    .getConfiguration('salesforcedx-vscode-core')
    .get<boolean>('experimental.useApexLibrary', true);
}
