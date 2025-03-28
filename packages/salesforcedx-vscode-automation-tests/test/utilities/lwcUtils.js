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
exports.createLwc = createLwc;
exports.createAura = createAura;
var commandPrompt_1 = require("./commandPrompt");
var miscellaneous_1 = require("./miscellaneous");
var textEditorView_1 = require("./textEditorView");
var workbench_1 = require("./workbench");
function createLwc(name) {
    return __awaiter(this, void 0, void 0, function () {
        var workbench, inputBox, textEditor, jsText, htmlText, nameCapitalized, testText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)('createLwc() - calling getWorkbench()');
                    workbench = (0, workbench_1.getWorkbench)();
                    (0, miscellaneous_1.log)('createLwc() - Running SFDX: Create Lightning Web Component');
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('SFDX: Create Lightning Web Component', miscellaneous_1.Duration.seconds(1))];
                case 1:
                    inputBox = _a.sent();
                    (0, miscellaneous_1.log)('createLwc() - Set the name of the new component');
                    // Set the name of the new component
                    return [4 /*yield*/, inputBox.setText(name)];
                case 2:
                    // Set the name of the new component
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
                    (0, miscellaneous_1.log)('createLwc() - Modify js content');
                    return [4 /*yield*/, (0, textEditorView_1.getTextEditor)(workbench, name + '.js')];
                case 8:
                    textEditor = _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 9:
                    _a.sent();
                    jsText = [
                        "import { LightningElement } from 'lwc';",
                        "",
                        "export default class ".concat(name, " extends LightningElement {"),
                        "\tgreeting = 'World';",
                        "}"
                    ].join('\n');
                    return [4 /*yield*/, textEditor.setText(jsText)];
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
                    (0, miscellaneous_1.log)('createLwc() - Modify html content');
                    (0, miscellaneous_1.log)('');
                    return [4 /*yield*/, (0, textEditorView_1.getTextEditor)(workbench, name + '.html')];
                case 14:
                    // Modify html content
                    textEditor = _a.sent();
                    htmlText = [
                        "<template>",
                        "\t<lightning-card title=\"".concat(name, "\" icon-name=\"custom:custom14\">"),
                        "\t\t<div class=\"slds-var-m-around_medium\">Hello, {greeting}!</div>",
                        "\t</lightning-card>",
                        "",
                        "</template>"
                    ].join('\n');
                    return [4 /*yield*/, textEditor.setText(htmlText)];
                case 15:
                    _a.sent();
                    return [4 /*yield*/, textEditor.save()];
                case 16:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 17:
                    _a.sent();
                    (0, miscellaneous_1.log)('createLwc() - Modify test content');
                    (0, miscellaneous_1.log)('');
                    return [4 /*yield*/, (0, textEditorView_1.getTextEditor)(workbench, name + '.test.js')];
                case 18:
                    textEditor = _a.sent();
                    nameCapitalized = name.charAt(0).toUpperCase() + name.slice(1);
                    testText = [
                        "import { createElement } from 'lwc';",
                        "import ".concat(nameCapitalized, " from 'c/").concat(name, "';"),
                        '',
                        "describe('c-".concat(name, "', () => {"),
                        "    afterEach(() => {",
                        "        while (document.body.firstChild) {",
                        "            document.body.removeChild(document.body.firstChild);",
                        "        }",
                        "    });",
                        "",
                        "    it('displays greeting', () => {",
                        "        const element = createElement('c-".concat(name, "', {"),
                        "            is: ".concat(nameCapitalized),
                        "        });",
                        "        document.body.appendChild(element);",
                        "        const div = element.shadowRoot.querySelector('div');",
                        "        expect(div.textContent).toBe('Hello, World!');",
                        "    });",
                        "",
                        "    it('is defined', async () => {",
                        "        const element = createElement('c-".concat(name, "', {"),
                        "            is: ".concat(nameCapitalized),
                        "        });",
                        "        document.body.appendChild(element);",
                        "        await expect(element).toBeDefined();",
                        "    });",
                        "});"
                    ].join('\n');
                    return [4 /*yield*/, textEditor.setText(testText)];
                case 19:
                    _a.sent();
                    return [4 /*yield*/, textEditor.save()];
                case 20:
                    _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 21:
                    _a.sent();
                    // Set breakpoints
                    return [4 /*yield*/, textEditor.toggleBreakpoint(17)];
                case 22:
                    // Set breakpoints
                    _a.sent();
                    return [4 /*yield*/, textEditor.toggleBreakpoint(25)];
                case 23:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createAura(name) {
    return __awaiter(this, void 0, void 0, function () {
        var workbench, inputBox, textEditor, htmlText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    workbench = (0, workbench_1.getWorkbench)();
                    (0, miscellaneous_1.log)('createAura() - Running SFDX: Create Aura Component');
                    return [4 /*yield*/, (0, commandPrompt_1.executeQuickPick)('SFDX: Create Aura Component', miscellaneous_1.Duration.seconds(1))];
                case 1:
                    inputBox = _a.sent();
                    (0, miscellaneous_1.log)('createAura() - Set the name of the new component');
                    // Set the name of the new component
                    return [4 /*yield*/, inputBox.setText(name)];
                case 2:
                    // Set the name of the new component
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
                    (0, miscellaneous_1.log)('createAura() - Modify html content');
                    return [4 /*yield*/, (0, textEditorView_1.getTextEditor)(workbench, name + '.cmp')];
                case 8:
                    textEditor = _a.sent();
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 9:
                    _a.sent();
                    htmlText = [
                        '<aura:component>',
                        '\t',
                        '\t<aura:attribute name="simpleNewContact" type="Object"/>',
                        '\t<div class="slds-page-header" role="banner">',
                        '\t\t<h1 class="slds-m-right_small">Create New Contact</h1>',
                        '\t</div>',
                        '\t<aura:if isTrue="{!not(empty(v.simpleNewContact))}">',
                        '\t\t{!v.simpleNewContact}',
                        '\t</aura:if>',
                        '</aura:component>'
                    ].join('\n');
                    return [4 /*yield*/, textEditor.setText(htmlText)];
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
                    return [2 /*return*/];
            }
        });
    });
}
