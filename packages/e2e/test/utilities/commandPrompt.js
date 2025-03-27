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
exports.openCommandPromptWithCommand = openCommandPromptWithCommand;
exports.runCommandFromCommandPrompt = runCommandFromCommandPrompt;
exports.selectQuickPickWithText = selectQuickPickWithText;
exports.selectQuickPickItem = selectQuickPickItem;
exports.findQuickPickItem = findQuickPickItem;
exports.waitForQuickPick = waitForQuickPick;
exports.executeQuickPick = executeQuickPick;
exports.clickFilePathOkButton = clickFilePathOkButton;
var miscellaneous_1 = require("./miscellaneous");
var workbench_1 = require("./workbench");
var vscode_extension_tester_1 = require("vscode-extension-tester");
function openCommandPromptWithCommand(workbench, command) {
    return __awaiter(this, void 0, void 0, function () {
        var prompt;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, workbench.openCommandPrompt()];
                case 1: return [4 /*yield*/, (_a.sent()).wait()];
                case 2:
                    prompt = _a.sent();
                    return [4 /*yield*/, prompt.wait()];
                case 3: return [4 /*yield*/, (_a.sent()).setText(">".concat(command))];
                case 4:
                    _a.sent();
                    return [2 /*return*/, prompt];
            }
        });
    });
}
function runCommandFromCommandPrompt(workbench_2, command_1) {
    return __awaiter(this, arguments, void 0, function (workbench, command, durationInSeconds) {
        var prompt;
        if (durationInSeconds === void 0) { durationInSeconds = miscellaneous_1.Duration.seconds(0); }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, openCommandPromptWithCommand(workbench, command)];
                case 1: return [4 /*yield*/, (_a.sent()).wait()];
                case 2:
                    prompt = _a.sent();
                    return [4 /*yield*/, selectQuickPickItem(prompt, command)];
                case 3:
                    _a.sent();
                    if (!(durationInSeconds.milliseconds > 0)) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(durationInSeconds)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/, prompt];
            }
        });
    });
}
function selectQuickPickWithText(prompt, text) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // Set the text in the command prompt.  Only selectQuickPick() needs to be called, but setting
                // the text in the command prompt is a nice visual feedback to anyone watching the tests run.
                return [4 /*yield*/, prompt.setText(text)];
                case 1:
                    // Set the text in the command prompt.  Only selectQuickPick() needs to be called, but setting
                    // the text in the command prompt is a nice visual feedback to anyone watching the tests run.
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, prompt.selectQuickPick(text)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function selectQuickPickItem(prompt, text) {
    return __awaiter(this, void 0, void 0, function () {
        var quickPick, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!prompt) {
                        throw new Error('Prompt cannot be undefined');
                    }
                    return [4 /*yield*/, prompt.findQuickPick(text)];
                case 1:
                    quickPick = _b.sent();
                    _a = !quickPick;
                    if (_a) return [3 /*break*/, 3];
                    return [4 /*yield*/, quickPick.getLabel()];
                case 2:
                    _a = (_b.sent()) !== text;
                    _b.label = 3;
                case 3:
                    if (_a) {
                        throw new Error("Quick pick item ".concat(text, " was not found"));
                    }
                    return [4 /*yield*/, quickPick.select()];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 5:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function findQuickPickItem(inputBox, quickPickItemTitle, useExactMatch, selectTheQuickPickItem) {
    return __awaiter(this, void 0, void 0, function () {
        var itemWasFound, quickPicks, _i, quickPicks_1, quickPick, label;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!inputBox) {
                        return [2 /*return*/, false];
                    }
                    // Type the text into the filter.  Do this in case the pick list is long and
                    // the target item is not visible (and one needs to scroll down to see it).
                    return [4 /*yield*/, inputBox.setText(quickPickItemTitle)];
                case 1:
                    // Type the text into the filter.  Do this in case the pick list is long and
                    // the target item is not visible (and one needs to scroll down to see it).
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 2:
                    _a.sent();
                    itemWasFound = false;
                    return [4 /*yield*/, inputBox.getQuickPicks()];
                case 3:
                    quickPicks = _a.sent();
                    _i = 0, quickPicks_1 = quickPicks;
                    _a.label = 4;
                case 4:
                    if (!(_i < quickPicks_1.length)) return [3 /*break*/, 10];
                    quickPick = quickPicks_1[_i];
                    return [4 /*yield*/, quickPick.getLabel()];
                case 5:
                    label = _a.sent();
                    if (useExactMatch && label === quickPickItemTitle) {
                        itemWasFound = true;
                    }
                    else if (!useExactMatch && label.includes(quickPickItemTitle)) {
                        itemWasFound = true;
                    }
                    if (!itemWasFound) return [3 /*break*/, 9];
                    if (!selectTheQuickPickItem) return [3 /*break*/, 8];
                    return [4 /*yield*/, quickPick.select()];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 7:
                    _a.sent();
                    _a.label = 8;
                case 8: return [2 /*return*/, true];
                case 9:
                    _i++;
                    return [3 /*break*/, 4];
                case 10: return [2 /*return*/, false];
            }
        });
    });
}
function waitForQuickPick(prompt_1, pickListItem_1) {
    return __awaiter(this, arguments, void 0, function (prompt, pickListItem, options) {
        var _this = this;
        var _a, _b;
        if (options === void 0) { options = { timeout: miscellaneous_1.Duration.milliseconds(10000) }; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, workbench_1.getBrowser)().wait(function () { return __awaiter(_this, void 0, void 0, function () {
                        var _1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, findQuickPickItem(prompt, pickListItem, false, true)];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, true];
                                case 2:
                                    _1 = _a.sent();
                                    return [2 /*return*/, false];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); }, (_a = options.timeout) === null || _a === void 0 ? void 0 : _a.milliseconds, (_b = options.msg) !== null && _b !== void 0 ? _b : "Expected to find option ".concat(pickListItem, " before ").concat(options.timeout, " milliseconds"), 500 // Check every 500 ms
                    )];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Runs exact command from command palette
 * @param command
 * @param wait - default is  1 second
 * @returns
 */
function executeQuickPick(command_1) {
    return __awaiter(this, arguments, void 0, function (command, wait) {
        var workbench, prompt_1, error_1, errorMessage;
        if (wait === void 0) { wait = miscellaneous_1.Duration.seconds(1); }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.debug)("executeQuickPick command: ".concat(command));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    workbench = (0, workbench_1.getWorkbench)();
                    return [4 /*yield*/, workbench.openCommandPrompt()];
                case 2:
                    prompt_1 = _a.sent();
                    return [4 /*yield*/, prompt_1.setText(">".concat(command))];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, prompt_1.selectQuickPick(command)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(wait)];
                case 5:
                    _a.sent();
                    return [2 /*return*/, prompt_1];
                case 6:
                    error_1 = _a.sent();
                    errorMessage = void 0;
                    if (error_1 instanceof Error) {
                        errorMessage = error_1.message;
                    }
                    else if (typeof error_1 === 'string') {
                        errorMessage = error_1;
                    }
                    else {
                        throw new Error("Unknown error: ".concat(error_1));
                    }
                    if (errorMessage.includes('Command not found')) {
                        throw new Error("Command not found: ".concat(command));
                    }
                    else {
                        throw error_1;
                    }
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function clickFilePathOkButton() {
    return __awaiter(this, void 0, void 0, function () {
        var browser, okButton, buttons, _loop_1, _i, buttons_1, item, state_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    browser = (0, workbench_1.getBrowser)();
                    return [4 /*yield*/, browser.findElement(vscode_extension_tester_1.By.css('*:not([style*="display: none"]).quick-input-action .monaco-button'))];
                case 1:
                    okButton = _a.sent();
                    if (!okButton) {
                        throw new Error('Ok button not found');
                    }
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.milliseconds(500))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, okButton.sendKeys(vscode_extension_tester_1.Key.ENTER)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, browser.findElements(vscode_extension_tester_1.By.css('a.monaco-button.monaco-text-button'))];
                case 5:
                    buttons = _a.sent();
                    _loop_1 = function (item) {
                        var text;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, item.getText()];
                                case 1:
                                    text = _b.sent();
                                    if (!text.includes('Overwrite')) return [3 /*break*/, 4];
                                    (0, miscellaneous_1.log)('clickFilePathOkButton() - folder already exists');
                                    return [4 /*yield*/, browser.wait(function () { return __awaiter(_this, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0: return [4 /*yield*/, item.isDisplayed()];
                                                case 1:
                                                    _a = (_b.sent());
                                                    if (!_a) return [3 /*break*/, 3];
                                                    return [4 /*yield*/, item.isEnabled()];
                                                case 2:
                                                    _a = (_b.sent());
                                                    _b.label = 3;
                                                case 3: return [2 /*return*/, _a];
                                            }
                                        }); }); }, miscellaneous_1.Duration.seconds(5).milliseconds, "Overwrite button not clickable within 5 seconds")];
                                case 2:
                                    _b.sent();
                                    return [4 /*yield*/, item.click()];
                                case 3:
                                    _b.sent();
                                    return [2 /*return*/, "break"];
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, buttons_1 = buttons;
                    _a.label = 6;
                case 6:
                    if (!(_i < buttons_1.length)) return [3 /*break*/, 9];
                    item = buttons_1[_i];
                    return [5 /*yield**/, _loop_1(item)];
                case 7:
                    state_1 = _a.sent();
                    if (state_1 === "break")
                        return [3 /*break*/, 9];
                    _a.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 6];
                case 9: return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(2))];
                case 10:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
