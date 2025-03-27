"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveExpectedNumTestsFromSidebar = retrieveExpectedNumTestsFromSidebar;
exports.getTestsSection = getTestsSection;
exports.runTestCaseFromSideBar = runTestCaseFromSideBar;
exports.verifyTestIconColor = verifyTestIconColor;
exports.verifyTestItemsInSideBar = verifyTestItemsInSideBar;
exports.continueDebugging = continueDebugging;
const vscode_extension_tester_1 = require("vscode-extension-tester");
const chai_1 = require("chai");
const notifications_1 = require("./notifications");
const outputView_1 = require("./outputView");
const terminalView_1 = require("./terminalView");
const miscellaneous_1 = require("./miscellaneous");
async function retrieveExpectedNumTestsFromSidebar(expectedNumTests, testsSection, actionLabel) {
    let testsItems = (await testsSection.getVisibleItems());
    // If the tests did not show up, click the refresh button on the top right corner of the Test sidebar
    for (let x = 0; x < 3; x++) {
        if (testsItems.length === 1) {
            await testsSection.click();
            const refreshAction = await testsSection.getAction(actionLabel);
            if (!refreshAction) {
                throw new Error('Could not find debug tests action button');
            }
            await refreshAction.click();
            await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(10));
            testsItems = (await testsSection.getVisibleItems());
        }
        else if (testsItems.length === expectedNumTests) {
            break;
        }
    }
    return testsItems;
}
async function getTestsSection(workbench, type) {
    const sidebar = workbench.getSideBar();
    const sidebarView = sidebar.getContent();
    const testsSection = await sidebarView.getSection(type);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    (0, chai_1.expect)(testsSection).to.not.be.undefined;
    return testsSection;
}
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
async function runTestCaseFromSideBar(workbench, testSuite, testName, actionLabel) {
    (0, miscellaneous_1.log)(`Running ${testSuite} - ${testName} - ${actionLabel} from SideBar`);
    const testingView = await workbench.getActivityBar().getViewControl('Testing');
    (0, chai_1.expect)(testingView).to.not.be.undefined;
    // Open the Test Sidebar
    const testingSideBarView = await testingView?.openView();
    (0, chai_1.expect)(testingSideBarView).to.be.instanceOf(vscode_extension_tester_1.SideBarView);
    // Select test
    const testSection = await getTestsSection(workbench, testSuite);
    const testItem = (await testSection.findItem(testName));
    (0, chai_1.expect)(testItem).to.not.be.undefined;
    await testItem.select();
    // Click button to run test
    const actionButton = await testItem.getActionButton(actionLabel);
    (0, chai_1.expect)(actionButton).to.not.be.undefined;
    await actionButton?.click();
    let testResult;
    if (testSuite === 'Apex Tests') {
        // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
        let successNotificationWasFound;
        try {
            successNotificationWasFound = await (0, notifications_1.notificationIsPresentWithTimeout)('SFDX: Run Apex Tests successfully ran', miscellaneous_1.Duration.TEN_MINUTES);
            (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        }
        catch (error) {
            await workbench.openNotificationsCenter();
            successNotificationWasFound = await (0, notifications_1.notificationIsPresentWithTimeout)('SFDX: Run Apex Tests successfully ran', miscellaneous_1.Duration.ONE_MINUTE);
            (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        }
        testResult = await (0, outputView_1.attemptToFindOutputPanelText)('Apex', '=== Test Results', 10);
    }
    else if (testSuite === 'LWC Tests') {
        testResult = await (0, terminalView_1.getTerminalViewText)(workbench, 15);
    }
    await verifyTestIconColor(testItem, 'testPass');
    return testResult;
}
/**
 * Verifies the color of the test icon in the sidebar to ensure it reflects the correct test status.
 *
 * @param {TreeItem} testItem - The test item whose icon color needs to be verified. It represents a node in the sidebar tree view.
 * @param {string} colorLabel - The expected color label (e.g., 'testPass', 'testNotRun') that indicates the test status.
 *
 * @example
 * await verifyTestIconColor(myTestItem, 'testPass'); // Verifies the icon is green for a passing test
 */
async function verifyTestIconColor(testItem, colorLabel) {
    (0, miscellaneous_1.log)(`Verifying icon's colors - verifyTestIconColor()`);
    // Verify the tests that are passing are labeled with a green dot on the Test sidebar
    const icon = await testItem.findElement(vscode_extension_tester_1.By.css('.custom-view-tree-node-item-icon'));
    const iconStyle = await icon.getAttribute('style');
    // Try/catch used to get around arbitrary flaky failure on Ubuntu in remote
    try {
        (0, chai_1.expect)(iconStyle).to.include(colorLabel);
    }
    catch {
        (0, miscellaneous_1.log)(`ERROR: icon color label not ${colorLabel}`);
    }
}
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
async function verifyTestItemsInSideBar(testsSection, refreshCommand, expectedItems, expectedNumTests, expectedNumClasses) {
    (0, miscellaneous_1.log)('Starting verifyTestItemsInSideBar()');
    const testsItems = await retrieveExpectedNumTestsFromSidebar(expectedNumTests, testsSection, refreshCommand);
    const isLWCSection = refreshCommand.includes('Lightning');
    if (isLWCSection) {
        (0, miscellaneous_1.log)('Expanding LWC Tests');
        // Expand tests
        for (let x = 0; x < expectedNumClasses; x++) {
            await testsItems[x].expand();
        }
    }
    // Make sure all the tests are present in the sidebar
    (0, chai_1.expect)(testsItems.length).to.equal(isLWCSection ? expectedNumClasses : expectedNumTests);
    for (const item of expectedItems) {
        (0, chai_1.expect)(await testsSection.findItem(item)).to.not.be.undefined;
    }
    return testsItems;
}
async function continueDebugging(times, seconds = 5) {
    const bar = await vscode_extension_tester_1.DebugToolbar.create();
    // Continue with the debug session
    for (let i = 0; i < times; i++) {
        await bar.continue();
        await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(seconds));
    }
}
//# sourceMappingURL=testUtils.js.map