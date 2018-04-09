import * as vscode from 'vscode';

export async function callExternalCommand(
  extensionId: string,
  command: string
) {
  const externalExtension = vscode.extensions.getExtension(extensionId);

  // is the ext loaded and ready?
  if (externalExtension && externalExtension.isActive === false) {
    externalExtension.activate().then(
      function() {
        console.log('External extension activated');
        vscode.commands.executeCommand(command);
      },
      function() {
        console.log('External extension activation failed');
      }
    );
  } else {
    vscode.commands.executeCommand(command);
  }
}
