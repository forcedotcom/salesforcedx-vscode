import { Duration } from './miscellaneous';
import { OutputView } from 'vscode-extension-tester';
export declare function selectOutputChannel(name: string): Promise<OutputView>;
export declare function getOutputViewText(outputChannelName?: string): Promise<string>;
/**
 * Verifies that the output panel contains all expected text snippets.
 *
 * @param {string} outputPanelText - The output panel text as a string that needs to be verified.
 * @param {string[]} expectedTexts - An array of strings representing the expected text snippets that should be present in the output panel.
 *
 * @example
 * await verifyOutputPanelText(
 *   testResult,
 *   [
 *     '=== Test Summary',
 *     'Outcome              Passed',
 *     'Tests Ran            1',
 *     'Pass Rate            100%',
 *     'TEST NAME',
 *     'ExampleTest1  Pass',
 *     'ended SFDX: Run Apex Tests'
 *   ]
 * );
 */
export declare function verifyOutputPanelText(outputPanelText: string, expectedTexts: string[]): Promise<void>;
export declare function attemptToFindOutputPanelText(outputChannelName: string, searchString: string, attempts: number): Promise<string | undefined>;
export declare function getOperationTime(outputText: string): Promise<string>;
export declare function clearOutputView(wait?: Duration): Promise<void>;
