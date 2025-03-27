import { TextEditor, Workbench } from 'vscode-extension-tester';
import { Duration } from './miscellaneous';
/**
 * @param workbench page object representing the custom VSCode title bar
 * @param fileName name of the file we want to open and use
 * @returns editor for the given file name
 */
export declare function getTextEditor(workbench: Workbench, fileName: string): Promise<TextEditor>;
export declare function checkFileOpen(workbench: Workbench, name: string, options?: {
    msg?: string;
    timeout?: Duration;
}): Promise<void>;
export declare function attemptToFindTextEditorText(filePath: string): Promise<string>;
