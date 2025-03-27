"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
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
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const miscellaneous_1 = require("./miscellaneous");
const fast_glob_1 = __importDefault(require("fast-glob"));
function createFolder(folderPath) {
    fs.mkdirSync(folderPath, { recursive: true });
}
function removeFolder(folderPath) {
    fs.rmdirSync(folderPath, { recursive: true });
}
async function createCustomObjects(testSetup) {
    const projectPath = testSetup.projectFolderPath;
    const tempFolderPath = testSetup.tempFolderPath;
    if (!tempFolderPath) {
        throw new Error('tempFolderPath is undefined');
    }
    const source = path_1.default.join(tempFolderPath, '..', 'test', 'testData', 'CustomSObjects');
    const destination = path_1.default.join(projectPath, 'force-app', 'main', 'default', 'objects');
    // Ensure the project path has been created
    fs.mkdirSync(path_1.default.dirname(destination), { recursive: true });
    const copyRecursive = (src, dest) => {
        if (fs.statSync(src).isDirectory()) {
            fs.mkdirSync(dest, { recursive: true });
            fs.readdirSync(src).forEach(child => {
                copyRecursive(path_1.default.join(src, child), path_1.default.join(dest, child));
            });
        }
        else {
            fs.copyFileSync(src, dest);
        }
    };
    try {
        copyRecursive(source, destination);
    }
    catch (error) {
        if (error instanceof Error) {
            (0, miscellaneous_1.log)(`Failed in copying custom objects ${error.message}`);
        }
        (0, miscellaneous_1.log)(`source was: '${source}'`);
        (0, miscellaneous_1.log)(`destination was: '${destination}'`);
        await testSetup?.tearDown();
        throw error;
    }
}
async function createGlobalSnippetsFile(testSetup) {
    const projectPath = testSetup.projectFolderPath;
    const tempFolderPath = testSetup.tempFolderPath;
    if (!tempFolderPath) {
        throw new Error('tempFolderPath is undefined');
    }
    const destination = path_1.default.join(projectPath, '.vscode', 'apex.json.code-snippets');
    const apexSnippet = [
        `{`,
        `"SOQL": {`,
        `"prefix": "soql",`,
        `"body": [`,
        `  "[SELECT \${1:field1, field2} FROM \${2:SobjectName} WHERE \${3:clause}];"`,
        `],`,
        `"description": "Apex SOQL query"`,
        `}`,
        `}`
    ].join('\n');
    try {
        fs.writeFileSync(destination, apexSnippet);
    }
    catch (error) {
        if (error instanceof Error) {
            (0, miscellaneous_1.log)(`Failed in creating apex snippets file ${error.message}`);
        }
        (0, miscellaneous_1.log)(`destination was: '${destination}'`);
        await testSetup?.tearDown();
        throw error;
    }
}
/**
 * Scans the directory for vsix files and returns the full path to each file
 * @param vsixDir
 * @returns
 */
function getVsixFilesFromDir(vsixDir) {
    return fast_glob_1.default.sync('**/*.vsix', { cwd: vsixDir }).map(vsixFile => path_1.default.join(vsixDir, vsixFile));
}
/**
 * Return folder name if given path is a directory, otherwise return null
 * @param folderPath
 * @returns folder name
 */
function getFolderName(folderPath) {
    try {
        // Check if the given path exists and if it is a directory
        const stats = fs.statSync(folderPath);
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
//# sourceMappingURL=fileSystem.js.map