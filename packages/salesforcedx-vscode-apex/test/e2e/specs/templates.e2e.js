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
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
var chai_1 = require("chai");
var child_process_1 = require("child_process");
var mocha_steps_1 = require("mocha-steps");
var path_1 = require("path");
var util_1 = require("util");
var vscode_extension_tester_1 = require("vscode-extension-tester");
var analyticsTemplate = require("../testData/sampleAnalyticsTemplateData");
var testSetup_1 = require("../testSetup");
var utilities = require("../utilities/index");
var exec = util_1.default.promisify(child_process_1.default.exec);
describe('Templates', function () { return __awaiter(void 0, void 0, void 0, function () {
    var testSetup, projectName, testReqConfig;
    return __generator(this, function (_a) {
        testReqConfig = {
            projectConfig: {
                projectShape: utilities.ProjectShapeOption.NEW
            },
            isOrgRequired: false,
            testSuiteSuffixName: 'Templates'
        };
        // Set up
        (0, mocha_steps_1.step)('Set up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log('Templates - Set up the testing environment');
                        return [4 /*yield*/, testSetup_1.TestSetup.setUp(testReqConfig)];
                    case 1:
                        testSetup = _a.sent();
                        projectName = testSetup.tempProjectName;
                        return [2 /*return*/];
                }
            });
        }); });
        // Apex Class
        (0, mocha_steps_1.step)('Create an Apex Class', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, filteredTreeViewItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Create an Apex Class"));
                        // Using the Command palette, run SFDX: Create Apex Class.
                        return [4 /*yield*/, utilities.createCommand('Apex Class', 'ApexClass1', 'classes', 'cls')];
                    case 1:
                        // Using the Command palette, run SFDX: Create Apex Class.
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 2:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'ApexClass1')];
                    case 3:
                        filteredTreeViewItems = _a.sent();
                        (0, chai_1.expect)(filteredTreeViewItems.includes('ApexClass1.cls')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('ApexClass1.cls-meta.xml')).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify the contents of the Apex Class', function () { return __awaiter(void 0, void 0, void 0, function () {
            var expectedText, workbench, textEditor, textGeneratedFromTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify the contents of the Apex Class"));
                        expectedText = ['public with sharing class ApexClass1 {', '    public ApexClass1() {', '', '    }', '}'].join('\n');
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ApexClass1.cls')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 3:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
                        return [2 /*return*/];
                }
            });
        }); });
        // Apex Unit Test Class
        (0, mocha_steps_1.step)('Create an Apex Unit Test Class', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, filteredTreeViewItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Create an Apex Unit Test Class"));
                        // Using the Command palette, run SFDX: Create Apex Unit Test Class.
                        return [4 /*yield*/, utilities.createCommand('Apex Unit Test Class', 'ApexUnitTestClass1', 'classes', 'cls')];
                    case 1:
                        // Using the Command palette, run SFDX: Create Apex Unit Test Class.
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 2:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'ApexUnitTestClass1')];
                    case 3:
                        filteredTreeViewItems = _a.sent();
                        (0, chai_1.expect)(filteredTreeViewItems.includes('ApexUnitTestClass1.cls')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('ApexUnitTestClass1.cls-meta.xml')).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify the contents of the Apex Unit Test Class', function () { return __awaiter(void 0, void 0, void 0, function () {
            var expectedText, workbench, textEditor, textGeneratedFromTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify the contents of the Apex Unit Test Class"));
                        expectedText = [
                            '@isTest',
                            'private class ApexUnitTestClass1 {',
                            '',
                            '    @isTest',
                            '    static void myUnitTest() {',
                            '        // TO DO: implement unit test',
                            '    }',
                            '}'
                        ].join('\n');
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ApexUnitTestClass1.cls')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 3:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.contain(expectedText);
                        return [2 /*return*/];
                }
            });
        }); });
        // Apex Trigger
        (0, mocha_steps_1.step)('Create an Apex Trigger', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, filteredTreeViewItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Create an Apex Trigger"));
                        // Using the Command palette, run "SFDX: Create Apex Trigger".
                        return [4 /*yield*/, utilities.createCommand('Apex Trigger', 'ApexTrigger1', 'triggers', 'trigger')];
                    case 1:
                        // Using the Command palette, run "SFDX: Create Apex Trigger".
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 2:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'ApexTrigger1')];
                    case 3:
                        filteredTreeViewItems = _a.sent();
                        (0, chai_1.expect)(filteredTreeViewItems.includes('ApexTrigger1.trigger')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('ApexTrigger1.trigger-meta.xml')).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify the contents of the Apex Trigger', function () { return __awaiter(void 0, void 0, void 0, function () {
            var expectedText, workbench, textEditor, textGeneratedFromTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify the contents of the Apex Trigger"));
                        expectedText = ['trigger ApexTrigger1 on SOBJECT (before insert) {', '', '}'].join('\n');
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ApexTrigger1.trigger')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 3:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
                        return [2 /*return*/];
                }
            });
        }); });
        // Aura App
        (0, mocha_steps_1.step)('Create an Aura App', function () { return __awaiter(void 0, void 0, void 0, function () {
            var outputPanelText, basePath, docPath, cssPath, svgPath, controllerPath, helperPath, rendererPath, workbench, filteredTreeViewItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Create an Aura App"));
                        return [4 /*yield*/, utilities.createCommand('Aura App', 'AuraApp1', path_1.default.join('aura', 'AuraApp1'), 'app')];
                    case 1:
                        outputPanelText = _a.sent();
                        basePath = path_1.default.join('force-app', 'main', 'default', 'aura', 'AuraApp1');
                        docPath = path_1.default.join(basePath, 'AuraApp1.auradoc');
                        (0, chai_1.expect)(outputPanelText).to.contain("create ".concat(docPath));
                        cssPath = path_1.default.join(basePath, 'AuraApp1.css');
                        (0, chai_1.expect)(outputPanelText).to.contain("create ".concat(cssPath));
                        svgPath = path_1.default.join(basePath, 'AuraApp1.svg');
                        (0, chai_1.expect)(outputPanelText).to.contain("create ".concat(svgPath));
                        controllerPath = path_1.default.join(basePath, 'AuraApp1Controller.js');
                        (0, chai_1.expect)(outputPanelText).to.contain("create ".concat(controllerPath));
                        helperPath = path_1.default.join(basePath, 'AuraApp1Helper.js');
                        (0, chai_1.expect)(outputPanelText).to.contain("create ".concat(helperPath));
                        rendererPath = path_1.default.join(basePath, 'AuraApp1Renderer.js');
                        (0, chai_1.expect)(outputPanelText).to.contain("create ".concat(rendererPath));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 2:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'AuraApp1')];
                    case 3:
                        filteredTreeViewItems = _a.sent();
                        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1.app')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1.app-meta.xml')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1.auradoc')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1.css')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1.svg')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1Controller.js')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1Helper.js')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1Renderer.js')).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify the contents of the Aura App', function () { return __awaiter(void 0, void 0, void 0, function () {
            var expectedText, workbench, textEditor, textGeneratedFromTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify the contents of the Aura App"));
                        expectedText = ['<aura:application>', '', '</aura:application>'].join('\n');
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'AuraApp1.app')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 3:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
                        return [2 /*return*/];
                }
            });
        }); });
        // Aura Component
        (0, mocha_steps_1.step)('Create an Aura Component', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, filteredTreeViewItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Create an Aura Component"));
                        // Using the Command palette, run SFDX: Create Aura Component.
                        return [4 /*yield*/, utilities.createCommand('Aura Component', 'auraComponent1', path_1.default.join('aura', 'auraComponent1'), 'cmp')];
                    case 1:
                        // Using the Command palette, run SFDX: Create Aura Component.
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 2:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.zoom('Out', 1, utilities.Duration.seconds(2))];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'auraComponent1')];
                    case 4:
                        filteredTreeViewItems = _a.sent();
                        (0, chai_1.expect)(filteredTreeViewItems.includes('auraComponent1')).to.equal(true);
                        // It's a tree, but it's also a list.  Everything in the view is actually flat
                        // and returned from the call to visibleItems.reduce().
                        (0, chai_1.expect)(filteredTreeViewItems.includes('auraComponent1.cmp')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('auraComponent1.cmp-meta.xml')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('auraComponent1Controller.js')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('auraComponent1Helper.js')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('auraComponent1Renderer.js')).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify the contents of the Aura Component', function () { return __awaiter(void 0, void 0, void 0, function () {
            var expectedText, workbench, textEditor, textGeneratedFromTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify the contents of the Aura Component"));
                        expectedText = ['<aura:component>', '', '</aura:component>'].join('\n');
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'auraComponent1.cmp')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 3:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
                        return [2 /*return*/];
                }
            });
        }); });
        // Aura Event
        (0, mocha_steps_1.step)('Create an Aura Event', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, filteredTreeViewItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Create an Aura Event"));
                        // Using the Command palette, run SFDX: Create Aura Component.
                        return [4 /*yield*/, utilities.createCommand('Aura Event', 'auraEvent1', path_1.default.join('aura', 'auraEvent1'), 'evt')];
                    case 1:
                        // Using the Command palette, run SFDX: Create Aura Component.
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 2:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'auraEvent1')];
                    case 3:
                        filteredTreeViewItems = _a.sent();
                        (0, chai_1.expect)(filteredTreeViewItems.includes('auraEvent1')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('auraEvent1.evt')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('auraEvent1.evt-meta.xml')).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify the contents of the Aura Event', function () { return __awaiter(void 0, void 0, void 0, function () {
            var expectedText, workbench, textEditor, textGeneratedFromTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify the contents of the Aura Event"));
                        expectedText = ['<aura:event type="APPLICATION" description="Event template" />'].join('\n');
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'auraEvent1.evt')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 3:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
                        return [2 /*return*/];
                }
            });
        }); });
        // Aura Interface
        (0, mocha_steps_1.step)('Create an Aura Interface', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, filteredTreeViewItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Create an Aura Interface"));
                        // Using the Command palette, run "SFDX: Create Aura Interface".
                        return [4 /*yield*/, utilities.createCommand('Aura Interface', 'AuraInterface1', path_1.default.join('aura', 'AuraInterface1'), 'intf')];
                    case 1:
                        // Using the Command palette, run "SFDX: Create Aura Interface".
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 2:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'AuraInterface1')];
                    case 3:
                        filteredTreeViewItems = _a.sent();
                        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraInterface1.intf')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraInterface1.intf-meta.xml')).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify the contents of the Aura Interface', function () { return __awaiter(void 0, void 0, void 0, function () {
            var expectedText, workbench, textEditor, textGeneratedFromTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify the contents of the Aura Interface"));
                        expectedText = [
                            '<aura:interface description="Interface template">',
                            '  <aura:attribute name="example" type="String" default="" description="An example attribute."/>',
                            '</aura:interface>'
                        ].join('\n');
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'AuraInterface1.intf')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 3:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
                        return [2 /*return*/];
                }
            });
        }); });
        // Lightning Web Component
        (0, mocha_steps_1.step)('Create Lightning Web Component', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, filteredTreeViewItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Create Lightning Web Component"));
                        // Using the Command palette, run SFDX: Create Lightning Web Component.
                        return [4 /*yield*/, utilities.createCommand('Lightning Web Component', 'lightningWebComponent1', path_1.default.join('lwc', 'lightningWebComponent1'), 'js')];
                    case 1:
                        // Using the Command palette, run SFDX: Create Lightning Web Component.
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 2:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'lightningWebComponent1')];
                    case 3:
                        filteredTreeViewItems = _a.sent();
                        (0, chai_1.expect)(filteredTreeViewItems.includes('lightningWebComponent1')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('lightningWebComponent1.html')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('lightningWebComponent1.js')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('lightningWebComponent1.js-meta.xml')).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify the contents of the Lightning Web Component', function () { return __awaiter(void 0, void 0, void 0, function () {
            var expectedText, workbench, textEditor, textGeneratedFromTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify the contents of the Lightning Web Component"));
                        expectedText = [
                            "import { LightningElement } from 'lwc';",
                            '',
                            'export default class LightningWebComponent1 extends LightningElement {}'
                        ].join('\n');
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'lightningWebComponent1.js')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 3:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
                        return [2 /*return*/];
                }
            });
        }); });
        // Lightning Web Component Test
        (0, mocha_steps_1.xstep)('Create Lightning Web Component Test', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, pathToLwcTest, inputBox, failureNotificationWasFound, outputPanelText, treeViewSection, lwcTestFolder, testItem;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Create Lightning Web Component Test"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        pathToLwcTest = path_1.default.join('force-app', 'main', 'default', 'lwc', 'lightningWebComponent1', '__tests__', 'lightningWebComponent1.test.js');
                        exec(process.platform === 'win32' ? "del ".concat(pathToLwcTest) : "rm ".concat(pathToLwcTest), {
                            cwd: testSetup.projectFolderPath
                        });
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Create Lightning Web Component Test', utilities.Duration.seconds(1))];
                    case 2:
                        inputBox = _a.sent();
                        // Set the name of the new test to lightningWebComponent1.
                        return [4 /*yield*/, inputBox.confirm()];
                    case 3:
                        // Set the name of the new test to lightningWebComponent1.
                        _a.sent();
                        return [4 /*yield*/, inputBox.setText('lightningWebComponent1')];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, inputBox.confirm()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(60))];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Create Lightning Web Component Test failed to run', utilities.Duration.TEN_MINUTES)];
                    case 7:
                        failureNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(failureNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Create Lightning Web Component Test', 10)];
                    case 8:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        // Check for expected item in the Explorer view.
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'lightningWebComponent1.test.js')];
                    case 9:
                        // Check for expected item in the Explorer view.
                        _a.sent();
                        return [4 /*yield*/, utilities.expandProjectInSideBar(workbench, projectName)];
                    case 10:
                        treeViewSection = _a.sent();
                        return [4 /*yield*/, treeViewSection.findItem('__tests__')];
                    case 11:
                        lwcTestFolder = _a.sent();
                        return [4 /*yield*/, (lwcTestFolder === null || lwcTestFolder === void 0 ? void 0 : lwcTestFolder.select())];
                    case 12:
                        _a.sent();
                        return [4 /*yield*/, treeViewSection.findItem('lightningWebComponent1.test.js')];
                    case 13:
                        testItem = _a.sent();
                        (0, chai_1.expect)(testItem).to.not.be.undefined;
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.xstep)('Verify the contents of the Lightning Web Component Test', function () { return __awaiter(void 0, void 0, void 0, function () {
            var expectedText, workbench, textEditor, textGeneratedFromTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify the contents of the Lightning Web Component Test"));
                        expectedText = [
                            "import { createElement } from 'lwc';",
                            "import LightningWebComponent1 from 'c/lightningWebComponent1';",
                            '',
                            "describe('c-lightning-web-component1', () => {",
                            '    afterEach(() => {',
                            '        // The jsdom instance is shared across test cases in a single file so reset the DOM',
                            '        while (document.body.firstChild) {',
                            '            document.body.removeChild(document.body.firstChild);',
                            '        }',
                            '    });',
                            '',
                            "    it('TODO: test case generated by CLI command, please fill in test logic', () => {",
                            "        const element = createElement('c-lightning-web-component1', {",
                            '            is: LightningWebComponent1',
                            '        });',
                            '        document.body.appendChild(element);',
                            '        expect(1).toBe(2);',
                            '    });',
                            '});'
                        ].join('\n');
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'lightningWebComponent1.test.js')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 3:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
                        return [2 /*return*/];
                }
            });
        }); });
        // Visualforce Component
        (0, mocha_steps_1.step)('Create a Visualforce Component', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, filteredTreeViewItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Create a Visualforce Component"));
                        // Using the Command palette, run "SFDX: Create Visualforce Component".
                        return [4 /*yield*/, utilities.createCommand('Visualforce Component', 'VisualforceCmp1', 'components', 'component')];
                    case 1:
                        // Using the Command palette, run "SFDX: Create Visualforce Component".
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 2:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'VisualforceCmp1')];
                    case 3:
                        filteredTreeViewItems = _a.sent();
                        (0, chai_1.expect)(filteredTreeViewItems.includes('VisualforceCmp1.component')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('VisualforceCmp1.component-meta.xml')).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify the contents of the Visualforce Component', function () { return __awaiter(void 0, void 0, void 0, function () {
            var expectedText, workbench, textEditor, textGeneratedFromTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify the contents of the Visualforce Component"));
                        expectedText = [
                            '<apex:component >',
                            '<!-- Begin Default Content REMOVE THIS -->',
                            '<h1>Congratulations</h1>',
                            'This is your new Component',
                            '<!-- End Default Content REMOVE THIS -->',
                            '</apex:component>'
                        ].join('\n');
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'VisualforceCmp1.component')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 3:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
                        return [2 /*return*/];
                }
            });
        }); });
        // Visualforce Page
        (0, mocha_steps_1.step)('Create a Visualforce Page', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, filteredTreeViewItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Create a Visualforce Page"));
                        // Using the Command palette, run "SFDX: Create Visualforce Page".
                        return [4 /*yield*/, utilities.createCommand('Visualforce Page', 'VisualforcePage1', 'pages', 'page')];
                    case 1:
                        // Using the Command palette, run "SFDX: Create Visualforce Page".
                        _a.sent();
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 2:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'VisualforcePage1')];
                    case 3:
                        filteredTreeViewItems = _a.sent();
                        (0, chai_1.expect)(filteredTreeViewItems.includes('VisualforcePage1.page')).to.equal(true);
                        (0, chai_1.expect)(filteredTreeViewItems.includes('VisualforcePage1.page-meta.xml')).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify the contents of the Visualforce Page', function () { return __awaiter(void 0, void 0, void 0, function () {
            var expectedText, workbench, textEditor, textGeneratedFromTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify the contents of the Visualforce Page"));
                        expectedText = [
                            '<apex:page >',
                            '<!-- Begin Default Content REMOVE THIS -->',
                            '<h1>Congratulations</h1>',
                            'This is your new Page',
                            '<!-- End Default Content REMOVE THIS -->',
                            '</apex:page>'
                        ].join('\n');
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'VisualforcePage1.page')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 3:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
                        return [2 /*return*/];
                }
            });
        }); });
        // Sample Analytics Template
        (0, mocha_steps_1.step)('Create a Sample Analytics Template', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, inputBox, successNotificationWasFound, outputPanelText, treeViewItems;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Create a Sample Analytics Template"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.clearOutputView()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, utilities.executeQuickPick('SFDX: Create Sample Analytics Template', utilities.Duration.seconds(1))];
                    case 3:
                        inputBox = _a.sent();
                        // Set the name of the new page to sat1
                        return [4 /*yield*/, inputBox.setText('sat1')];
                    case 4:
                        // Set the name of the new page to sat1
                        _a.sent();
                        return [4 /*yield*/, inputBox.confirm()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, utilities.pause(utilities.Duration.seconds(1))];
                    case 6:
                        _a.sent();
                        // Select the default directory (press Enter/Return).
                        return [4 /*yield*/, inputBox.confirm()];
                    case 7:
                        // Select the default directory (press Enter/Return).
                        _a.sent();
                        return [4 /*yield*/, utilities.notificationIsPresentWithTimeout('SFDX: Create Sample Analytics Template successfully ran', utilities.Duration.TEN_MINUTES)];
                    case 8:
                        successNotificationWasFound = _a.sent();
                        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
                        return [4 /*yield*/, utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Finished SFDX: Create Sample Analytics Template', 10)];
                    case 9:
                        outputPanelText = _a.sent();
                        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
                        return [4 /*yield*/, utilities.getVisibleItemsFromSidebar(workbench, projectName)];
                    case 10:
                        treeViewItems = _a.sent();
                        (0, chai_1.expect)(treeViewItems.includes('dashboards')).to.equal(true);
                        (0, chai_1.expect)(treeViewItems.includes('app-to-template-rules.json')).to.equal(true);
                        (0, chai_1.expect)(treeViewItems.includes('folder.json')).to.equal(true);
                        (0, chai_1.expect)(treeViewItems.includes('releaseNotes.html')).to.equal(true);
                        (0, chai_1.expect)(treeViewItems.includes('template-info.json')).to.equal(true);
                        (0, chai_1.expect)(treeViewItems.includes('template-to-app-rules.json')).to.equal(true);
                        (0, chai_1.expect)(treeViewItems.includes('ui.json')).to.equal(true);
                        (0, chai_1.expect)(treeViewItems.includes('variables.json')).to.equal(true);
                        return [2 /*return*/];
                }
            });
        }); });
        (0, mocha_steps_1.step)('Verify the contents of the Sample Analytics Template', function () { return __awaiter(void 0, void 0, void 0, function () {
            var workbench, textEditor, textGeneratedFromTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        utilities.log("".concat(testSetup.testSuiteSuffixName, " - Verify the contents of the Sample Analytics Template"));
                        return [4 /*yield*/, utilities.getWorkbench()];
                    case 1:
                        workbench = _a.sent();
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'app-to-template-rules.json')];
                    case 2:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 3:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.appToTemplateRules);
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'folder.json')];
                    case 4:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 5:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.folder);
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'releaseNotes.html')];
                    case 6:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 7:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.releaseNotes);
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'template-info.json')];
                    case 8:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 9:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.templateInfo);
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'template-to-app-rules.json')];
                    case 10:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 11:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.templateToAppRules);
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'ui.json')];
                    case 12:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 13:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.ui);
                        return [4 /*yield*/, utilities.getTextEditor(workbench, 'variables.json')];
                    case 14:
                        textEditor = _a.sent();
                        return [4 /*yield*/, textEditor.getText()];
                    case 15:
                        textGeneratedFromTemplate = (_a.sent()).trimEnd().replace(/\r\n/g, '\n');
                        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.variables);
                        return [2 /*return*/];
                }
            });
        }); });
        // Tear down
        (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (testSetup === null || testSetup === void 0 ? void 0 : testSetup.tearDown())];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        return [2 /*return*/];
    });
}); });
