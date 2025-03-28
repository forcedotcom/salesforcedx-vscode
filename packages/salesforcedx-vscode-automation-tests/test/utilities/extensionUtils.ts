/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Duration, log, pause } from './miscellaneous';
import * as utilities from './index';
import { executeQuickPick } from './commandPrompt';
import { By, Editor } from 'vscode-extension-tester';
import { expect } from 'chai';
import { getBrowser, getWorkbench } from './workbench';

export type ExtensionId =
  | 'salesforcedx-vscode'
  | 'salesforcedx-vscode-expanded'
  | 'salesforcedx-vscode-soql'
  | 'salesforcedx-einstein-gpt'
  | 'salesforcedx-vscode-core'
  | 'salesforcedx-vscode-apex'
  | 'salesforcedx-vscode-apex-debugger'
  | 'salesforcedx-vscode-apex-replay-debugger'
  | 'salesforcedx-vscode-lightning'
  | 'salesforcedx-vscode-lwc'
  | 'salesforcedx-vscode-visualforce';

export type Extension = {
  id: string;
  extensionPath: string;
  isActive: boolean;
  packageJSON: unknown;
};

export type ExtensionType = {
  extensionId: ExtensionId;
  name: string;
  vsixPath: string;
  shouldInstall: 'always' | 'never' | 'optional';
  shouldVerifyActivation: boolean;
};

export type ExtensionActivation = {
  extensionId: string;
  isPresent: boolean;
  version?: string;
  activationTime?: string;
  hasBug?: boolean;
  isActivationComplete?: boolean;
};

export type VerifyExtensionsOptions = {
  timeout?: number;
  interval?: number;
};

const VERIFY_EXTENSIONS_TIMEOUT = Duration.seconds(60);

export const extensions: ExtensionType[] = [
  {
    extensionId: 'salesforcedx-vscode',
    name: 'Salesforce Extension Pack',
    vsixPath: '',
    shouldInstall: 'never',
    shouldVerifyActivation: false
  },
  {
    extensionId: 'salesforcedx-vscode-expanded',
    name: 'Salesforce Extension Pack (Expanded)',
    vsixPath: '',
    shouldInstall: 'never',
    shouldVerifyActivation: false
  },
  {
    extensionId: 'salesforcedx-vscode-soql',
    name: 'SOQL',
    vsixPath: '',
    shouldInstall: 'optional',
    shouldVerifyActivation: true
  },
  {
    extensionId: 'salesforcedx-einstein-gpt',
    name: 'Einstein for Developers (Beta)',
    vsixPath: '',
    shouldInstall: 'optional',
    shouldVerifyActivation: false
  },
  {
    extensionId: 'salesforcedx-vscode-core',
    name: 'Salesforce CLI Integration',
    vsixPath: '',
    shouldInstall: 'always',
    shouldVerifyActivation: true
  },
  {
    extensionId: 'salesforcedx-vscode-apex',
    name: 'Apex',
    vsixPath: '',
    shouldInstall: 'always',
    shouldVerifyActivation: true
  },
  {
    extensionId: 'salesforcedx-vscode-apex-debugger',
    name: 'Apex Interactive Debugger',
    vsixPath: '',
    shouldInstall: 'optional',
    shouldVerifyActivation: true
  },
  {
    extensionId: 'salesforcedx-vscode-apex-replay-debugger',
    name: 'Apex Replay Debugger',
    vsixPath: '',
    shouldInstall: 'optional',
    shouldVerifyActivation: true
  },
  {
    extensionId: 'salesforcedx-vscode-lightning',
    name: 'Lightning Web Components',
    vsixPath: '',
    shouldInstall: 'optional',
    shouldVerifyActivation: true
  },
  {
    extensionId: 'salesforcedx-vscode-lwc',
    name: 'Lightning Web Components',
    vsixPath: '',
    shouldInstall: 'optional',
    shouldVerifyActivation: true
  },
  {
    extensionId: 'salesforcedx-vscode-visualforce',
    name: 'salesforcedx-vscode-visualforce',
    vsixPath: '',
    shouldInstall: 'optional',
    shouldVerifyActivation: true
  }
];

export async function showRunningExtensions(): Promise<Editor | undefined> {
  log('');
  log(`Starting showRunningExtensions()...`);
  await executeQuickPick('Developer: Show Running Extensions');
  let re: Editor | undefined = undefined;
  await getBrowser().wait(
    async () => {
      const wb = getWorkbench();
      const ev = wb.getEditorView();
      re = await ev.openEditor('Running Extensions');
      return re.isDisplayed();
    },
    5000, // Timeout after 5 seconds
    'Expected "Running Extensions" tab to be visible after 5 seconds',
    500
  );
  log(`... Finished showRunningExtensions()`);
  log('');
  return re;
}

