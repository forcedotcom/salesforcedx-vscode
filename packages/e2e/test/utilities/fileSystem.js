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
exports.createFolder = createFolder;
exports.removeFolder = removeFolder;
exports.createCustomObjects = createCustomObjects;
exports.createGlobalSnippetsFile = createGlobalSnippetsFile;
exports.getVsixFilesFromDir = getVsixFilesFromDir;
exports.getFolderName = getFolderName;
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
var fs = require("fs");
var path_1 = require("path");
var miscellaneous_1 = require("./miscellaneous");
var fast_glob_1 = require("fast-glob");
function createFolder(folderPath) {
    fs.mkdirSync(folderPath, { recursive: true });
}
function removeFolder(folderPath) {
    fs.rmdirSync(folderPath, { recursive: true });
}
function createCustomObjects(testSetup) {
    return __awaiter(this, void 0, void 0, function () {
        var projectPath, tempFolderPath, source, destination, copyRecursive, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    projectPath = testSetup.projectFolderPath;
                    tempFolderPath = testSetup.tempFolderPath;
                    if (!tempFolderPath) {
                        throw new Error('tempFolderPath is undefined');
                    }
                    source = path_1.default.join(tempFolderPath, '..', 'test', 'testData', 'CustomSObjects');
                    destination = path_1.default.join(projectPath, 'force-app', 'main', 'default', 'objects');
                    // Ensure the project path has been created
                    fs.mkdirSync(path_1.default.dirname(destination), { recursive: true });
                    copyRecursive = function (src, dest) {
                        if (fs.statSync(src).isDirectory()) {
                            fs.mkdirSync(dest, { recursive: true });
                            fs.readdirSync(src).forEach(function (child) {
                                copyRecursive(path_1.default.join(src, child), path_1.default.join(dest, child));
                            });
                        }
                        else {
                            fs.copyFileSync(src, dest);
                        }
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 2, , 4]);
                    copyRecursive(source, destination);
                    return [3 /*break*/, 4];
                case 2:
                    error_1 = _a.sent();
                    if (error_1 instanceof Error) {
                        (0, miscellaneous_1.log)("Failed in copying custom objects ".concat(error_1.message));
                    }
                    (0, miscellaneous_1.log)("source was: '".concat(source, "'"));
                    (0, miscellaneous_1.log)("destination was: '".concat(destination, "'"));
                    return [4 /*yield*/, (testSetup === null || testSetup === void 0 ? void 0 : testSetup.tearDown())];
                case 3:
                    _a.sent();
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
function createGlobalSnippetsFile(testSetup) {
    return __awaiter(this, void 0, void 0, function () {
        var projectPath, tempFolderPath, destination, apexSnippet, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    projectPath = testSetup.projectFolderPath;
                    tempFolderPath = testSetup.tempFolderPath;
                    if (!tempFolderPath) {
                        throw new Error('tempFolderPath is undefined');
                    }
                    destination = path_1.default.join(projectPath, '.vscode', 'apex.json.code-snippets');
                    apexSnippet = [
                        "{",
                        "\"SOQL\": {",
                        "\"prefix\": \"soql\",",
                        "\"body\": [",
                        "  \"[SELECT ${1:field1, field2} FROM ${2:SobjectName} WHERE ${3:clause}];\"",
                        "],",
                        "\"description\": \"Apex SOQL query\"",
                        "}",
                        "}"
                    ].join('\n');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 2, , 4]);
                    fs.writeFileSync(destination, apexSnippet);
                    return [3 /*break*/, 4];
                case 2:
                    error_2 = _a.sent();
                    if (error_2 instanceof Error) {
                        (0, miscellaneous_1.log)("Failed in creating apex snippets file ".concat(error_2.message));
                    }
                    (0, miscellaneous_1.log)("destination was: '".concat(destination, "'"));
                    return [4 /*yield*/, (testSetup === null || testSetup === void 0 ? void 0 : testSetup.tearDown())];
                case 3:
                    _a.sent();
                    throw error_2;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Scans the directory for vsix files and returns the full path to each file
 * @param vsixDir
 * @returns
 */
function getVsixFilesFromDir(vsixDir) {
    return fast_glob_1.default.sync('**/*.vsix', { cwd: vsixDir }).map(function (vsixFile) { return path_1.default.join(vsixDir, vsixFile); });
}
/**
 * Return folder name if given path is a directory, otherwise return null
 * @param folderPath
 * @returns folder name
 */
function getFolderName(folderPath) {
    try {
        // Check if the given path exists and if it is a directory
        var stats = fs.statSync(folderPath);
        if (stats.isDirectory()) {
            // Extract and return the folder name
            return path_1.default.basename(folderPath);
        }
        else {
            return null; // It's not a directory
        }
    }
    catch (err) {
        console.error('Error checking path:', err);
        return null; // The path doesn't exist or isn't accessible
    }
}
