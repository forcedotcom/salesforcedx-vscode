import { Duration } from './miscellaneous';
import { Editor } from 'vscode-extension-tester';
export type ExtensionId = 'salesforcedx-vscode' | 'salesforcedx-vscode-expanded' | 'salesforcedx-vscode-soql' | 'salesforcedx-einstein-gpt' | 'salesforcedx-vscode-core' | 'salesforcedx-vscode-apex' | 'salesforcedx-vscode-apex-debugger' | 'salesforcedx-vscode-apex-replay-debugger' | 'salesforcedx-vscode-lightning' | 'salesforcedx-vscode-lwc' | 'salesforcedx-vscode-visualforce';
export type Extension = {
    id: string;
    extensionPath: string;
    isActive: boolean;
    packageJSON: unknown;
};
export type ExtensionType = {
    extensionId: ExtensionId;
    name: string;
    vsixPath: string;
    shouldInstall: 'always' | 'never' | 'optional';
    shouldVerifyActivation: boolean;
};
export type ExtensionActivation = {
    extensionId: string;
    isPresent: boolean;
    version?: string;
    activationTime?: string;
    hasBug?: boolean;
    isActivationComplete?: boolean;
};
export type VerifyExtensionsOptions = {
    timeout?: number;
    interval?: number;
};
export declare const extensions: ExtensionType[];
export declare function showRunningExtensions(): Promise<Editor | undefined>;
export declare function reloadAndEnableExtensions(): Promise<void>;
export declare function getExtensionsToVerifyActive(predicate?: (ext: ExtensionType) => boolean): ExtensionType[];
export declare function verifyExtensionsAreRunning(extensions: ExtensionType[], timeout?: Duration): Promise<boolean>;
export declare function findExtensionsInRunningExtensionsList(extensionIds: string[]): Promise<ExtensionActivation[]>;
export declare function checkForUncaughtErrors(): Promise<void>;
