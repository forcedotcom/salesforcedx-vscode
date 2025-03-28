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
exports.getWorkbench = getWorkbench;
exports.getBrowser = getBrowser;
exports.reloadWindow = reloadWindow;
exports.closeCurrentEditor = closeCurrentEditor;
exports.closeAllEditors = closeAllEditors;
exports.enableAllExtensions = enableAllExtensions;
exports.showExplorerView = showExplorerView;
exports.zoom = zoom;
exports.zoomReset = zoomReset;
exports.openNewTerminal = openNewTerminal;
var vscode_extension_tester_1 = require("vscode-extension-tester");
var commandPrompt_1 = require("./commandPrompt");
var miscellaneous_1 = require("./miscellaneous");
function getWorkbench() {
    (0, miscellaneous_1.debug)('calling getWorkbench()');
    return new vscode_extension_tester_1.Workbench();
}
function getBrowser() {
    (0, miscellaneous_1.debug)('calling getBrowser()');
    return vscode_extension_tester_1.VSBrowser.instance.driver;
}
function reloadWindow() {
    return __awaiter(this, arguments, void 0, function (predicateOrWait) {
        var prompt;
        if (predicateOrWait === void 0) { predicateOrWait = miscellaneous_1.Duration.milliseconds(0); }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("Reloading window");
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('Developer: Reload Window')];
                case 1:
                    prompt = _a.sent();
                    return [4 /*yield*/, handlePredicateOrWait(predicateOrWait, prompt)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function closeCurrentEditor() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("Closing current editor");
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('View: Close Editor')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function closeAllEditors() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("Closing all editors");
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('View: Close All Editors')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function enableAllExtensions() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("Enabling all extensions");
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('Extensions: Enable All Extensions')];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function showExplorerView() {
    return __awaiter(this, void 0, void 0, function () {
        var control;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)('Show Explorer');
                    return [4 /*yield*/, new vscode_extension_tester_1.ActivityBar().getViewControl('Explorer')];
                case 1:
                    control = _a.sent();
                    if (!control) {
                        throw new Error('Could not open Explorer view in activity bar');
                    }
                    return [4 /*yield*/, control.openView()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function zoom(zoomIn_1, zoomLevel_1) {
    return __awaiter(this, arguments, void 0, function (zoomIn, zoomLevel, wait) {
        var level;
        if (wait === void 0) { wait = miscellaneous_1.Duration.seconds(1); }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, zoomReset(wait)];
                case 1:
                    _a.sent();
                    level = 0;
                    _a.label = 2;
                case 2:
                    if (!(level < zoomLevel)) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)("View: Zoom ".concat(zoomIn), wait)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    level++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function zoomReset() {
    return __awaiter(this, arguments, void 0, function (wait) {
        if (wait === void 0) { wait = miscellaneous_1.Duration.seconds(1); }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('View: Reset Zoom', wait)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function openNewTerminal() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new vscode_extension_tester_1.BottomBarPanel().openTerminalView()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function handlePredicateOrWait(predicateOrWait, prompt) {
    return __awaiter(this, void 0, void 0, function () {
        var predicate, maxWaitTime, safePredicate, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)('handlePredicateOrWait');
                    if (!(0, miscellaneous_1.isDuration)(predicateOrWait)) return [3 /*break*/, 3];
                    if (!(predicateOrWait.milliseconds > 0)) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(predicateOrWait)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [3 /*break*/, 7];
                case 3:
                    predicate = predicateOrWait.predicate, maxWaitTime = predicateOrWait.maxWaitTime;
                    safePredicate = withFailsafe(predicate, maxWaitTime, prompt);
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, safePredicate()];
                case 5:
                    result = _a.sent();
                    if (result !== true) {
                        throw new Error('Predicate did not resolve to true');
                    }
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _a.sent();
                    (0, miscellaneous_1.log)("Predicate failed or timed out: ".concat(error_1.message));
                    throw error_1;
                case 7: return [2 /*return*/];
            }
        });
    });
}
function withFailsafe(predicate, timeout, prompt) {
    return function () {
        return __awaiter(this, void 0, void 0, function () {
            var timeoutPromise;
            return __generator(this, function (_a) {
                timeoutPromise = new Promise(function (_, reject) {
                    return setTimeout(function () { return reject(new Error('Predicate timed out')); }, timeout.milliseconds);
                });
                return [2 /*return*/, Promise.race([predicate(prompt), timeoutPromise])];
            });
        });
    };
}
