import { TerminalView, Workbench } from 'vscode-extension-tester';
export declare function getTerminalView(workbench: Workbench): Promise<TerminalView>;
export declare function getTerminalViewText(workbench: Workbench, seconds: number): Promise<string>;
export declare function executeCommand(workbench: Workbench, command: string): Promise<TerminalView>;
