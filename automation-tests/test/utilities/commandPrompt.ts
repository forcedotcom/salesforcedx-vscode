/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  InputBox,
  QuickOpenBox,
  Workbench
} from 'wdio-vscode-service';
import {
  pause
} from './miscellaneous';

export async function openCommandPromptWithCommand(workbench: Workbench, command: string): Promise<InputBox | QuickOpenBox> {
  const prompt = await workbench.openCommandPrompt();
  await pause(5);

  await prompt.setText(`>${command}`);
  await pause(2);

  return prompt;
}

export async function runCommandFromCommandPrompt(workbench: Workbench, command: string, durationInSeconds: number = 0): Promise<InputBox | QuickOpenBox> {
  const prompt = await openCommandPromptWithCommand(workbench, command);
  await selectQuickPickItem(prompt, command);

  if (durationInSeconds > 0) {
    await pause(durationInSeconds);
  }

  return prompt;
}

export async function selectQuickPickItem(prompt: InputBox | QuickOpenBox, text: string): Promise<void> {
  const quickPicks = await prompt.getQuickPicks();
  for (const quickPick of quickPicks) {
      const label = await quickPick.getLabel();
      if (label === text) {
          await quickPick.select();
          return;
      }
  }

  throw new Error(`Quick pick item ${text} was not found`);
}

export async function clickFilePathOkButton(): Promise<void> {
  const okButton = await $('*:not([style*="display: none"]).quick-input-action .monaco-button');
  await okButton.click();
  await pause(1);
}
