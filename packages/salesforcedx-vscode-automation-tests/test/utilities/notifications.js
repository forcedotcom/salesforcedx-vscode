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
exports.waitForNotificationToGoAway = waitForNotificationToGoAway;
exports.notificationIsPresent = notificationIsPresent;
exports.notificationIsPresentWithTimeout = notificationIsPresentWithTimeout;
exports.notificationIsAbsent = notificationIsAbsent;
exports.notificationIsAbsentWithTimeout = notificationIsAbsentWithTimeout;
exports.dismissNotification = dismissNotification;
exports.acceptNotification = acceptNotification;
exports.dismissAllNotifications = dismissAllNotifications;
var miscellaneous_1 = require("./miscellaneous");
var workbench_1 = require("./workbench");
var commandPrompt_1 = require("./commandPrompt");
var vscode_extension_tester_1 = require("vscode-extension-tester");
function waitForNotificationToGoAway(notificationMessage, durationInSeconds) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, findNotification(notificationMessage, false, durationInSeconds, true)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function notificationIsPresent(notificationMessage) {
    return __awaiter(this, void 0, void 0, function () {
        var notification;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, findNotification(notificationMessage, true, miscellaneous_1.Duration.milliseconds(500))];
                case 1:
                    notification = _a.sent();
                    return [2 /*return*/, notification ? true : false];
            }
        });
    });
}
function notificationIsPresentWithTimeout(notificationMessage, durationInSeconds) {
    return __awaiter(this, void 0, void 0, function () {
        var notification;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, findNotification(notificationMessage, true, durationInSeconds)];
                case 1:
                    notification = _a.sent();
                    return [2 /*return*/, notification ? true : false];
            }
        });
    });
}
function notificationIsAbsent(notificationMessage) {
    return __awaiter(this, void 0, void 0, function () {
        var notification;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, findNotification(notificationMessage, false, miscellaneous_1.Duration.milliseconds(500))];
                case 1:
                    notification = _a.sent();
                    return [2 /*return*/, notification ? false : true];
            }
        });
    });
}
function notificationIsAbsentWithTimeout(notificationMessage, durationInSeconds) {
    return __awaiter(this, void 0, void 0, function () {
        var notification;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, findNotification(notificationMessage, false, durationInSeconds)];
                case 1:
                    notification = _a.sent();
                    return [2 /*return*/, notification ? false : true];
            }
        });
    });
}
function dismissNotification(notificationMessage_1) {
    return __awaiter(this, arguments, void 0, function (notificationMessage, timeout) {
        var notification;
        if (timeout === void 0) { timeout = miscellaneous_1.Duration.seconds(1); }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, findNotification(notificationMessage, true, timeout, true)];
                case 1:
                    notification = _a.sent();
                    notification === null || notification === void 0 ? void 0 : notification.close();
                    return [2 /*return*/];
            }
        });
    });
}
function acceptNotification(notificationMessage, actionName, timeout) {
    return __awaiter(this, void 0, void 0, function () {
        var actionButtons, _i, actionButtons_1, button;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("".concat(notificationMessage, ", ").concat(actionName, ", ").concat(timeout));
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('Notifications: Show Notifications', miscellaneous_1.Duration.seconds(1))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, workbench_1.getBrowser)().findElements(vscode_extension_tester_1.By.css("div.notification-list-item-buttons-container > a.monaco-button.monaco-text-button"))];
                case 2:
                    actionButtons = _a.sent();
                    _i = 0, actionButtons_1 = actionButtons;
                    _a.label = 3;
                case 3:
                    if (!(_i < actionButtons_1.length)) return [3 /*break*/, 7];
                    button = actionButtons_1[_i];
                    return [4 /*yield*/, button.getText()];
                case 4:
                    if (!(_a.sent()).includes(actionName)) return [3 /*break*/, 6];
                    (0, miscellaneous_1.log)("button ".concat(actionName, " found"));
                    return [4 /*yield*/, button.click()];
                case 5:
                    _a.sent();
                    return [2 /*return*/, true];
                case 6:
                    _i++;
                    return [3 /*break*/, 3];
                case 7: return [2 /*return*/, false];
            }
        });
    });
}
function dismissAllNotifications() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("calling dismissAllNotifications()");
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('Notifications: Clear All Notifications')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function findNotification(message_1, shouldBePresent_1) {
    return __awaiter(this, arguments, void 0, function (message, shouldBePresent, timeout, throwOnTimeout // New parameter to control throwing on timeout
    ) {
        var workbench, timeoutMessage, getMatchingNotification, endTime, foundNotification, error_1;
        var _this = this;
        if (timeout === void 0) { timeout = miscellaneous_1.Duration.milliseconds(500); }
        if (throwOnTimeout === void 0) { throwOnTimeout = false; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    workbench = (0, workbench_1.getWorkbench)();
                    timeoutMessage = "Notification with message \"".concat(message, "\" ").concat(shouldBePresent ? 'not found' : 'still present', " within the specified timeout of ").concat(timeout.seconds, " seconds.");
                    getMatchingNotification = function () { return __awaiter(_this, void 0, void 0, function () {
                        var notifications, _i, notifications_1, notification, notificationMessage;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, workbench.openNotificationsCenter()];
                                case 1:
                                    _a.sent();
                                    return [4 /*yield*/, workbench.getNotifications()];
                                case 2:
                                    notifications = _a.sent();
                                    _i = 0, notifications_1 = notifications;
                                    _a.label = 3;
                                case 3:
                                    if (!(_i < notifications_1.length)) return [3 /*break*/, 6];
                                    notification = notifications_1[_i];
                                    return [4 /*yield*/, notification.getMessage()];
                                case 4:
                                    notificationMessage = _a.sent();
                                    if (notificationMessage === message || notificationMessage.includes(message)) {
                                        return [2 /*return*/, notification];
                                    }
                                    _a.label = 5;
                                case 5:
                                    _i++;
                                    return [3 /*break*/, 3];
                                case 6: return [2 /*return*/, null];
                            }
                        });
                    }); };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    endTime = Date.now() + timeout.milliseconds;
                    foundNotification = null;
                    _a.label = 2;
                case 2: return [4 /*yield*/, getMatchingNotification()];
                case 3:
                    foundNotification = _a.sent();
                    if (foundNotification) {
                        return [2 /*return*/, foundNotification];
                    }
                    return [4 /*yield*/, new Promise(function (res) { return setTimeout(res, 100); })];
                case 4:
                    _a.sent(); // Short delay before retrying
                    _a.label = 5;
                case 5:
                    if (Date.now() < endTime) return [3 /*break*/, 2];
                    _a.label = 6;
                case 6:
                    // Throw or return based on `throwOnTimeout`
                    if (throwOnTimeout) {
                        throw new Error(timeoutMessage);
                    }
                    return [2 /*return*/, null];
                case 7:
                    error_1 = _a.sent();
                    if (throwOnTimeout) {
                        throw error_1;
                    }
                    return [2 /*return*/, null];
                case 8: return [2 /*return*/];
            }
        });
    });
}
