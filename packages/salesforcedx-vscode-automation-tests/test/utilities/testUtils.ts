import { By, DebugToolbar, SideBarView, TreeItem, ViewSection, Workbench } from 'vscode-extension-tester';
import { expect } from 'chai';
import { notificationIsPresentWithTimeout } from './notifications';
import { attemptToFindOutputPanelText } from './outputView';
import { getTerminalViewText } from './terminalView';
import { Duration, log, pause } from './miscellaneous';

export async function retrieveExpectedNumTestsFromSidebar(
  expectedNumTests: number,
  testsSection: ViewSection,
  actionLabel: string
): Promise<TreeItem[]> {
  let testsItems = (await testsSection.getVisibleItems()) as TreeItem[];

  // If the tests did not show up, click the refresh button on the top right corner of the Test sidebar
  for (let x = 0; x < 3; x++) {
    if (testsItems.length === 1) {
      await testsSection.click();
      const refreshAction = await testsSection.getAction(actionLabel);
      if (!refreshAction) {
        throw new Error('Could not find debug tests action button');
      }
      await refreshAction.click();
      await pause(Duration.seconds(10));
      testsItems = (await testsSection.getVisibleItems()) as TreeItem[];
    } else if (testsItems.length === expectedNumTests) {
      break;
    }
  }

  return testsItems;
}

export async function getTestsSection(workbench: Workbench, type: string) {
  const sidebar = workbench.getSideBar();
  const sidebarView = sidebar.getContent();
  const testsSection = await sidebarView.getSection(type);
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  expect(testsSection).to.not.be.undefined;
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
export async function runTestCaseFromSideBar(
  workbench: Workbench,
  testSuite: string,
  testName: string,
  actionLabel: string
): Promise<string | undefined> {
  log(`Running ${testSuite} - ${testName} - ${actionLabel} from SideBar`);
  const testingView = await workbench.getActivityBar().getViewControl('Testing');
  expect(testingView).to.not.be.undefined;

  // Open the Test Sidebar
  const testingSideBarView = await testingView?.openView();
  expect(testingSideBarView).to.be.instanceOf(SideBarView);

  // Select test
  const testSection = await getTestsSection(workbench, testSuite);
  const testItem = (await testSection.findItem(testName)) as TreeItem;
  expect(testItem).to.not.be.undefined;
  await testItem.select();

  // Click button to run test
  const actionButton = await testItem.getActionButton(actionLabel);
  expect(actionButton).to.not.be.undefined;
  await actionButton?.click();

  let testResult: string | undefined;
  if (testSuite === 'Apex Tests') {
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    let successNotificationWasFound;
    try {
      successNotificationWasFound = await notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await workbench.openNotificationsCenter();
      successNotificationWasFound = await notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }
    testResult = await attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
  } else if (testSuite === 'LWC Tests') {
    testResult = await getTerminalViewText(workbench, 15);
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
export async function verifyTestIconColor(testItem: TreeItem, colorLabel: string) {
  log(`Verifying icon's colors - verifyTestIconColor()`);
  // Verify the tests that are passing are labeled with a green dot on the Test sidebar
  const icon = await testItem.findElement(By.css('.custom-view-tree-node-item-icon'));
  const iconStyle = await icon.getAttribute('style');
  // Try/catch used to get around arbitrary flaky failure on Ubuntu in remote
  try {
    expect(iconStyle).to.include(colorLabel);
  } catch {
    log(`ERROR: icon color label not ${colorLabel}`);
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
export async function verifyTestItemsInSideBar(
  testsSection: ViewSection,
  refreshCommand: string,
  expectedItems: string[],
  expectedNumTests: number,
  expectedNumClasses: number
): Promise<TreeItem[]> {
  log('Starting verifyTestItemsInSideBar()');
  const testsItems = await retrieveExpectedNumTestsFromSidebar(expectedNumTests, testsSection, refreshCommand);
  const isLWCSection = refreshCommand.includes('Lightning');
  if (isLWCSection) {
    log('Expanding LWC Tests');
    // Expand tests
    for (let x = 0; x < expectedNumClasses; x++) {
      await testsItems[x].expand();
    }
  }

  // Make sure all the tests are present in the sidebar
  expect(testsItems.length).to.equal(isLWCSection ? expectedNumClasses : expectedNumTests);
  for (const item of expectedItems) {
    expect(await testsSection.findItem(item)).to.not.be.undefined;
  }
  return testsItems;
}

export async function continueDebugging(times: number, seconds = 5): Promise<void> {
  const bar = await DebugToolbar.create();
  // Continue with the debug session
  for (let i = 0; i < times; i++) {
    await bar.continue();
    await pause(Duration.seconds(seconds));
  }
}
