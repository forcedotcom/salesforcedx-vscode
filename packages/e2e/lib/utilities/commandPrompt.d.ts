import { Duration } from './miscellaneous';
import { InputBox, QuickOpenBox, Workbench } from 'vscode-extension-tester';
export declare function openCommandPromptWithCommand(workbench: Workbench, command: string): Promise<InputBox | QuickOpenBox>;
export declare function runCommandFromCommandPrompt(workbench: Workbench, command: string, durationInSeconds?: Duration): Promise<InputBox | QuickOpenBox>;
export declare function selectQuickPickWithText(prompt: InputBox | QuickOpenBox, text: string): Promise<void>;
export declare function selectQuickPickItem(prompt: InputBox | QuickOpenBox | undefined, text: string): Promise<void>;
export declare function findQuickPickItem(inputBox: InputBox | QuickOpenBox | undefined, quickPickItemTitle: string, useExactMatch: boolean, selectTheQuickPickItem: boolean): Promise<boolean>;
export declare function waitForQuickPick(prompt: InputBox | QuickOpenBox | undefined, pickListItem: string, options?: {
    msg?: string;
    timeout?: Duration;
}): Promise<void>;
/**
 * Runs exact command from command palette
 * @param command
 * @param wait - default is  1 second
 * @returns
 */
export declare function executeQuickPick(command: string, wait?: Duration): Promise<InputBox | QuickOpenBox>;
export declare function clickFilePathOkButton(): Promise<void>;
