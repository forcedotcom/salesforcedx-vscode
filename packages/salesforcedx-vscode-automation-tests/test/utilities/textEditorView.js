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
exports.getTextEditor = getTextEditor;
exports.checkFileOpen = checkFileOpen;
exports.attemptToFindTextEditorText = attemptToFindTextEditorText;
var vscode_extension_tester_1 = require("vscode-extension-tester");
var commandPrompt_1 = require("./commandPrompt");
var miscellaneous_1 = require("./miscellaneous");
var workbench_1 = require("./workbench");
/**
 * @param workbench page object representing the custom VSCode title bar
 * @param fileName name of the file we want to open and use
 * @returns editor for the given file name
 */
function getTextEditor(workbench, fileName) {
    return __awaiter(this, void 0, void 0, function () {
        var inputBox, editorView, textEditor;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("calling getTextEditor(".concat(fileName, ")"));
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('Go to File...', miscellaneous_1.Duration.seconds(1))];
                case 1:
                    inputBox = _a.sent();
                    return [4 /*yield*/, inputBox.setText(fileName)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, inputBox.confirm()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 4:
                    _a.sent();
                    editorView = workbench.getEditorView();
                    return [4 /*yield*/, editorView.openEditor(fileName)];
                case 5:
                    textEditor = (_a.sent());
                    return [2 /*return*/, textEditor];
            }
        });
    });
}
function checkFileOpen(workbench_2, name_1) {
    return __awaiter(this, arguments, void 0, function (workbench, name, options) {
        var _this = this;
        var _a, _b;
        if (options === void 0) { options = { timeout: miscellaneous_1.Duration.milliseconds(10000) }; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, workbench_1.getBrowser)().wait(function () { return __awaiter(_this, void 0, void 0, function () {
                        var editorView, activeTab, _a, _b, error_1;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 4, , 5]);
                                    editorView = workbench.getEditorView();
                                    return [4 /*yield*/, editorView.getActiveTab()];
                                case 1:
                                    activeTab = _c.sent();
                                    _a = activeTab != undefined;
                                    if (!_a) return [3 /*break*/, 3];
                                    _b = name;
                                    return [4 /*yield*/, activeTab.getTitle()];
                                case 2:
                                    _a = _b == (_c.sent());
                                    _c.label = 3;
                                case 3:
                                    if (_a) {
                                        return [2 /*return*/, true];
                                    }
                                    else
                                        return [2 /*return*/, false];
                                    return [3 /*break*/, 5];
                                case 4:
                                    error_1 = _c.sent();
                                    return [2 /*return*/, false];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); }, (_a = options.timeout) === null || _a === void 0 ? void 0 : _a.milliseconds, (_b = options.msg) !== null && _b !== void 0 ? _b : "Expected to find file ".concat(name, " open in TextEditor before ").concat(options.timeout), 500 // Check every 500 ms
                    )];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function attemptToFindTextEditorText(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var fileName, editorView, editor;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, miscellaneous_1.openFile)(filePath)];
                case 1:
                    _a.sent();
                    fileName = filePath.substring(filePath.lastIndexOf(process.platform === 'win32' ? '\\' : '/') + 1);
                    editorView = new vscode_extension_tester_1.EditorView();
                    return [4 /*yield*/, editorView.openEditor(fileName)];
                case 2:
                    editor = _a.sent();
                    return [4 /*yield*/, editor.getText()];
                case 3: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
