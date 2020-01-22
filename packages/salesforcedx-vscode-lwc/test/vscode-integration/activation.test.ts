import { fail } from 'assert';
import * as path from 'path';
import { assert, SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';

describe('Activation of the LWC Language Server', () => {
  it('Language Server should start when an LWC js file is opened', async () => {
    const lwcExtension: vscode.Extension<any> = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-lwc'
    ) as vscode.Extension<any>;

    if (!vscode.workspace.workspaceFolders) {
      fail('Test requires workspace folders');
      return;
    }

    vscode.workspace.workspaceFolders.forEach(async workspaceRoot => {
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

      assert.match(lwcExtension.isActive, true);
    });
  });

  it('Language Server should start when an LWC css file is opened', async () => {
    const lwcExtension: vscode.Extension<any> = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-lwc'
    ) as vscode.Extension<any>;

    if (!vscode.workspace.workspaceFolders) {
      fail('Test requires workspace folders');
      return;
    }

    vscode.workspace.workspaceFolders.forEach(async workspaceRoot => {
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

      assert.match(lwcExtension.isActive, true);
    });
  });

  it('Language Server should start when an LWC html file is opened', async () => {
    const lwcExtension: vscode.Extension<any> = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-lwc'
    ) as vscode.Extension<any>;

    if (!vscode.workspace.workspaceFolders) {
      fail('Test requires workspace folders');
      return;
    }

    vscode.workspace.workspaceFolders.forEach(async workspaceRoot => {
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

      assert.match(lwcExtension.isActive, true);
    });
  });

  it('Language Server should not start for files that are not LWC', async () => {
    const lwcExtension: vscode.Extension<any> = vscode.extensions.getExtension(
      'salesforce.salesforcedx-vscode-lwc'
    ) as vscode.Extension<any>;

    if (!vscode.workspace.workspaceFolders) {
      fail('Test requires workspace folders');
      return;
    }

    vscode.workspace.workspaceFolders.forEach(async workspaceRoot => {
      const filePath = path.join(workspaceRoot.uri.fsPath, 'sfdx-project.json');

      // Open a non lwc file
      await vscode.workspace.openTextDocument(filePath);

      assert.match(lwcExtension.isActive, false);
    });
  });

  it('Language Server should always start if the activation mode is set to "always"', async () => {
    const activationMode = getActivationModeForWorkspace();
    setActivationModeForWorkspace('always');

    try {
      const lwcExtension: vscode.Extension<
        any
      > = vscode.extensions.getExtension(
        'salesforce.salesforcedx-vscode-lwc'
      ) as vscode.Extension<any>;

      if (!vscode.workspace.workspaceFolders) {
        fail('Test requires workspace folders');
        return;
      }
      vscode.workspace.workspaceFolders.forEach(async workspaceRoot => {
        const filePath = path.join(
          workspaceRoot.uri.fsPath,
          'sfdx-project.json'
        );

        // Open a non lwc file
        await vscode.workspace.openTextDocument(filePath);

        assert.match(lwcExtension.isActive, true);
      });
    } finally {
      setActivationModeForWorkspace(activationMode);
    }
  });

  it('Language Servers should not start if the activation mode is seto to "off"', async () => {
    const activationMode = getActivationModeForWorkspace();
    setActivationModeForWorkspace('off');

    try {
      const lwcExtension: vscode.Extension<
        any
      > = vscode.extensions.getExtension(
        'salesforce.salesforcedx-vscode-lwc'
      ) as vscode.Extension<any>;

      if (!vscode.workspace.workspaceFolders) {
        fail('Test requires workspace folders');
        return;
      }

      vscode.workspace.workspaceFolders.forEach(async workspaceRoot => {
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

        assert.match(lwcExtension.isActive, false);
      });
    } finally {
      setActivationModeForWorkspace(activationMode);
    }
  });

  /**
   * These tests are for specific workspace types.
   *  - What are we testing in these workspaces? That the above conditions are true?
   *   - In that case we'll probably want to run all the tests above just against different workspaces
   *  - Are we testing specific functionality of the workspace?
   */
  // describe('SFDX Workspace Type', () => {
  //   // Only run when run against an Sfdx Workspace type?
  // });

  // describe('Sfdc Core Workspace Type', () => {
  //   // Only run when run against an Sfdc Core Workspace type
  // });

  // describe('Standard Workspace Type', () => {
  //   // Only run when run against a Standard Workspace type
  // });

  // describe('Standard Monorepo Workspace Type', () => {
  //   // Only run when run against a Standard Workspace type
  // });

  // describe('Unsupported Workspace Type', () => {
  //   // Only run when run against an Unsupported Workspace type
  // });

  // describe('Standard Workspace Type', () => {
  //   // Only run when run against a Standard Workspace type
  // });

  // describe('Multi Root Multi Workspace Types', () => {
  //   // Only run when run against Multi Root + Multi Type types
  // });
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
