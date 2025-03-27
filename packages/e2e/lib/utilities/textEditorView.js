"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTextEditor = getTextEditor;
exports.checkFileOpen = checkFileOpen;
exports.attemptToFindTextEditorText = attemptToFindTextEditorText;
const vscode_extension_tester_1 = require("vscode-extension-tester");
const commandPrompt_1 = require("./commandPrompt");
const miscellaneous_1 = require("./miscellaneous");
const workbench_1 = require("./workbench");
/**
 * @param workbench page object representing the custom VSCode title bar
 * @param fileName name of the file we want to open and use
 * @returns editor for the given file name
 */
async function getTextEditor(workbench, fileName) {
    (0, miscellaneous_1.log)(`calling getTextEditor(${fileName})`);
    const inputBox = await (0, commandPrompt_1.executeQuickPick)('Go to File...', miscellaneous_1.Duration.seconds(1));
    await inputBox.setText(fileName);
    await inputBox.confirm();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    const editorView = workbench.getEditorView();
    const textEditor = (await editorView.openEditor(fileName));
    return textEditor;
}
async function checkFileOpen(workbench, name, options = { timeout: miscellaneous_1.Duration.milliseconds(10_000) }) {
    await (0, workbench_1.getBrowser)().wait(async () => {
        try {
            const editorView = workbench.getEditorView();
            const activeTab = await editorView.getActiveTab();
            if (activeTab != undefined && name == (await activeTab.getTitle())) {
                return true;
            }
            else
                return false;
        }
        catch (error) {
            return false;
        }
    }, options.timeout?.milliseconds, options.msg ?? `Expected to find file ${name} open in TextEditor before ${options.timeout}`, 500 // Check every 500 ms
    );
}
async function attemptToFindTextEditorText(filePath) {
    await (0, miscellaneous_1.openFile)(filePath);
    const fileName = filePath.substring(filePath.lastIndexOf(process.platform === 'win32' ? '\\' : '/') + 1);
    const editorView = new vscode_extension_tester_1.EditorView();
    const editor = await editorView.openEditor(fileName);
    return await editor.getText();
}
//# sourceMappingURL=textEditorView.js.map