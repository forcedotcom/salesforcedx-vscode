"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.extensions = void 0;
exports.showRunningExtensions = showRunningExtensions;
exports.reloadAndEnableExtensions = reloadAndEnableExtensions;
exports.getExtensionsToVerifyActive = getExtensionsToVerifyActive;
exports.verifyExtensionsAreRunning = verifyExtensionsAreRunning;
exports.findExtensionsInRunningExtensionsList = findExtensionsInRunningExtensionsList;
exports.checkForUncaughtErrors = checkForUncaughtErrors;
const miscellaneous_1 = require("./miscellaneous");
const utilities = __importStar(require("./index"));
const commandPrompt_1 = require("./commandPrompt");
const vscode_extension_tester_1 = require("vscode-extension-tester");
const chai_1 = require("chai");
const workbench_1 = require("./workbench");
const VERIFY_EXTENSIONS_TIMEOUT = miscellaneous_1.Duration.seconds(60);
exports.extensions = [
    {
        extensionId: 'salesforcedx-vscode',
        name: 'Salesforce Extension Pack',
        vsixPath: '',
        shouldInstall: 'never',
        shouldVerifyActivation: false
    },
    {
        extensionId: 'salesforcedx-vscode-expanded',
        name: 'Salesforce Extension Pack (Expanded)',
        vsixPath: '',
        shouldInstall: 'never',
        shouldVerifyActivation: false
    },
    {
        extensionId: 'salesforcedx-vscode-soql',
        name: 'SOQL',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-einstein-gpt',
        name: 'Einstein for Developers (Beta)',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: false
    },
    {
        extensionId: 'salesforcedx-vscode-core',
        name: 'Salesforce CLI Integration',
        vsixPath: '',
        shouldInstall: 'always',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-vscode-apex',
        name: 'Apex',
        vsixPath: '',
        shouldInstall: 'always',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-vscode-apex-debugger',
        name: 'Apex Interactive Debugger',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-vscode-apex-replay-debugger',
        name: 'Apex Replay Debugger',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-vscode-lightning',
        name: 'Lightning Web Components',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-vscode-lwc',
        name: 'Lightning Web Components',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: true
    },
    {
        extensionId: 'salesforcedx-vscode-visualforce',
        name: 'salesforcedx-vscode-visualforce',
        vsixPath: '',
        shouldInstall: 'optional',
        shouldVerifyActivation: true
    }
];
async function showRunningExtensions() {
    (0, miscellaneous_1.log)('');
    (0, miscellaneous_1.log)(`Starting showRunningExtensions()...`);
    await (0, commandPrompt_1.executeQuickPick)('Developer: Show Running Extensions');
    let re = undefined;
    await (0, workbench_1.getBrowser)().wait(async () => {
        const wb = (0, workbench_1.getWorkbench)();
        const ev = wb.getEditorView();
        re = await ev.openEditor('Running Extensions');
        return re.isDisplayed();
    }, 5000, // Timeout after 5 seconds
    'Expected "Running Extensions" tab to be visible after 5 seconds', 500);
    (0, miscellaneous_1.log)(`... Finished showRunningExtensions()`);
    (0, miscellaneous_1.log)('');
    return re;
}
async function reloadAndEnableExtensions() {
    await utilities.reloadWindow();
    await utilities.enableAllExtensions();
}
function getExtensionsToVerifyActive(predicate = ext => !!ext) {
    return exports.extensions
        .filter(ext => {
        return ext.shouldVerifyActivation;
    })
        .filter(predicate);
}
async function verifyExtensionsAreRunning(extensions, timeout = VERIFY_EXTENSIONS_TIMEOUT) {
    (0, miscellaneous_1.log)('');
    (0, miscellaneous_1.log)(`Starting verifyExtensionsAreRunning()...`);
    if (extensions.length === 0) {
        (0, miscellaneous_1.log)('verifyExtensionsAreRunning - No extensions to verify, continuing test run w/o extension verification');
        return true;
    }
    const extensionsToVerify = extensions.map(extension => extension.extensionId);
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(15));
    await utilities.zoom('Out', 4, miscellaneous_1.Duration.seconds(1));
    let extensionsStatus = [];
    let allActivated = false;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('findExtensionsInRunningExtensionsList timeout')), timeout.milliseconds));
    try {
        await Promise.race([
            (async () => {
                do {
                    extensionsStatus = await findExtensionsInRunningExtensionsList(extensionsToVerify);
                    // Log the current state of the activation check for each extension
                    for (const extensionStatus of extensionsStatus) {
                        (0, miscellaneous_1.log)(
                        // prettier-ignore
                        `Extension ${extensionStatus.extensionId}: ${extensionStatus.activationTime ?? 'Not activated'}`);
                    }
                    allActivated = extensionsToVerify.every(extensionId => extensionsStatus.find(extensionStatus => extensionStatus.extensionId === extensionId)
                        ?.isActivationComplete);
                } while (!allActivated);
            })(),
            timeoutPromise
        ]);
    }
    catch (error) {
        (0, miscellaneous_1.log)(`Error while waiting for extensions to activate: ${error}`);
    }
    await utilities.zoomReset();
    (0, miscellaneous_1.log)('... Finished verifyExtensionsAreRunning()');
    (0, miscellaneous_1.log)('');
    return allActivated;
}
async function findExtensionsInRunningExtensionsList(
// eslint-disable-next-line @typescript-eslint/no-unused-vars
extensionIds) {
    (0, miscellaneous_1.log)('');
    (0, miscellaneous_1.log)('Starting findExtensionsInRunningExtensionsList()...');
    // This function assumes the Extensions list was opened.
    // Close the panel and clear notifications so we can see as many of the running extensions as we can.
    try {
        const center = await (0, workbench_1.getWorkbench)().openNotificationsCenter();
        await center.clearAllNotifications();
        await center.close();
    }
    catch (error) {
        if (error instanceof Error) {
            (0, miscellaneous_1.log)(`Failed clearing all notifications ${error.message}`);
        }
    }
    const runningExtensionsEditor = await showRunningExtensions();
    if (!runningExtensionsEditor) {
        throw new Error('Could not find the running extensions editor');
    }
    // Get all extensions
    const allExtensions = await runningExtensionsEditor.findElements(vscode_extension_tester_1.By.css('div.monaco-list-row > div.extension'));
    const runningExtensions = [];
    for (const extension of allExtensions) {
        const parent = await extension.findElement(vscode_extension_tester_1.By.xpath('..'));
        const extensionId = await parent.getAttribute('aria-label');
        const version = await extension.findElement(vscode_extension_tester_1.By.css('.version')).getText();
        const activationTime = await extension.findElement(vscode_extension_tester_1.By.css('.activation-time')).getText();
        const isActivationComplete = /\:\s*?[0-9]{1,}ms/.test(activationTime);
        let hasBug;
        try {
            const bugError = await parent.findElement(vscode_extension_tester_1.By.css('span.codicon-bug error'));
        }
        catch (error) {
            hasBug = error.message.startsWith('no such element') ? false : true;
        }
        runningExtensions.push({
            extensionId,
            activationTime,
            version,
            isPresent: true,
            hasBug,
            isActivationComplete
        });
    }
    (0, miscellaneous_1.log)('... Finished findExtensionsInRunningExtensionsList()');
    (0, miscellaneous_1.log)('');
    // limit runningExtensions to those whose property extensionId is in the list of extensionIds
    return runningExtensions.filter(extension => extensionIds.includes(extension.extensionId));
}
async function checkForUncaughtErrors() {
    await utilities.showRunningExtensions();
    // Zoom out so all the extensions are visible
    await utilities.zoom('Out', 4, utilities.Duration.seconds(1));
    const uncaughtErrors = (await utilities.findExtensionsInRunningExtensionsList(utilities.getExtensionsToVerifyActive().map(ext => ext.extensionId))).filter(ext => ext.hasBug);
    await utilities.zoomReset();
    uncaughtErrors.forEach(ext => {
        utilities.log(`Extension ${ext.extensionId}:${ext.version ?? 'unknown'} has a bug`);
    });
    (0, chai_1.expect)(uncaughtErrors.length).equal(0);
}
//# sourceMappingURL=extensionUtils.js.map