import { expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';

describe('Activation of the LWC Language Server', () => {
  let lwcExtension: vscode.Extension<any>;
  let originalActivationMode: string;

  beforeEach(() => {
    lwcExtension = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-lwc'
    ) as vscode.Extension<any>;

    originalActivationMode = getActivationModeForWorkspace();
  });

  afterEach(() => {
    setActivationModeForWorkspace(originalActivationMode);
  });

  async function forEachWorkspace(callback: any) {
    if (!vscode.workspace.workspaceFolders) {
      return;
    }
    for (const workspace of vscode.workspace.workspaceFolders) {
      await callback(workspace);
    }
  }

  it('Language Server should start when an LWC js file is opened', async () => {
    if (!vscode.workspace.workspaceFolders) {
      expect.fail('Test requires workspace folders');
      return;
    }

    await forEachWorkspace(async (workspaceRoot: vscode.WorkspaceFolder) => {
      const filePath = path.join(
        workspaceRoot.uri.fsPath,
        'force-app',
        'main',
        'default',
        'lwc',
        'demoLwcComponent',
        'demoLwcComponent.js'
      );

      // Open an LWC js file
      await vscode.workspace.openTextDocument(filePath);

      expect(lwcExtension.isActive).to.be.equal(true);
    });
  });

  it('Language Server should start when an LWC css file is opened', async () => {
    if (!vscode.workspace.workspaceFolders) {
      expect.fail('Test requires workspace folders');
      return;
    }

    await forEachWorkspace(async (workspaceRoot: vscode.WorkspaceFolder) => {
      const filePath = path.join(
        workspaceRoot.uri.fsPath,
        'force-app',
        'main',
        'default',
        'lwc',
        'demoLwcComponent',
        'demoLwcComponent.css'
      );

      // Open an LWC css file
      await vscode.workspace.openTextDocument(filePath);

      expect(lwcExtension.isActive).to.be.equal(true);
    });
  });

  it('Language Server should start when an LWC html file is opened', async () => {
    if (!vscode.workspace.workspaceFolders) {
      expect.fail('Test requires workspace folders');
      return;
    }

    await forEachWorkspace(async (workspaceRoot: vscode.WorkspaceFolder) => {
      const filePath = path.join(
        workspaceRoot.uri.fsPath,
        'force-app',
        'main',
        'default',
        'lwc',
        'demoLwcComponent',
        'demoLwcComponent.html'
      );

      // Open an LWC HTML file
      await vscode.workspace.openTextDocument(filePath);

      expect(lwcExtension.isActive).to.be.equal(true);
    });
  });

  it.skip('Language Server should not start for files that are not LWC', async () => {
    if (!vscode.workspace.workspaceFolders) {
      expect.fail('Test requires workspace folders');
      return;
    }

    await forEachWorkspace(async (workspaceRoot: vscode.WorkspaceFolder) => {
      const filePath = path.join(workspaceRoot.uri.fsPath, 'sfdx-project.json');

      // Open a non lwc file
      await vscode.workspace.openTextDocument(filePath);

      expect(lwcExtension.isActive).to.be.equal(false);
    });
  });

  it('Language Server should always start if the activation mode is set to "always"', async () => {
    setActivationModeForWorkspace('always');

    if (!vscode.workspace.workspaceFolders) {
      expect.fail('Test requires workspace folders');
      return;
    }
    await forEachWorkspace(async (workspaceRoot: vscode.WorkspaceFolder) => {
      const filePath = path.join(workspaceRoot.uri.fsPath, 'sfdx-project.json');

      // Open a non lwc file
      await vscode.workspace.openTextDocument(filePath);

      expect(lwcExtension.isActive).to.be.equal(true);
    });
  });

  it.skip('Language Servers should not start if the activation mode is seto to "off"', async () => {
    setActivationModeForWorkspace('off');

    if (!vscode.workspace.workspaceFolders) {
      expect.fail('Test requires workspace folders');
      return;
    }

    await forEachWorkspace(async (workspaceRoot: vscode.WorkspaceFolder) => {
      const filePath = path.join(
        workspaceRoot.uri.fsPath,
        'force-app',
        'main',
        'default',
        'lwc',
        'demoLwcComponent',
        'demoLwcComponent.html'
      );

      // Open a non lwc file
      await vscode.workspace.openTextDocument(filePath);

      expect(lwcExtension.isActive).to.be.equal(false);
    });
  });
});

/**
 * Helper to set the activation mode.
 * @param newMode Mode to set the activation to. Applicable values include "always", "off", "autodetect", or undefined. undefined unsets the configuration value.
 */
function setActivationModeForWorkspace(newMode: string | undefined) {
  const config = vscode.workspace.getConfiguration(
    'salesforcedx-vscode-lightning'
  );
  return config.update('activationMode', newMode);
}

/**
 * Helper to set the activation mode from the workspace configuration object.
 * Values including "always", "off", "autodetect" or undefined
 *
 * @default autodetect
 */
function getActivationModeForWorkspace(): string {
  const config = vscode.workspace.getConfiguration(
    'salesforcedx-vscode-lightning'
  );
  return config.get('activationMode') || 'autodetect'; // default to autodetect
}
