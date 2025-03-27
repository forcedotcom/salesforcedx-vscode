"use strict";
/*
 * Copyright (c) 2024, salesforce.com, inc.
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
exports.inWorkspaceSettings = inWorkspaceSettings;
exports.inUserSettings = inUserSettings;
exports.enableBooleanSetting = enableBooleanSetting;
exports.disableBooleanSetting = disableBooleanSetting;
exports.isBooleanSettingEnabled = isBooleanSettingEnabled;
var vscode_extension_tester_1 = require("vscode-extension-tester");
var commandPrompt_1 = require("./commandPrompt");
var miscellaneous_1 = require("./miscellaneous");
var workbench_1 = require("./workbench");
function findAndCheckSetting(id) {
    return __awaiter(this, void 0, void 0, function () {
        var input, textArea, checkButton, checkButtonValue;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.debug)("enter findAndCheckSetting for id: ".concat(id));
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('Preferences: Clear Settings Search Results', miscellaneous_1.Duration.seconds(2))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, workbench_1.getBrowser)().findElement(vscode_extension_tester_1.By.css('div.suggest-input-container'))];
                case 2:
                    input = _a.sent();
                    return [4 /*yield*/, input.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, workbench_1.getBrowser)().findElement(vscode_extension_tester_1.By.css('textarea.inputarea.monaco-mouse-cursor-text'))];
                case 4:
                    textArea = _a.sent();
                    return [4 /*yield*/, textArea.sendKeys(id)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(2))];
                case 6:
                    _a.sent();
                    checkButton = null;
                    checkButtonValue = null;
                    return [4 /*yield*/, (0, workbench_1.getBrowser)().wait(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, (0, miscellaneous_1.findElementByText)('div', 'aria-label', id)];
                                    case 1:
                                        checkButton = (_a.sent());
                                        if (!checkButton) return [3 /*break*/, 3];
                                        return [4 /*yield*/, checkButton.getAttribute('aria-checked')];
                                    case 2:
                                        checkButtonValue = _a.sent();
                                        (0, miscellaneous_1.debug)("found setting checkbox with value \"".concat(checkButtonValue, "\""));
                                        return [2 /*return*/, true];
                                    case 3: return [2 /*return*/, false];
                                }
                            });
                        }); }, 5000, "Could not find setting with name: ".concat(id))];
                case 7:
                    _a.sent();
                    if (!checkButton) {
                        throw new Error("Could not find setting with name: ".concat(id));
                    }
                    (0, miscellaneous_1.debug)("findAndCheckSetting result for ".concat(id, " found ").concat(!!checkButton, " value: ").concat(checkButtonValue));
                    return [2 /*return*/, { checkButton: checkButton, checkButtonValue: checkButtonValue }];
            }
        });
    });
}
function inWorkspaceSettings() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('Preferences: Open Workspace Settings', miscellaneous_1.Duration.seconds(5))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function inUserSettings() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('Preferences: Open User Settings', miscellaneous_1.Duration.seconds(5))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function toggleBooleanSetting(id, finalState, settingsType) {
    return __awaiter(this, void 0, void 0, function () {
        var settingsFunction, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    settingsFunction = settingsType === 'workspace' ? inWorkspaceSettings : inUserSettings;
                    return [4 /*yield*/, settingsFunction()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, findAndCheckSetting(id)];
                case 2:
                    result = _a.sent();
                    if (finalState !== undefined) {
                        if ((finalState && result.checkButtonValue === 'true') || (!finalState && result.checkButtonValue === 'false')) {
                            return [2 /*return*/, true];
                        }
                    }
                    return [4 /*yield*/, result.checkButton.click()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, findAndCheckSetting(id)];
                case 4:
                    result = _a.sent();
                    return [2 /*return*/, result.checkButtonValue === 'true'];
            }
        });
    });
}
function enableBooleanSetting(id_1) {
    return __awaiter(this, arguments, void 0, function (id, settingsType) {
        if (settingsType === void 0) { settingsType = 'workspace'; }
        return __generator(this, function (_a) {
            (0, miscellaneous_1.debug)("enableBooleanSetting ".concat(id));
            return [2 /*return*/, toggleBooleanSetting(id, true, settingsType)];
        });
    });
}
function disableBooleanSetting(id_1) {
    return __awaiter(this, arguments, void 0, function (id, settingsType) {
        if (settingsType === void 0) { settingsType = 'workspace'; }
        return __generator(this, function (_a) {
            (0, miscellaneous_1.debug)("disableBooleanSetting ".concat(id));
            return [2 /*return*/, toggleBooleanSetting(id, false, settingsType)];
        });
    });
}
function isBooleanSettingEnabled(id_1) {
    return __awaiter(this, arguments, void 0, function (id, settingsType) {
        var settingsFunction, checkButtonValue;
        if (settingsType === void 0) { settingsType = 'workspace'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    settingsFunction = settingsType === 'workspace' ? inWorkspaceSettings : inUserSettings;
                    return [4 /*yield*/, settingsFunction()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, findAndCheckSetting(id)];
                case 2:
                    checkButtonValue = (_a.sent()).checkButtonValue;
                    return [2 /*return*/, checkButtonValue === 'true'];
            }
        });
    });
}
