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
exports.getStatusBarItemWhichIncludes = getStatusBarItemWhichIncludes;
var miscellaneous_1 = require("./miscellaneous");
var workbench_1 = require("./workbench");
function getStatusBarItemWhichIncludes(title) {
    return __awaiter(this, void 0, void 0, function () {
        var workbench, retries, i, statusBar, items, _i, items_1, item, ariaLabel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    workbench = (0, workbench_1.getWorkbench)();
                    retries = 10;
                    i = retries;
                    _a.label = 1;
                case 1:
                    if (!(i > 0)) return [3 /*break*/, 10];
                    return [4 /*yield*/, workbench.getStatusBar().wait()];
                case 2:
                    statusBar = _a.sent();
                    return [4 /*yield*/, statusBar.getItems()];
                case 3:
                    items = _a.sent();
                    _i = 0, items_1 = items;
                    _a.label = 4;
                case 4:
                    if (!(_i < items_1.length)) return [3 /*break*/, 7];
                    item = items_1[_i];
                    return [4 /*yield*/, item.getAttribute('aria-label')];
                case 5:
                    ariaLabel = _a.sent();
                    if (ariaLabel.includes(title)) {
                        (0, miscellaneous_1.log)('Status Bar item found.');
                        return [2 /*return*/, item];
                    }
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7: return [4 /*yield*/, (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1))];
                case 8:
                    _a.sent();
                    _a.label = 9;
                case 9:
                    i--;
                    return [3 /*break*/, 1];
                case 10: throw new Error("Status bar item containing ".concat(title, " was not found"));
            }
        });
    });
}
