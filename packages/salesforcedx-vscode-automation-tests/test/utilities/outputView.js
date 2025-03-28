"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
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
exports.selectOutputChannel = selectOutputChannel;
exports.getOutputViewText = getOutputViewText;
exports.verifyOutputPanelText = verifyOutputPanelText;
exports.attemptToFindOutputPanelText = attemptToFindOutputPanelText;
exports.getOperationTime = getOperationTime;
exports.clearOutputView = clearOutputView;
var miscellaneous_1 = require("./miscellaneous");
var notifications_1 = require("./notifications");
var commandPrompt_1 = require("./commandPrompt");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var chai_1 = require("chai");
function selectOutputChannel(name) {
    return __awaiter(this, void 0, void 0, function () {
        var outputView;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // Wait for all notifications to go away.  If there is a notification that is overlapping and hiding the Output channel's
                // dropdown menu, calling select.click() doesn't work, so dismiss all notifications first before clicking the dropdown
                // menu and opening it.
                return [4 /*yield*/, (0, notifications_1.dismissAllNotifications)()];
                case 1:
                    // Wait for all notifications to go away.  If there is a notification that is overlapping and hiding the Output channel's
                    // dropdown menu, calling select.click() doesn't work, so dismiss all notifications first before clicking the dropdown
                    // menu and opening it.
                    _a.sent();
                    return [4 /*yield*/, new vscode_extension_tester_1.BottomBarPanel().openOutputView()];
                case 2:
                    outputView = _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 3:
                    _a.sent();
                    if (!!!name) return [3 /*break*/, 5];
                    return [4 /*yield*/, outputView.selectChannel(name)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/, outputView];
            }
        });
    });
}
function getOutputViewText() {
    return __awaiter(this, arguments, void 0, function (outputChannelName) {
        var outputView;
        if (outputChannelName === void 0) { outputChannelName = ''; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, selectOutputChannel(outputChannelName)];
                case 1:
                    outputView = _a.sent();
                    // Set focus to the contents in the Output panel.
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('Output: Focus on Output View', miscellaneous_1.Duration.seconds(2))];
                case 2:
                    // Set focus to the contents in the Output panel.
                    _a.sent();
                    return [4 /*yield*/, outputView.getText()];
                case 3: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
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
function verifyOutputPanelText(outputPanelText, expectedTexts) {
    return __awaiter(this, void 0, void 0, function () {
        var _i, expectedTexts_1, expectedText;
        return __generator(this, function (_a) {
            (0, miscellaneous_1.log)("verifyOutputPanelText() - ".concat(outputPanelText));
            for (_i = 0, expectedTexts_1 = expectedTexts; _i < expectedTexts_1.length; _i++) {
                expectedText = expectedTexts_1[_i];
                (0, miscellaneous_1.log)("Expected text:\n ".concat(expectedText));
                (0, chai_1.expect)(outputPanelText).to.include(expectedText);
            }
            return [2 /*return*/];
        });
    });
}
// If found, this function returns the entire text that's in the Output panel.
function attemptToFindOutputPanelText(outputChannelName, searchString, attempts) {
    return __awaiter(this, void 0, void 0, function () {
        var outputViewText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.debug)("attemptToFindOutputPanelText in channel \"".concat(outputChannelName, ": with string \"").concat(searchString, "\""));
                    _a.label = 1;
                case 1:
                    if (!(attempts > 0)) return [3 /*break*/, 4];
                    return [4 /*yield*/, getOutputViewText(outputChannelName)];
                case 2:
                    outputViewText = _a.sent();
                    if (outputViewText.includes(searchString)) {
                        return [2 /*return*/, outputViewText];
                    }
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 3:
                    _a.sent();
                    attempts--;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, undefined];
            }
        });
    });
}
function getOperationTime(outputText) {
    return __awaiter(this, void 0, void 0, function () {
        var tRegex, matches, times, _a, hours_1, minutes_1, seconds_1, secondFraction, time, startTime, endTime, diff, hours, minutes, seconds, milliseconds;
        return __generator(this, function (_b) {
            tRegex = /((?<hours>\d+):(?<minutes>\d+):(?<seconds>\d+)(?<secondFraction>\.\d+))/g;
            times = [];
            while ((matches = tRegex.exec(outputText)) !== null) {
                if (matches.groups) {
                    _a = matches.groups, hours_1 = _a.hours, minutes_1 = _a.minutes, seconds_1 = _a.seconds, secondFraction = _a.secondFraction;
                    time = new Date(1970, 0, 1, Number(hours_1), Number(minutes_1), Number(seconds_1), Number(secondFraction) * 1000);
                    times.push(time);
                }
            }
            if (times.length < 2) {
                return [2 /*return*/, 'Insufficient timestamps found.'];
            }
            startTime = times[0], endTime = times[1];
            diff = endTime.getTime() - startTime.getTime();
            hours = Math.floor(diff / 3600000);
            diff %= 3600000;
            minutes = Math.floor(diff / 60000);
            diff %= 60000;
            seconds = Math.floor(diff / 1000);
            milliseconds = diff % 1000;
            return [2 /*return*/, "".concat(formatTimeComponent(hours), ":").concat(formatTimeComponent(minutes), ":").concat(formatTimeComponent(seconds), ".").concat(formatTimeComponent(milliseconds, 3))];
        });
    });
}
function clearOutputView() {
    return __awaiter(this, arguments, void 0, function (wait) {
        var outputView, clearButton;
        if (wait === void 0) { wait = miscellaneous_1.Duration.seconds(1); }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(process.platform === 'linux')) return [3 /*break*/, 4];
                    return [4 /*yield*/, new vscode_extension_tester_1.BottomBarPanel().openOutputView()];
                case 1:
                    outputView = _a.sent();
                    return [4 /*yield*/, outputView.findElement(vscode_extension_tester_1.By.className('codicon-clear-all'))];
                case 2:
                    clearButton = _a.sent();
                    return [4 /*yield*/, outputView.getDriver().executeScript("arguments[0].click();", clearButton)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 4: 
                // In Mac and Windows, clear the output by calling the "View: Clear Output" command in the command palette
                return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('View: Clear Output', wait)];
                case 5:
                    // In Mac and Windows, clear the output by calling the "View: Clear Output" command in the command palette
                    _a.sent();
                    _a.label = 6;
                case 6: return [2 /*return*/];
            }
        });
    });
}
function formatTimeComponent(component, padLength) {
    if (padLength === void 0) { padLength = 2; }
    return component.toString().padStart(padLength, '0');
}