export async function reloadAndEnableExtensions(): Promise<void> {
  await utilities.reloadWindow();
  await utilities.enableAllExtensions();
}

export function getExtensionsToVerifyActive(
  predicate: (ext: ExtensionType) => boolean = ext => !!ext
): ExtensionType[] {
  return extensions
    .filter(ext => {
      return ext.shouldVerifyActivation;
    })
    .filter(predicate);
}

export async function verifyExtensionsAreRunning(extensions: ExtensionType[], timeout = VERIFY_EXTENSIONS_TIMEOUT) {
  log('');
  log(`Starting verifyExtensionsAreRunning()...`);
  if (extensions.length === 0) {
    log('verifyExtensionsAreRunning - No extensions to verify, continuing test run w/o extension verification');
    return true;
  }

  const extensionsToVerify = extensions.map(extension => extension.extensionId);

  await pause(Duration.seconds(15));
  await utilities.zoom('Out', 4, Duration.seconds(1));

  let extensionsStatus: ExtensionActivation[] = [];
  let allActivated = false;

  const timeoutPromise = new Promise<boolean>((_, reject) =>
    setTimeout(() => reject(new Error('findExtensionsInRunningExtensionsList timeout')), timeout.milliseconds)
  );

  try {
    await Promise.race([
      (async () => {
        do {
          extensionsStatus = await findExtensionsInRunningExtensionsList(extensionsToVerify);

          // Log the current state of the activation check for each extension
          for (const extensionStatus of extensionsStatus) {
            log(
              // prettier-ignore
              `Extension ${extensionStatus.extensionId}: ${extensionStatus.activationTime ?? 'Not activated'}`
            );
          }

          allActivated = extensionsToVerify.every(
            extensionId =>
              extensionsStatus.find(extensionStatus => extensionStatus.extensionId === extensionId)
                ?.isActivationComplete
          );
        } while (!allActivated);
      })(),
      timeoutPromise
    ]);
  } catch (error) {
    log(`Error while waiting for extensions to activate: ${error}`);
  }

  await utilities.zoomReset();

  log('... Finished verifyExtensionsAreRunning()');
  log('');

  return allActivated;
}

export async function findExtensionsInRunningExtensionsList(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extensionIds: string[]
): Promise<ExtensionActivation[]> {
  log('');
  log('Starting findExtensionsInRunningExtensionsList()...');
  // This function assumes the Extensions list was opened.

  // Close the panel and clear notifications so we can see as many of the running extensions as we can.
  try {
    const center = await getWorkbench().openNotificationsCenter();
    await center.clearAllNotifications();
    await center.close();
  } catch (error) {
    if (error instanceof Error) {
      log(`Failed clearing all notifications ${error.message}`);
    }
  }
  const runningExtensionsEditor = await showRunningExtensions();
  if (!runningExtensionsEditor) {
    throw new Error('Could not find the running extensions editor');
  }
  // Get all extensions
  const allExtensions = await runningExtensionsEditor.findElements(By.css('div.monaco-list-row > div.extension'));

  const runningExtensions: ExtensionActivation[] = [];
  for (const extension of allExtensions) {
    const parent = await extension.findElement(By.xpath('..'));
    const extensionId = await parent.getAttribute('aria-label');
    const version = await extension.findElement(By.css('.version')).getText();
    const activationTime = await extension.findElement(By.css('.activation-time')).getText();
    const isActivationComplete = /\:\s*?[0-9]{1,}ms/.test(activationTime);
    let hasBug;
    try {
      const bugError = await parent.findElement(By.css('span.codicon-bug error'));
    } catch (error: any) {
      hasBug = error.message.startsWith('no such element') ? false : true;
    }
    runningExtensions.push({
      extensionId,
      activationTime,
      version,
      isPresent: true,
      hasBug,
      isActivationComplete
    });
  }

  log('... Finished findExtensionsInRunningExtensionsList()');
  log('');
  // limit runningExtensions to those whose property extensionId is in the list of extensionIds
  return runningExtensions.filter(extension => extensionIds.includes(extension.extensionId));
}

export async function checkForUncaughtErrors(): Promise<void> {
  await utilities.showRunningExtensions();

  // Zoom out so all the extensions are visible
  await utilities.zoom('Out', 4, utilities.Duration.seconds(1));

  const uncaughtErrors = (
    await utilities.findExtensionsInRunningExtensionsList(
      utilities.getExtensionsToVerifyActive().map(ext => ext.extensionId)
    )
  ).filter(ext => ext.hasBug);

  await utilities.zoomReset();

  uncaughtErrors.forEach(ext => {
    utilities.log(`Extension ${ext.extensionId}:${ext.version ?? 'unknown'} has a bug`);
  });

  expect(uncaughtErrors.length).equal(0);
}
