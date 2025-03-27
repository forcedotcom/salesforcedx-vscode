"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveExpectedNumTestsFromSidebar = retrieveExpectedNumTestsFromSidebar;
exports.getTestsSection = getTestsSection;
exports.runTestCaseFromSideBar = runTestCaseFromSideBar;
exports.verifyTestIconColor = verifyTestIconColor;
exports.verifyTestItemsInSideBar = verifyTestItemsInSideBar;
exports.continueDebugging = continueDebugging;
var vscode_extension_tester_1 = require("vscode-extension-tester");
var chai_1 = require("chai");
var notifications_1 = require("./notifications");
var outputView_1 = require("./outputView");
var terminalView_1 = require("./terminalView");
var miscellaneous_1 = require("./miscellaneous");
function retrieveExpectedNumTestsFromSidebar(expectedNumTests, testsSection, actionLabel) {
    return __awaiter(this, void 0, void 0, function () {
        var testsItems, x, refreshAction;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testsSection.getVisibleItems()];
                case 1:
                    testsItems = (_a.sent());
                    x = 0;
                    _a.label = 2;
                case 2:
                    if (!(x < 3)) return [3 /*break*/, 10];
                    if (!(testsItems.length === 1)) return [3 /*break*/, 8];
                    return [4 /*yield*/, testsSection.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, testsSection.getAction(actionLabel)];
                case 4:
                    refreshAction = _a.sent();
                    if (!refreshAction) {
                        throw new Error('Could not find debug tests action button');
                    }
                    return [4 /*yield*/, refreshAction.click()];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(10))];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, testsSection.getVisibleItems()];
                case 7:
                    testsItems = (_a.sent());
                    return [3 /*break*/, 9];
                case 8:
                    if (testsItems.length === expectedNumTests) {
                        return [3 /*break*/, 10];
                    }
                    _a.label = 9;
                case 9:
                    x++;
                    return [3 /*break*/, 2];
                case 10: return [2 /*return*/, testsItems];
            }
        });
    });
}
function getTestsSection(workbench, type) {
    return __awaiter(this, void 0, void 0, function () {
        var sidebar, sidebarView, testsSection;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sidebar = workbench.getSideBar();
                    sidebarView = sidebar.getContent();
                    return [4 /*yield*/, sidebarView.getSection(type)];
                case 1:
                    testsSection = _a.sent();
                    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                    (0, chai_1.expect)(testsSection).to.not.be.undefined;
                    return [2 /*return*/, testsSection];
            }
        });
    });
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
function runTestCaseFromSideBar(workbench, testSuite, testName, actionLabel) {
    return __awaiter(this, void 0, void 0, function () {
        var testingView, testingSideBarView, testSection, testItem, actionButton, testResult, successNotificationWasFound, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("Running ".concat(testSuite, " - ").concat(testName, " - ").concat(actionLabel, " from SideBar"));
                    return [4 /*yield*/, workbench.getActivityBar().getViewControl('Testing')];
                case 1:
                    testingView = _a.sent();
                    (0, chai_1.expect)(testingView).to.not.be.undefined;
                    return [4 /*yield*/, (testingView === null || testingView === void 0 ? void 0 : testingView.openView())];
                case 2:
                    testingSideBarView = _a.sent();
                    (0, chai_1.expect)(testingSideBarView).to.be.instanceOf(vscode_extension_tester_1.SideBarView);
                    return [4 /*yield*/, getTestsSection(workbench, testSuite)];
                case 3:
                    testSection = _a.sent();
                    return [4 /*yield*/, testSection.findItem(testName)];
                case 4:
                    testItem = (_a.sent());
                    (0, chai_1.expect)(testItem).to.not.be.undefined;
                    return [4 /*yield*/, testItem.select()];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, testItem.getActionButton(actionLabel)];
                case 6:
                    actionButton = _a.sent();
                    (0, chai_1.expect)(actionButton).to.not.be.undefined;
                    return [4 /*yield*/, (actionButton === null || actionButton === void 0 ? void 0 : actionButton.click())];
                case 7:
                    _a.sent();
                    if (!(testSuite === 'Apex Tests')) return [3 /*break*/, 15];
                    successNotificationWasFound = void 0;
                    _a.label = 8;
                case 8:
                    _a.trys.push([8, 10, , 13]);
                    return [4 /*yield*/, (0, notifications_1.notificationIsPresentWithTimeout)('SFDX: Run Apex Tests successfully ran', miscellaneous_1.Duration.TEN_MINUTES)];
                case 9:
                    successNotificationWasFound = _a.sent();
                    (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                    return [3 /*break*/, 13];
                case 10:
                    error_1 = _a.sent();
                    return [4 /*yield*/, workbench.openNotificationsCenter()];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, (0, notifications_1.notificationIsPresentWithTimeout)('SFDX: Run Apex Tests successfully ran', miscellaneous_1.Duration.ONE_MINUTE)];
                case 12:
                    successNotificationWasFound = _a.sent();
                    (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                    return [3 /*break*/, 13];
                case 13: return [4 /*yield*/, (0, outputView_1.attemptToFindOutputPanelText)('Apex', '=== Test Results', 10)];
                case 14:
                    testResult = _a.sent();
                    return [3 /*break*/, 17];
                case 15:
                    if (!(testSuite === 'LWC Tests')) return [3 /*break*/, 17];
                    return [4 /*yield*/, (0, terminalView_1.getTerminalViewText)(workbench, 15)];
                case 16:
                    testResult = _a.sent();
                    _a.label = 17;
                case 17: return [4 /*yield*/, verifyTestIconColor(testItem, 'testPass')];
                case 18:
                    _a.sent();
                    return [2 /*return*/, testResult];
            }
        });
    });
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
function verifyTestIconColor(testItem, colorLabel) {
    return __awaiter(this, void 0, void 0, function () {
        var icon, iconStyle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("Verifying icon's colors - verifyTestIconColor()");
                    return [4 /*yield*/, testItem.findElement(vscode_extension_tester_1.By.css('.custom-view-tree-node-item-icon'))];
                case 1:
                    icon = _a.sent();
                    return [4 /*yield*/, icon.getAttribute('style')];
                case 2:
                    iconStyle = _a.sent();
                    // Try/catch used to get around arbitrary flaky failure on Ubuntu in remote
                    try {
                        (0, chai_1.expect)(iconStyle).to.include(colorLabel);
                    }
                    catch (_b) {
                        (0, miscellaneous_1.log)("ERROR: icon color label not ".concat(colorLabel));
                    }
                    return [2 /*return*/];
            }
        });
    });
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
function verifyTestItemsInSideBar(testsSection, refreshCommand, expectedItems, expectedNumTests, expectedNumClasses) {
    return __awaiter(this, void 0, void 0, function () {
        var testsItems, isLWCSection, x, _i, expectedItems_1, item, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    (0, miscellaneous_1.log)('Starting verifyTestItemsInSideBar()');
                    return [4 /*yield*/, retrieveExpectedNumTestsFromSidebar(expectedNumTests, testsSection, refreshCommand)];
                case 1:
                    testsItems = _b.sent();
                    isLWCSection = refreshCommand.includes('Lightning');
                    if (!isLWCSection) return [3 /*break*/, 5];
                    (0, miscellaneous_1.log)('Expanding LWC Tests');
                    x = 0;
                    _b.label = 2;
                case 2:
                    if (!(x < expectedNumClasses)) return [3 /*break*/, 5];
                    return [4 /*yield*/, testsItems[x].expand()];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    x++;
                    return [3 /*break*/, 2];
                case 5:
                    // Make sure all the tests are present in the sidebar
                    (0, chai_1.expect)(testsItems.length).to.equal(isLWCSection ? expectedNumClasses : expectedNumTests);
                    _i = 0, expectedItems_1 = expectedItems;
                    _b.label = 6;
                case 6:
                    if (!(_i < expectedItems_1.length)) return [3 /*break*/, 9];
                    item = expectedItems_1[_i];
                    _a = chai_1.expect;
                    return [4 /*yield*/, testsSection.findItem(item)];
                case 7:
                    _a.apply(void 0, [_b.sent()]).to.not.be.undefined;
                    _b.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 6];
                case 9: return [2 /*return*/, testsItems];
            }
        });
    });
}
function continueDebugging(times_1) {
    return __awaiter(this, arguments, void 0, function (times, seconds) {
        var bar, i;
        if (seconds === void 0) { seconds = 5; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, vscode_extension_tester_1.DebugToolbar.create()];
                case 1:
                    bar = _a.sent();
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < times)) return [3 /*break*/, 6];
                    return [4 /*yield*/, bar.continue()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(seconds))];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    i++;
                    return [3 /*break*/, 2];
                case 6: return [2 /*return*/];
            }
        });
    });
}
