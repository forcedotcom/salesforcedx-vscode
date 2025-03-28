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
exports.createApexClass = createApexClass;
exports.createApexClassWithTest = createApexClassWithTest;
exports.createApexClassWithBugs = createApexClassWithBugs;
exports.createAnonymousApexFile = createAnonymousApexFile;
exports.createApexController = createApexController;
var commandPrompt_1 = require("./commandPrompt");
var miscellaneous_1 = require("./miscellaneous");
var workbench_1 = require("./workbench");
var textEditorView_1 = require("./textEditorView");
function createApexClass(name, classText, breakpoint) {
    return __awaiter(this, void 0, void 0, function () {
        var inputBox, workbench, textEditor;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("calling createApexClass(".concat(name, ")"));
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('SFDX: Create Apex Class', miscellaneous_1.Duration.seconds(2))];
                case 1:
                    inputBox = _a.sent();
                    // Set the name of the new Apex Class
                    return [4 /*yield*/, inputBox.setText(name)];
                case 2:
                    // Set the name of the new Apex Class
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, inputBox.confirm()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, inputBox.confirm()];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 7:
                    _a.sent();
                    workbench = (0, workbench_1.getWorkbench)();
                    return [4 /*yield*/, (0, textEditorView_1.getTextEditor)(workbench, name + '.cls')];
                case 8:
                    textEditor = _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, textEditor.setText(classText)];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, textEditor.save()];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 13:
                    _a.sent();
                    if (!breakpoint) return [3 /*break*/, 15];
                    return [4 /*yield*/, textEditor.toggleBreakpoint(breakpoint)];
                case 14:
                    _a.sent();
                    _a.label = 15;
                case 15: return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 16:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createApexClassWithTest(name) {
    return __awaiter(this, void 0, void 0, function () {
        var classText, testText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("calling createApexClassWithTest()");
                    classText = [
                        "public with sharing class ".concat(name, " {"),
                        "\tpublic static void SayHello(string name){",
                        "\t\tSystem.debug('Hello, ' + name + '!');",
                        "\t}",
                        "}"
                    ].join('\n');
                    return [4 /*yield*/, createApexClass(name, classText, 3)];
                case 1:
                    _a.sent();
                    testText = [
                        "@IsTest",
                        "public class ".concat(name, "Test {"),
                        "\t@IsTest",
                        "\tstatic void validateSayHello() {",
                        "\t\tSystem.debug('Starting validate');",
                        "\t\t".concat(name, ".SayHello('Cody');"),
                        "",
                        "\t\tSystem.assertEquals(1, 1, 'all good');",
                        "\t}",
                        "}"
                    ].join('\n');
                    return [4 /*yield*/, createApexClass(name + 'Test', testText, 6)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createApexClassWithBugs() {
    return __awaiter(this, void 0, void 0, function () {
        var classText, testText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("calling createApexClassWithBugs()");
                    classText = [
                        "public with sharing class AccountService {",
                        "\tpublic Account createAccount(String accountName, String accountNumber, String tickerSymbol) {",
                        "\t\tAccount newAcct = new Account(",
                        "\t\t\tName = accountName,",
                        "\t\t\tAccountNumber = accountNumber,",
                        "\t\t\tTickerSymbol = accountNumber",
                        "\t\t);",
                        "\t\treturn newAcct;",
                        "\t}",
                        "}"
                    ].join('\n');
                    return [4 /*yield*/, createApexClass('AccountService', classText)];
                case 1:
                    _a.sent();
                    testText = [
                        "@IsTest",
                        "private class AccountServiceTest {",
                        "\t@IsTest",
                        "\tstatic void should_create_account() {",
                        "\t\tString acctName = 'Salesforce';",
                        "\t\tString acctNumber = 'SFDC';",
                        "\t\tString tickerSymbol = 'CRM';",
                        "\t\tTest.startTest();",
                        "\t\tAccountService service = new AccountService();",
                        "\t\tAccount newAcct = service.createAccount(acctName, acctNumber, tickerSymbol);",
                        "\t\tinsert newAcct;",
                        "\t\tTest.stopTest();",
                        "\t\tList<Account> accts = [ SELECT Id, Name, AccountNumber, TickerSymbol FROM Account WHERE Id = :newAcct.Id ];",
                        "\t\tSystem.assertEquals(1, accts.size(), 'should have found new account');",
                        "\t\tSystem.assertEquals(acctName, accts[0].Name, 'incorrect name');",
                        "\t\tSystem.assertEquals(acctNumber, accts[0].AccountNumber, 'incorrect account number');",
                        "\t\tSystem.assertEquals(tickerSymbol, accts[0].TickerSymbol, 'incorrect ticker symbol');",
                        "\t}",
                        "}"
                    ].join('\n');
                    return [4 /*yield*/, createApexClass('AccountServiceTest', testText)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createAnonymousApexFile() {
    return __awaiter(this, void 0, void 0, function () {
        var workbench, inputBox, textEditor, fileContent;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("calling createAnonymousApexFile()");
                    workbench = (0, workbench_1.getWorkbench)();
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('Create: New File...', miscellaneous_1.Duration.seconds(1))];
                case 1:
                    inputBox = _a.sent();
                    // Set the name of the new Anonymous Apex file
                    return [4 /*yield*/, inputBox.setText('Anonymous.apex')];
                case 2:
                    // Set the name of the new Anonymous Apex file
                    _a.sent();
                    return [4 /*yield*/, inputBox.confirm()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, inputBox.confirm()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, textEditorView_1.getTextEditor)(workbench, 'Anonymous.apex')];
                case 5:
                    textEditor = _a.sent();
                    fileContent = ["System.debug('¡Hola mundo!');", ''].join('\n');
                    return [4 /*yield*/, textEditor.setText(fileContent)];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, textEditor.save()];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createApexController() {
    return __awaiter(this, void 0, void 0, function () {
        var classText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("calling createApexController()");
                    classText = [
                        "public class MyController {",
                        "\tprivate final Account account;",
                        "\tpublic MyController() {",
                        "\t\taccount = [SELECT Id, Name, Phone, Site FROM Account ",
                        "\t\tWHERE Id = :ApexPages.currentPage().getParameters().get('id')];",
                        "\t}",
                        "\tpublic Account getAccount() {",
                        "\t\treturn account;",
                        "\t}",
                        "\tpublic PageReference save() {",
                        "\t\tupdate account;",
                        "\t\treturn null;",
                        "\t}",
                        "}"
                    ].join('\n');
                    return [4 /*yield*/, createApexClass('MyController', classText)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
