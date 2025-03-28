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
exports.extensions = void 0;
exports.showRunningExtensions = showRunningExtensions;
exports.reloadAndEnableExtensions = reloadAndEnableExtensions;
exports.getExtensionsToVerifyActive = getExtensionsToVerifyActive;
exports.verifyExtensionsAreRunning = verifyExtensionsAreRunning;
exports.findExtensionsInRunningExtensionsList = findExtensionsInRunningExtensionsList;
exports.checkForUncaughtErrors = checkForUncaughtErrors;
var miscellaneous_1 = require("./miscellaneous");
var utilities = require("./index");
var commandPrompt_1 = require("./commandPrompt");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var chai_1 = require("chai");
var workbench_1 = require("./workbench");
var VERIFY_EXTENSIONS_TIMEOUT = miscellaneous_1.Duration.seconds(60);
exports.extensions = [
    {
        extensionId: 'salesforcedx-vscode',
        name: 'Salesforce Extension Pack',
        vsixPath: '',
        shouldInstall: 'never',
        shouldVerifyActivation: false
    },
    {
        extensionId: 'salesforcedx-vscode-expanded',
        name: 'Salesforce Extension Pack (Expanded)',
        vsixPath: '',
        shouldInstall: 'never',
        shouldVerifyActivation: false
    },
    {
        extensionId: 'salesforcedx-vscode-soql',
        name: 'SOQL',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-einstein-gpt',
        name: 'Einstein for Developers (Beta)',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: false
    },
    {
        extensionId: 'salesforcedx-vscode-core',
        name: 'Salesforce CLI Integration',
        vsixPath: '',
        shouldInstall: 'always',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-vscode-apex',
        name: 'Apex',
        vsixPath: '',
        shouldInstall: 'always',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-vscode-apex-debugger',
        name: 'Apex Interactive Debugger',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-vscode-apex-replay-debugger',
        name: 'Apex Replay Debugger',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-vscode-lightning',
        name: 'Lightning Web Components',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-vscode-lwc',
        name: 'Lightning Web Components',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-vscode-visualforce',
        name: 'salesforcedx-vscode-visualforce',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: true
    }
];
function showRunningExtensions() {
    return __awaiter(this, void 0, void 0, function () {
        var re;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)('');
                    (0, miscellaneous_1.log)("Starting showRunningExtensions()...");
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('Developer: Show Running Extensions')];
                case 1:
                    _a.sent();
                    re = undefined;
                    return [4 /*yield*/, (0, workbench_1.getBrowser)().wait(function () { return __awaiter(_this, void 0, void 0, function () {
                            var wb, ev;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        wb = (0, workbench_1.getWorkbench)();
                                        ev = wb.getEditorView();
                                        return [4 /*yield*/, ev.openEditor('Running Extensions')];
                                    case 1:
                                        re = _a.sent();
                                        return [2 /*return*/, re.isDisplayed()];
                                }
                            });
                        }); }, 5000, // Timeout after 5 seconds
                        'Expected "Running Extensions" tab to be visible after 5 seconds', 500)];
                case 2:
                    _a.sent();
                    (0, miscellaneous_1.log)("... Finished showRunningExtensions()");
                    (0, miscellaneous_1.log)('');
                    return [2 /*return*/, re];
            }
        });
    });
}
function reloadAndEnableExtensions() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, utilities.reloadWindow()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, utilities.enableAllExtensions()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getExtensionsToVerifyActive(predicate) {
    if (predicate === void 0) { predicate = function (ext) { return !!ext; }; }
    return exports.extensions
        .filter(function (ext) {
        return ext.shouldVerifyActivation;
    })
        .filter(predicate);
}
function verifyExtensionsAreRunning(extensions_1) {
    return __awaiter(this, arguments, void 0, function (extensions, timeout) {
        var extensionsToVerify, extensionsStatus, allActivated, timeoutPromise, error_1;
        var _this = this;
        if (timeout === void 0) { timeout = VERIFY_EXTENSIONS_TIMEOUT; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)('');
                    (0, miscellaneous_1.log)("Starting verifyExtensionsAreRunning()...");
                    if (extensions.length === 0) {
                        (0, miscellaneous_1.log)('verifyExtensionsAreRunning - No extensions to verify, continuing test run w/o extension verification');
                        return [2 /*return*/, true];
                    }
                    extensionsToVerify = extensions.map(function (extension) { return extension.extensionId; });
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(15))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, utilities.zoom('Out', 4, miscellaneous_1.Duration.seconds(1))];
                case 2:
                    _a.sent();
                    extensionsStatus = [];
                    allActivated = false;
                    timeoutPromise = new Promise(function (_, reject) {
                        return setTimeout(function () { return reject(new Error('findExtensionsInRunningExtensionsList timeout')); }, timeout.milliseconds);
                    });
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, Promise.race([
                            (function () { return __awaiter(_this, void 0, void 0, function () {
                                var _i, extensionsStatus_1, extensionStatus;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0: return [4 /*yield*/, findExtensionsInRunningExtensionsList(extensionsToVerify)];
                                        case 1:
                                            extensionsStatus = _b.sent();
                                            // Log the current state of the activation check for each extension
                                            for (_i = 0, extensionsStatus_1 = extensionsStatus; _i < extensionsStatus_1.length; _i++) {
                                                extensionStatus = extensionsStatus_1[_i];
                                                (0, miscellaneous_1.log)(
                                                // prettier-ignore
                                                "Extension ".concat(extensionStatus.extensionId, ": ").concat((_a = extensionStatus.activationTime) !== null && _a !== void 0 ? _a : 'Not activated'));
                                            }
                                            allActivated = extensionsToVerify.every(function (extensionId) {
                                                var _a;
                                                return (_a = extensionsStatus.find(function (extensionStatus) { return extensionStatus.extensionId === extensionId; })) === null || _a === void 0 ? void 0 : _a.isActivationComplete;
                                            });
                                            _b.label = 2;
                                        case 2:
                                            if (!allActivated) return [3 /*break*/, 0];
                                            _b.label = 3;
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); })(),
                            timeoutPromise
                        ])];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    (0, miscellaneous_1.log)("Error while waiting for extensions to activate: ".concat(error_1));
                    return [3 /*break*/, 6];
                case 6: return [4 /*yield*/, utilities.zoomReset()];
                case 7:
                    _a.sent();
                    (0, miscellaneous_1.log)('... Finished verifyExtensionsAreRunning()');
                    (0, miscellaneous_1.log)('');
                    return [2 /*return*/, allActivated];
            }
        });
    });
}
function findExtensionsInRunningExtensionsList(
// eslint-disable-next-line @typescript-eslint/no-unused-vars
extensionIds) {
    return __awaiter(this, void 0, void 0, function () {
        var center, error_2, runningExtensionsEditor, allExtensions, runningExtensions, _i, allExtensions_1, extension, parent_1, extensionId, version, activationTime, isActivationComplete, hasBug, bugError, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)('');
                    (0, miscellaneous_1.log)('Starting findExtensionsInRunningExtensionsList()...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, (0, workbench_1.getWorkbench)().openNotificationsCenter()];
                case 2:
                    center = _a.sent();
                    return [4 /*yield*/, center.clearAllNotifications()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, center.close()];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_2 = _a.sent();
                    if (error_2 instanceof Error) {
                        (0, miscellaneous_1.log)("Failed clearing all notifications ".concat(error_2.message));
                    }
                    return [3 /*break*/, 6];
                case 6: return [4 /*yield*/, showRunningExtensions()];
                case 7:
                    runningExtensionsEditor = _a.sent();
                    if (!runningExtensionsEditor) {
                        throw new Error('Could not find the running extensions editor');
                    }
                    return [4 /*yield*/, runningExtensionsEditor.findElements(vscode_extension_tester_1.By.css('div.monaco-list-row > div.extension'))];
                case 8:
                    allExtensions = _a.sent();
                    runningExtensions = [];
                    _i = 0, allExtensions_1 = allExtensions;
                    _a.label = 9;
                case 9:
                    if (!(_i < allExtensions_1.length)) return [3 /*break*/, 19];
                    extension = allExtensions_1[_i];
                    return [4 /*yield*/, extension.findElement(vscode_extension_tester_1.By.xpath('..'))];
                case 10:
                    parent_1 = _a.sent();
                    return [4 /*yield*/, parent_1.getAttribute('aria-label')];
                case 11:
                    extensionId = _a.sent();
                    return [4 /*yield*/, extension.findElement(vscode_extension_tester_1.By.css('.version')).getText()];
                case 12:
                    version = _a.sent();
                    return [4 /*yield*/, extension.findElement(vscode_extension_tester_1.By.css('.activation-time')).getText()];
                case 13:
                    activationTime = _a.sent();
                    isActivationComplete = /\:\s*?[0-9]{1,}ms/.test(activationTime);
                    hasBug = void 0;
                    _a.label = 14;
                case 14:
                    _a.trys.push([14, 16, , 17]);
                    return [4 /*yield*/, parent_1.findElement(vscode_extension_tester_1.By.css('span.codicon-bug error'))];
                case 15:
                    bugError = _a.sent();
                    return [3 /*break*/, 17];
                case 16:
                    error_3 = _a.sent();
                    hasBug = error_3.message.startsWith('no such element') ? false : true;
                    return [3 /*break*/, 17];
                case 17:
                    runningExtensions.push({
                        extensionId: extensionId,
                        activationTime: activationTime,
                        version: version,
                        isPresent: true,
                        hasBug: hasBug,
                        isActivationComplete: isActivationComplete
                    });
                    _a.label = 18;
                case 18:
                    _i++;
                    return [3 /*break*/, 9];
                case 19:
                    (0, miscellaneous_1.log)('... Finished findExtensionsInRunningExtensionsList()');
                    (0, miscellaneous_1.log)('');
                    // limit runningExtensions to those whose property extensionId is in the list of extensionIds
                    return [2 /*return*/, runningExtensions.filter(function (extension) { return extensionIds.includes(extension.extensionId); })];
            }
        });
    });
}
function checkForUncaughtErrors() {
    return __awaiter(this, void 0, void 0, function () {
        var uncaughtErrors;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, utilities.showRunningExtensions()];
                case 1:
                    _a.sent();
                    // Zoom out so all the extensions are visible
                    return [4 /*yield*/, utilities.zoom('Out', 4, utilities.Duration.seconds(1))];
                case 2:
                    // Zoom out so all the extensions are visible
                    _a.sent();
                    return [4 /*yield*/, utilities.findExtensionsInRunningExtensionsList(utilities.getExtensionsToVerifyActive().map(function (ext) { return ext.extensionId; }))];
                case 3:
                    uncaughtErrors = (_a.sent()).filter(function (ext) { return ext.hasBug; });
                    return [4 /*yield*/, utilities.zoomReset()];
                case 4:
                    _a.sent();
                    uncaughtErrors.forEach(function (ext) {
                        var _a;
                        utilities.log("Extension ".concat(ext.extensionId, ":").concat((_a = ext.version) !== null && _a !== void 0 ? _a : 'unknown', " has a bug"));
                    });
                    (0, chai_1.expect)(uncaughtErrors.length).equal(0);
                    return [2 /*return*/];
            }
        });
    });
}
