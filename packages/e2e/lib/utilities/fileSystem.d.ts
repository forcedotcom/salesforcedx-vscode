import { TestSetup } from '../testSetup';
export declare function createFolder(folderPath: string): void;
export declare function removeFolder(folderPath: string): void;
export declare function createCustomObjects(testSetup: TestSetup): Promise<void>;
export declare function createGlobalSnippetsFile(testSetup: TestSetup): Promise<void>;
/**
 * Scans the directory for vsix files and returns the full path to each file
 * @param vsixDir
 * @returns
 */
export declare function getVsixFilesFromDir(vsixDir: string): string[];
/**
 * Return folder name if given path is a directory, otherwise return null
 * @param folderPath
 * @returns folder name
 */
export declare function getFolderName(folderPath: string): string | null;
