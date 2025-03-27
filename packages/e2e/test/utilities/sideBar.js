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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandProjectInSideBar = expandProjectInSideBar;
exports.getVisibleItemsFromSidebar = getVisibleItemsFromSidebar;
exports.getFilteredVisibleTreeViewItems = getFilteredVisibleTreeViewItems;
exports.getFilteredVisibleTreeViewItemLabels = getFilteredVisibleTreeViewItemLabels;
exports.getVisibleChild = getVisibleChild;
exports.getVisibleChildren = getVisibleChildren;
exports.getVisibleItems = getVisibleItems;
exports.verifyProjectLoaded = verifyProjectLoaded;
var vscode_extension_tester_1 = require("vscode-extension-tester");
var miscellaneous_1 = require("./miscellaneous");
var chai_1 = require("chai");
var workbench_1 = require("./workbench");
function expandProjectInSideBar(workbench, projectName) {
    return __awaiter(this, void 0, void 0, function () {
        var sidebar, _a, content, treeViewSection;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    (0, miscellaneous_1.debug)('expandProjectInSideBar()');
                    return [4 /*yield*/, (0, workbench_1.showExplorerView)()];
                case 1:
                    _b.sent();
                    sidebar = workbench.getSideBar();
                    _a = chai_1.expect;
                    return [4 /*yield*/, sidebar.isDisplayed()];
                case 2:
                    _a.apply(void 0, [_b.sent()]).to.equal(true);
                    content = sidebar.getContent();
                    return [4 /*yield*/, content.getSection(projectName)];
                case 3:
                    treeViewSection = _b.sent();
                    return [4 /*yield*/, treeViewSection.expand()];
                case 4:
                    _b.sent();
                    return [2 /*return*/, treeViewSection];
            }
        });
    });
}
function getVisibleItemsFromSidebar(workbench, projectName) {
    return __awaiter(this, void 0, void 0, function () {
        var treeViewSection, visibleItems, visibleItemsLabels;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.debug)('getVisibleItemsFromSidebar()');
                    return [4 /*yield*/, expandProjectInSideBar(workbench, projectName)];
                case 1:
                    treeViewSection = _a.sent();
                    return [4 /*yield*/, treeViewSection.getVisibleItems()];
                case 2:
                    visibleItems = (_a.sent());
                    return [4 /*yield*/, Promise.all(visibleItems.map(function (item) { return item.getLabel().then(function (label) { return label; }); }))];
                case 3:
                    visibleItemsLabels = _a.sent();
                    return [2 /*return*/, visibleItemsLabels];
            }
        });
    });
}
function getFilteredVisibleTreeViewItems(workbench, projectName, searchString) {
    return __awaiter(this, void 0, void 0, function () {
        var treeViewSection, visibleItems, filteredItems;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.debug)('getFilteredVisibleTreeViewItems()');
                    return [4 /*yield*/, expandProjectInSideBar(workbench, projectName)];
                case 1:
                    treeViewSection = _a.sent();
                    return [4 /*yield*/, treeViewSection.getVisibleItems()];
                case 2:
                    visibleItems = (_a.sent());
                    return [4 /*yield*/, visibleItems.reduce(function (previousPromise, currentItem) { return __awaiter(_this, void 0, void 0, function () {
                            var results, label;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, previousPromise];
                                    case 1:
                                        results = _a.sent();
                                        return [4 /*yield*/, currentItem.getLabel()];
                                    case 2:
                                        label = _a.sent();
                                        if (label.startsWith(searchString)) {
                                            results.push(currentItem);
                                        }
                                        return [2 /*return*/, results];
                                }
                            });
                        }); }, Promise.resolve([]))];
                case 3:
                    filteredItems = _a.sent();
                    return [2 /*return*/, filteredItems];
            }
        });
    });
}
// It's a tree, but it's also a list.  Everything in the view is actually flat
// and returned from the call to visibleItems.reduce().
function getFilteredVisibleTreeViewItemLabels(workbench, projectName, searchString) {
    return __awaiter(this, void 0, void 0, function () {
        var treeViewSection, visibleItems, filteredItems;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, expandProjectInSideBar(workbench, projectName)];
                case 1:
                    treeViewSection = _a.sent();
                    return [4 /*yield*/, treeViewSection.getVisibleItems()];
                case 2:
                    visibleItems = (_a.sent());
                    return [4 /*yield*/, visibleItems.reduce(function (previousPromise, currentItem) { return __awaiter(_this, void 0, void 0, function () {
                            var results, label;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, previousPromise];
                                    case 1:
                                        results = _a.sent();
                                        return [4 /*yield*/, currentItem.getLabel()];
                                    case 2:
                                        label = _a.sent();
                                        if (label.startsWith(searchString)) {
                                            results.push(label);
                                        }
                                        return [2 /*return*/, results];
                                }
                            });
                        }); }, Promise.resolve([]))];
                case 3:
                    filteredItems = (_a.sent());
                    return [2 /*return*/, filteredItems];
            }
        });
    });
}
function getVisibleChild(defaultTreeItem, name) {
    return __awaiter(this, void 0, void 0, function () {
        var children, i, child, label;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getVisibleChildren(defaultTreeItem)];
                case 1:
                    children = _a.sent();
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < children.length)) return [3 /*break*/, 5];
                    child = children[i];
                    return [4 /*yield*/, child.getLabel()];
                case 3:
                    label = _a.sent();
                    if (label === name) {
                        return [2 /*return*/, child];
                    }
                    _a.label = 4;
                case 4:
                    i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, undefined];
            }
        });
    });
}
// Replicate DefaultTreeItem.getChildren()
// getVisibleChildren() is very much like DefaultTreeItem.getChildren(), except it calls
// getVisibleItems().
function getVisibleChildren(defaultTreeItem) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            console.log("".concat(defaultTreeItem));
            // const rows = await getVisibleItems(
            //   defaultTreeItem,
            //   defaultTreeItem.locatorMap.DefaultTreeSection.itemRow as string
            // );
            // const items = await Promise.all(
            //   rows.map(async (row) =>
            //     new DefaultTreeItem(
            //       defaultTreeItem.locatorMap,
            //       // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
            //       row as any,
            //       defaultTreeItem.viewPart
            //     ).wait()
            //   )
            // );
            return [2 /*return*/, []];
        });
    });
}
// Replicate TreeItem.getChildItems()
// This function returns a list of all visible items within the tree, and not just the children of a node.
function getVisibleItems(treeItem, locator) {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, treeItem.expand()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, treeItem.findElement(vscode_extension_tester_1.By.xpath('..')).findElements(locator)];
                case 2:
                    rows = _a.sent();
                    return [2 /*return*/, __spreadArray([], rows.values(), true)];
            }
        });
    });
}
function verifyProjectLoaded(projectName) {
    return __awaiter(this, void 0, void 0, function () {
        var workbench, sidebar, content, treeViewSection, forceAppTreeItem;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, miscellaneous_1.log)("".concat(projectName, " - Verifying project was created..."));
                    // Reload the VS Code window
                    return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(5))];
                case 1:
                    // Reload the VS Code window
                    _a.sent();
                    workbench = (0, workbench_1.getWorkbench)();
                    return [4 /*yield*/, (0, workbench_1.reloadWindow)(miscellaneous_1.Duration.seconds(10))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, workbench_1.showExplorerView)()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, workbench.getSideBar().wait()];
                case 4:
                    sidebar = _a.sent();
                    return [4 /*yield*/, sidebar.getContent().wait()];
                case 5:
                    content = _a.sent();
                    return [4 /*yield*/, content.getSection(projectName)];
                case 6:
                    treeViewSection = _a.sent();
                    if (!treeViewSection) {
                        throw new Error('In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)');
                    }
                    return [4 /*yield*/, treeViewSection.findItem('force-app')];
                case 7:
                    forceAppTreeItem = (_a.sent());
                    if (!forceAppTreeItem) {
                        throw new Error('In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)');
                    }
                    return [4 /*yield*/, forceAppTreeItem.wait()];
                case 8: return [4 /*yield*/, (_a.sent()).expand()];
                case 9:
                    _a.sent();
                    (0, miscellaneous_1.log)("".concat(projectName, " - Verifying project complete"));
                    return [2 /*return*/];
            }
        });
    });
}
