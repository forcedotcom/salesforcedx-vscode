"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.Duration = exports.Unit = void 0;
exports.pause = pause;
exports.log = log;
exports.debug = debug;
exports.error = error;
exports.currentOsUserName = currentOsUserName;
exports.transformedUserName = transformedUserName;
exports.findElementByText = findElementByText;
exports.createCommand = createCommand;
exports.setDefaultOrg = setDefaultOrg;
exports.isDuration = isDuration;
exports.sleep = sleep;
exports.openFolder = openFolder;
exports.openFile = openFile;
var os_1 = require("os");
var environmentSettings_1 = require("../environmentSettings");
var outputView_1 = require("./outputView");
var commandPrompt_1 = require("./commandPrompt");
var notifications_1 = require("./notifications");
var DurationKit = require("@salesforce/kit");
var path_1 = require("path");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var workbench_1 = require("./workbench");
var chai_1 = require("chai");
function pause() {
    return __awaiter(this, arguments, void 0, function (duration) {
        if (duration === void 0) { duration = Duration.seconds(1); }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, sleep(duration.milliseconds)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function log(message) {
    if (environmentSettings_1.EnvironmentSettings.getInstance().logLevel !== 'silent') {
        console.log(message);
    }
}
function debug(message) {
    if (environmentSettings_1.EnvironmentSettings.getInstance().logLevel in ['debug', 'trace']) {
        var timestamp = new Date().toISOString();
        console.debug("".concat(timestamp, ":").concat(message));
    }
}
function error(message) {
    if (environmentSettings_1.EnvironmentSettings.getInstance().logLevel === 'error') {
        console.error("Error: ".concat(message));
    }
}
function currentOsUserName() {
    var userName = os_1.default.userInfo().username ||
        process.env.SUDO_USER ||
        process.env.C9_USER ||
        process.env.LOGNAME ||
        process.env.USER ||
        process.env.LNAME ||
        process.env.USERNAME;
    return userName;
}
// There is an issue with InputBox.setText().  When a
// period is present, the string passed to the input box
// becomes truncated.  An fix for this is to replace
// the periods with an underscore.
function transformedUserName() {
    debug('transformedUsername()');
    return currentOsUserName().replace('.', '_');
}
/**
 * @param type type of html tag we want to find
 * @param attribute attribute that holds the given text
 * @param labelText text of the element we want to find
 * @param waitForClickable whether to wait until the element is clickable
 * @param waitOptions options for waiting until the element is clickable
 * @returns element that contains the given text
 */
function findElementByText(type_1, attribute_1, labelText_1) {
    return __awaiter(this, arguments, void 0, function (type, attribute, labelText, waitForClickable, waitOptions) {
        var element;
        var _this = this;
        var _a, _b, _c, _d;
        if (waitForClickable === void 0) { waitForClickable = false; }
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!labelText) {
                        throw new Error('labelText must be defined');
                    }
                    debug("findElementByText //".concat(type, "[@").concat(attribute, "=\"").concat(labelText, "\"]"));
                    return [4 /*yield*/, (0, workbench_1.getWorkbench)().findElement(vscode_extension_tester_1.By.xpath("//".concat(type, "[@").concat(attribute, "=\"").concat(labelText, "\"]")))];
                case 1:
                    element = _e.sent();
                    if (!element) {
                        throw new Error("Element with selector: \"".concat(type, "[").concat(attribute, "=\"").concat(labelText, "\"]\" not found}"));
                    }
                    if (!waitForClickable) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, workbench_1.getBrowser)().wait(function () { return __awaiter(_this, void 0, void 0, function () {
                            var isDisplayedAndEnabled, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, element.isDisplayed()];
                                    case 1:
                                        _a = (_b.sent());
                                        if (!_a) return [3 /*break*/, 3];
                                        return [4 /*yield*/, element.isEnabled()];
                                    case 2:
                                        _a = (_b.sent());
                                        _b.label = 3;
                                    case 3:
                                        isDisplayedAndEnabled = _a;
                                        return [2 /*return*/, (waitOptions === null || waitOptions === void 0 ? void 0 : waitOptions.reverse) ? !isDisplayedAndEnabled : isDisplayedAndEnabled];
                                }
                            });
                        }); }, (_b = (_a = waitOptions === null || waitOptions === void 0 ? void 0 : waitOptions.timeout) === null || _a === void 0 ? void 0 : _a.milliseconds) !== null && _b !== void 0 ? _b : Duration.seconds(5).milliseconds, waitOptions === null || waitOptions === void 0 ? void 0 : waitOptions.timeoutMsg, (_d = (_c = waitOptions === null || waitOptions === void 0 ? void 0 : waitOptions.interval) === null || _c === void 0 ? void 0 : _c.milliseconds) !== null && _d !== void 0 ? _d : Duration.milliseconds(500).milliseconds)];
                case 2:
                    _e.sent();
                    _e.label = 3;
                case 3: return [2 /*return*/, element];
            }
        });
    });
}
function createCommand(type, name, folder, extension) {
    return __awaiter(this, void 0, void 0, function () {
        var inputBox, successNotificationWasFound, outputPanelText, typePath, metadataPath;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, outputView_1.clearOutputView)()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)("SFDX: Create ".concat(type), Duration.seconds(1))];
                case 2:
                    inputBox = _a.sent();
                    // Set the name of the new component to name.
                    return [4 /*yield*/, inputBox.setText(name)];
                case 3:
                    // Set the name of the new component to name.
                    _a.sent();
                    return [4 /*yield*/, inputBox.confirm()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, pause(Duration.seconds(1))];
                case 5:
                    _a.sent();
                    // Select the default directory (press Enter/Return).
                    return [4 /*yield*/, inputBox.confirm()];
                case 6:
                    // Select the default directory (press Enter/Return).
                    _a.sent();
                    return [4 /*yield*/, (0, notifications_1.notificationIsPresentWithTimeout)("SFDX: Create ".concat(type, " successfully ran"), Duration.minutes(10))];
                case 7:
                    successNotificationWasFound = _a.sent();
                    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                    (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                    return [4 /*yield*/, (0, outputView_1.attemptToFindOutputPanelText)("Salesforce CLI", "Finished SFDX: Create ".concat(type), 10)];
                case 8:
                    outputPanelText = _a.sent();
                    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                    (0, chai_1.expect)(outputPanelText).not.to.be.undefined;
                    typePath = path_1.default.join("force-app", "main", "default", folder, "".concat(name, ".").concat(extension));
                    (0, chai_1.expect)(outputPanelText).to.include("create ".concat(typePath));
                    metadataPath = path_1.default.join("force-app", "main", "default", folder, "".concat(name, ".").concat(extension, "-meta.xml"));
                    (0, chai_1.expect)(outputPanelText).to.include("create ".concat(metadataPath));
                    return [2 /*return*/, outputPanelText];
            }
        });
    });
}
function setDefaultOrg(targetOrg) {
    return __awaiter(this, void 0, void 0, function () {
        var inputBox;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('SFDX: Set a Default Org')];
                case 1:
                    inputBox = _a.sent();
                    return [4 /*yield*/, (0, commandPrompt_1.findQuickPickItem)(inputBox, targetOrg, false, true)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Type guard function to check if the argument is a Duration
function isDuration(predicateOrWait) {
    return predicateOrWait.milliseconds !== undefined;
}
var Unit;
(function (Unit) {
    Unit[Unit["MINUTES"] = 0] = "MINUTES";
    Unit[Unit["MILLISECONDS"] = 1] = "MILLISECONDS";
    Unit[Unit["SECONDS"] = 2] = "SECONDS";
    Unit[Unit["HOURS"] = 3] = "HOURS";
    Unit[Unit["DAYS"] = 4] = "DAYS";
    Unit[Unit["WEEKS"] = 5] = "WEEKS";
})(Unit || (exports.Unit = Unit = {}));
var Duration = /** @class */ (function (_super) {
    __extends(Duration, _super);
    function Duration(quantity, unit, scaleFactor) {
        var _this = _super.call(this, quantity, unit) || this;
        if (scaleFactor !== undefined) {
            _this.scaleFactor = scaleFactor;
        }
        else {
            _this.scaleFactor = environmentSettings_1.EnvironmentSettings.getInstance().throttleFactor;
        }
        return _this;
    }
    Object.defineProperty(Duration.prototype, "minutes", {
        get: function () {
            return _super.prototype.minutes * this.scaleFactor;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Duration.prototype, "hours", {
        get: function () {
            return _super.prototype.hours * this.scaleFactor;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Duration.prototype, "milliseconds", {
        get: function () {
            return _super.prototype.milliseconds * this.scaleFactor;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Duration.prototype, "seconds", {
        get: function () {
            return _super.prototype.seconds * this.scaleFactor;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Duration.prototype, "days", {
        get: function () {
            return _super.prototype.days * this.scaleFactor;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Duration.prototype, "weeks", {
        get: function () {
            return _super.prototype.weeks * this.scaleFactor;
        },
        enumerable: false,
        configurable: true
    });
    // Static methods for creating new instances without specifying scaleFactor
    Duration.milliseconds = function (quantity) {
        return new Duration(quantity, Unit.MILLISECONDS);
    };
    Duration.seconds = function (quantity) {
        return new Duration(quantity, Unit.SECONDS);
    };
    Duration.minutes = function (quantity) {
        return new Duration(quantity, Unit.MINUTES);
    };
    Duration.hours = function (quantity) {
        return new Duration(quantity, Unit.HOURS);
    };
    Duration.days = function (quantity) {
        return new Duration(quantity, Unit.DAYS);
    };
    Duration.weeks = function (quantity) {
        return new Duration(quantity, Unit.WEEKS);
    };
    Duration.ONE_MINUTE = Duration.minutes(1);
    Duration.FIVE_MINUTES = Duration.minutes(5);
    Duration.TEN_MINUTES = Duration.minutes(10);
    return Duration;
}(DurationKit.Duration));
exports.Duration = Duration;
function sleep(duration) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) {
                    setTimeout(resolve, duration);
                })];
        });
    });
}
/*
 * VSCode will be working on the new workspace, and the previous one is closed.
 */
function openFolder(path) {
    return __awaiter(this, void 0, void 0, function () {
        var prompt, projectName;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('File: Open Folder...')];
                case 1:
                    prompt = _a.sent();
                    // Set the location of the project
                    return [4 /*yield*/, prompt.setText(path)];
                case 2:
                    // Set the location of the project
                    _a.sent();
                    return [4 /*yield*/, pause(Duration.seconds(2))];
                case 3:
                    _a.sent();
                    projectName = path.substring(path.lastIndexOf('/') + 1);
                    return [4 /*yield*/, prompt.selectQuickPick(projectName)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, commandPrompt_1.clickFilePathOkButton)()];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * An definite alternative of getTextEditor to open a file in text editor
 * @param path
 */
function openFile(path) {
    return __awaiter(this, void 0, void 0, function () {
        var prompt, fileName;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('File: Open File...')];
                case 1:
                    prompt = _a.sent();
                    // Set the location of the project
                    return [4 /*yield*/, prompt.setText(path)];
                case 2:
                    // Set the location of the project
                    _a.sent();
                    return [4 /*yield*/, pause(Duration.seconds(2))];
                case 3:
                    _a.sent();
                    fileName = path.substring(path.lastIndexOf(process.platform === 'win32' ? '\\' : '/') + 1);
                    return [4 /*yield*/, prompt.selectQuickPick(fileName)];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
