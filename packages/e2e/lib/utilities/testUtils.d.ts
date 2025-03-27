import { TreeItem, ViewSection, Workbench } from 'vscode-extension-tester';
export declare function retrieveExpectedNumTestsFromSidebar(expectedNumTests: number, testsSection: ViewSection, actionLabel: string): Promise<TreeItem[]>;
export declare function getTestsSection(workbench: Workbench, type: string): Promise<ViewSection>;
/**
 * Runs a test case from the sidebar and returns the test result.
 * *
 * @param {Workbench} workbench - The workbench instance used to interact with the sidebar and views.
 * @param {string} testSuite - The name of the test suite from which to run the test (e.g., 'Apex Tests', 'LWC Tests').
 * @param {string} testName - The name of the specific test case to run.
 * @param {string} actionLabel - The label of the action button to click (e.g., 'SFDX: Run Lightning Web Component Test File', 'Run Single Test').
 *
 * @example
 * const result = await runTestCaseFromSideBar(
 *   myWorkbench,
 *   'Apex Tests',
 *   'MyApexTestCase',
 *   'Run Single Test'
 * );
 * console.log(result); // Outputs the result from the Apex test run
 */
export declare function runTestCaseFromSideBar(workbench: Workbench, testSuite: string, testName: string, actionLabel: string): Promise<string | undefined>;
/**
 * Verifies the color of the test icon in the sidebar to ensure it reflects the correct test status.
 *
 * @param {TreeItem} testItem - The test item whose icon color needs to be verified. It represents a node in the sidebar tree view.
 * @param {string} colorLabel - The expected color label (e.g., 'testPass', 'testNotRun') that indicates the test status.
 *
 * @example
 * await verifyTestIconColor(myTestItem, 'testPass'); // Verifies the icon is green for a passing test
 */
export declare function verifyTestIconColor(testItem: TreeItem, colorLabel: string): Promise<void>;
/**
 * Verifies the presence of test items in the sidebar.
 * *
 * @param {ViewSection} testsSection - An instance of the view section representing the sidebar where test items are displayed.
 * @param {string} refreshCommand - The command used to refresh the sidebar to ensure it displays up-to-date information.
 * @param {string[]} expectedItems - An array of strings representing the expected test items that should be present in the sidebar.
 * @param {number} expectedNumTests - The expected number of tests to be displayed in the sidebar.
 * @param {number} expectedNumClasses - The expected number of test classes to be present in the sidebar.
 *
 * @example
 * await verifyTestItemsInSideBar(
 *   mySidebarSection,
 *   'Refresh Tests',
 *   ['Test Item 1', 'Test Item 2'],
 *   2,
 *   1
 * );
 */
export declare function verifyTestItemsInSideBar(testsSection: ViewSection, refreshCommand: string, expectedItems: string[], expectedNumTests: number, expectedNumClasses: number): Promise<TreeItem[]>;
export declare function continueDebugging(times: number, seconds?: number): Promise<void>;
