/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { detectWorkspaceHelper, WorkspaceType } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as glob from 'fast-glob';
import * as path from 'node:path';
import normalize from 'normalize-path';
import * as vscode from 'vscode';
import { getSfdxPackageDirsPattern, getSfdxConfig, getWorkspaceRoot } from './baseIndexer';
import { fromMeta, declarationsFromCustomLabels, getDeclaration } from './typing';

const basenameRegex = new RegExp(/(?<name>[\w-_]+)\.[^/]+$/);

type BaseIndexerAttributes = {
    workspaceRoot: string;
};

export const pathBasename = (filename: string): string => {
    const parsedPath: string = path.parse(filename).base;
    const match = basenameRegex.exec(parsedPath);
    return match?.groups?.name ?? '';
};

// Type definition for TypingIndexer data structure
export type TypingIndexerData = {
    workspaceRoot: string;
    typingsBaseDir: string;
    projectType: WorkspaceType;
};

// Utility function to diff items
export const diffItems = (items: string[], compareItems: string[]): string[] => {
    const compareBasenames = compareItems.map(pathBasename);
    return items.filter((item) => {
        const filename = pathBasename(item);
        return !compareBasenames.includes(filename);
    });
};

// Utility function to create new meta typings
export const createNewMetaTypings = async (indexer: TypingIndexerData): Promise<void> => {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(indexer.typingsBaseDir));
    const newFiles = diffItems(await getMetaFiles(indexer), getMetaTypings(indexer));
    for (const filename of newFiles) {
        const typing = fromMeta(filename);
        const filePath = path.join(indexer.typingsBaseDir, typing.fileName);
        await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), new TextEncoder().encode(getDeclaration(typing)));
    }
};

// Utility function to delete stale meta typings
export const deleteStaleMetaTypings = async (indexer: TypingIndexerData): Promise<void> => {
    const staleTypings = diffItems(getMetaTypings(indexer), await getMetaFiles(indexer));
    for (const filename of staleTypings) {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(filename));
            await vscode.workspace.fs.delete(vscode.Uri.file(filename));
        } catch {
            // File doesn't exist, ignore
        }
    }
};

// Utility function to save custom label typings
export const saveCustomLabelTypings = async (indexer: TypingIndexerData): Promise<void> => {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(indexer.typingsBaseDir));

    const customLabelFiles = await getCustomLabelFiles(indexer);
    const typings: Promise<string>[] = [];

    for (const filename of customLabelFiles) {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(filename));
            const fileBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filename));
            const data = Buffer.from(fileBuffer);
            typings.push(declarationsFromCustomLabels(data));
        } catch {
            // File doesn't exist, skip
        }
    }

    const typingContent = await Promise.all(typings);
    const fileContent = typingContent.join('\n');
    if (fileContent.length > 0) {
        await vscode.workspace.fs.writeFile(vscode.Uri.file(getCustomLabelTypings(indexer)), new TextEncoder().encode(fileContent));
    }
};

// Utility function to get meta files
export const getMetaFiles = async (indexer: TypingIndexerData): Promise<string[]> => {
    const globPath = normalize(
        `${indexer.workspaceRoot}/${await getSfdxPackageDirsPattern(
            indexer.workspaceRoot,
        )}/**/+(staticresources|contentassets|messageChannels)/*.+(resource|asset|messageChannel)-meta.xml`,
    );
    return glob.sync(globPath).map((file) => path.resolve(file));
};

// Utility function to get meta typings
export const getMetaTypings = (indexer: TypingIndexerData): string[] => {
    const globPath = normalize(`${indexer.typingsBaseDir}/*.+(messageChannel|resource|asset).d.ts`);
    return glob.sync(globPath).map((file) => path.resolve(file));
};

// Utility function to get custom label files
export const getCustomLabelFiles = async (indexer: TypingIndexerData): Promise<string[]> => {
    const globPath = normalize(`${await getSfdxPackageDirsPattern(indexer.workspaceRoot)}/**/labels/CustomLabels.labels-meta.xml`);
    const result = glob.sync(globPath, { cwd: normalize(indexer.workspaceRoot) }).map((file) => path.join(indexer.workspaceRoot, file));
    return result;
};

// Utility function to get custom label typings path
export const getCustomLabelTypings = (indexer: TypingIndexerData): string => path.join(indexer.typingsBaseDir, 'customlabels.d.ts');

// Legacy class for backward compatibility (deprecated)
export default class TypingIndexer {
    public readonly workspaceRoot: string;
    public typingsBaseDir: string;
    public projectType: WorkspaceType;
    public metaFiles: string[] = [];

    public static diff(items: string[], compareItems: string[]): string[] {
        return diffItems(items, compareItems);
    }

    constructor(attributes: BaseIndexerAttributes) {
        this.workspaceRoot = getWorkspaceRoot(attributes.workspaceRoot);
        // projectType and typingsBaseDir will be set by the async initialization
    }

    /**
     * Creates and initializes a TypingIndexer instance
     */
    public static async create(attributes: BaseIndexerAttributes): Promise<TypingIndexer> {
        const indexer = new TypingIndexer(attributes);
        await indexer.initialize();
        return indexer;
    }

    /**
     * Initializes the TypingIndexer with workspace type detection and sets up typings
     */
    public async initialize(): Promise<void> {
        this.projectType = await detectWorkspaceHelper(this.workspaceRoot);

        switch (this.projectType) {
            case 'SFDX':
                this.typingsBaseDir = path.join(this.workspaceRoot, '.sfdx', 'typings', 'lwc');
                break;
            case 'CORE_PARTIAL':
                this.typingsBaseDir = path.join(this.workspaceRoot, '..', '.vscode', 'typings', 'lwc');
                break;
            case 'CORE_ALL':
                this.typingsBaseDir = path.join(this.workspaceRoot, '.vscode', 'typings', 'lwc');
                break;
        }

        // Initialize typings for SFDX workspaces
        if (this.projectType === 'SFDX') {
            this.metaFiles = await getMetaFiles(this);
            await this.createNewMetaTypings();
            await this.deleteStaleMetaTypings();
            await this.saveCustomLabelTypings();
        }
    }

    public async createNewMetaTypings(): Promise<void> {
        return createNewMetaTypings(this);
    }

    public async deleteStaleMetaTypings(): Promise<void> {
        return deleteStaleMetaTypings(this);
    }

    public async saveCustomLabelTypings(): Promise<void> {
        return saveCustomLabelTypings(this);
    }

    public get metaTypings(): string[] {
        return getMetaTypings(this);
    }

    public get customLabelFiles(): string[] {
        // Return empty array synchronously, use async version for actual work
        return [];
    }

    public get customLabelTypings(): string {
        return getCustomLabelTypings(this);
    }

    public async getSfdxPackageDirsPattern(): Promise<string> {
        return await getSfdxPackageDirsPattern(this.workspaceRoot);
    }

    public sfdxConfig(root: string): any {
        return getSfdxConfig(root);
    }
}
