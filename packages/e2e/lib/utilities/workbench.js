"use strict";
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
const vscode_extension_tester_1 = require("vscode-extension-tester");
const commandPrompt_1 = require("./commandPrompt");
const miscellaneous_1 = require("./miscellaneous");
function getWorkbench() {
    (0, miscellaneous_1.debug)('calling getWorkbench()');
    return new vscode_extension_tester_1.Workbench();
}
function getBrowser() {
    (0, miscellaneous_1.debug)('calling getBrowser()');
    return vscode_extension_tester_1.VSBrowser.instance.driver;
}
async function reloadWindow(predicateOrWait = miscellaneous_1.Duration.milliseconds(0)) {
    (0, miscellaneous_1.log)(`Reloading window`);
    const prompt = await (0, commandPrompt_1.executeQuickPick)('Developer: Reload Window');
    await handlePredicateOrWait(predicateOrWait, prompt);
}
async function closeCurrentEditor() {
    (0, miscellaneous_1.log)(`Closing current editor`);
    await (0, commandPrompt_1.executeQuickPick)('View: Close Editor');
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
}
async function closeAllEditors() {
    (0, miscellaneous_1.log)(`Closing all editors`);
    await (0, commandPrompt_1.executeQuickPick)('View: Close All Editors');
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
}
async function enableAllExtensions() {
    (0, miscellaneous_1.log)(`Enabling all extensions`);
    await (0, commandPrompt_1.executeQuickPick)('Extensions: Enable All Extensions');
}
async function showExplorerView() {
    (0, miscellaneous_1.log)('Show Explorer');
    const control = await new vscode_extension_tester_1.ActivityBar().getViewControl('Explorer');
    if (!control) {
        throw new Error('Could not open Explorer view in activity bar');
    }
    await control.openView();
}
async function zoom(zoomIn, zoomLevel, wait = miscellaneous_1.Duration.seconds(1)) {
    await zoomReset(wait);
    for (let level = 0; level < zoomLevel; level++) {
        await (0, commandPrompt_1.executeQuickPick)(`View: Zoom ${zoomIn}`, wait);
    }
}
async function zoomReset(wait = miscellaneous_1.Duration.seconds(1)) {
    await (0, commandPrompt_1.executeQuickPick)('View: Reset Zoom', wait);
}
async function openNewTerminal() {
    await new vscode_extension_tester_1.BottomBarPanel().openTerminalView();
}
async function handlePredicateOrWait(predicateOrWait, prompt) {
    (0, miscellaneous_1.log)('handlePredicateOrWait');
    if ((0, miscellaneous_1.isDuration)(predicateOrWait)) {
        if (predicateOrWait.milliseconds > 0) {
            await (0, miscellaneous_1.pause)(predicateOrWait);
        }
    }
    else {
        const { predicate, maxWaitTime } = predicateOrWait;
        const safePredicate = withFailsafe(predicate, maxWaitTime, prompt);
        try {
            const result = await safePredicate();
            if (result !== true) {
                throw new Error('Predicate did not resolve to true');
            }
        }
        catch (error) {
            (0, miscellaneous_1.log)(`Predicate failed or timed out: ${error.message}`);
            throw error;
        }
    }
}
function withFailsafe(predicate, timeout, prompt) {
    return async function () {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Predicate timed out')), timeout.milliseconds));
        return Promise.race([predicate(prompt), timeoutPromise]);
    };
}
//# sourceMappingURL=workbench.js.map