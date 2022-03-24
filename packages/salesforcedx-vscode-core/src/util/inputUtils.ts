import * as vscode from 'vscode';

export async function getTrimmedString(projectNameInputOptions: vscode.InputBoxOptions) {
  const input = await vscode.window.showInputBox(
    projectNameInputOptions
  );
  return input ? input.trim() : input;
}
