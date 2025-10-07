/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { detectWorkspaceHelper, WorkspaceType } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as glob from 'fast-glob';
import * as fs from 'node:fs';
import * as path from 'node:path';
import normalize from 'normalize-path';
import { getSfdxPackageDirsPattern, getSfdxConfig, getWorkspaceRoot } from './base-indexer';
import { fromMeta, declarationsFromCustomLabels, getDeclaration } from './typing';

const basenameRegex = new RegExp(/(?<name>[\w-_]+)\.[^\/]+$/);

type BaseIndexerAttributes = {
    workspaceRoot: string;
};

export const pathBasename = (filename: string): string => {
    const parsedPath: string = path.parse(filename).base;
    return basenameRegex.exec(parsedPath).groups.name;
};

// Type definition for TypingIndexer data structure
export type TypingIndexerData = {
    workspaceRoot: string;
    typingsBaseDir: string;
    projectType: WorkspaceType;
};

// Utility function to create TypingIndexer
export const createTypingIndexer = (attributes: BaseIndexerAttributes): TypingIndexerData => {
    const workspaceRoot = getWorkspaceRoot(attributes.workspaceRoot);
    const projectType = detectWorkspaceHelper(attributes.workspaceRoot);

    let typingsBaseDir: string;
    switch (projectType) {
        case 'SFDX':
            typingsBaseDir = path.join(workspaceRoot, '.sfdx', 'typings', 'lwc');
            break;
        case 'CORE_PARTIAL':
            typingsBaseDir = path.join(workspaceRoot, '..', '.vscode', 'typings', 'lwc');
            break;
        case 'CORE_ALL':
            typingsBaseDir = path.join(workspaceRoot, '.vscode', 'typings', 'lwc');
            break;
    }

    return {
        workspaceRoot,
        typingsBaseDir,
        projectType,
    };
};

// Utility function to diff items
export const diffItems = (items: string[], compareItems: string[]): string[] => {
    compareItems = compareItems.map(pathBasename);
    return items.filter((item) => {
        const filename = pathBasename(item);
        return !compareItems.includes(filename);
    });
};

// Utility function to create new meta typings
export const createNewMetaTypings = (indexer: TypingIndexerData): void => {
    fs.mkdirSync(indexer.typingsBaseDir, { recursive: true });
    const newFiles = diffItems(getMetaFiles(indexer), getMetaTypings(indexer));
    newFiles.forEach(async (filename: string) => {
        const typing = fromMeta(filename);
        const filePath = path.join(indexer.typingsBaseDir, typing.fileName);
        fs.writeFileSync(filePath, getDeclaration(typing));
    });
};

// Utility function to delete stale meta typings
export const deleteStaleMetaTypings = (indexer: TypingIndexerData): void => {
    const staleTypings = diffItems(getMetaTypings(indexer), getMetaFiles(indexer));
    staleTypings.forEach((filename: string) => {
        if (fs.existsSync(filename)) {
            fs.unlinkSync(filename);
        }
    });
};

// Utility function to save custom label typings
export const saveCustomLabelTypings = async (indexer: TypingIndexerData): Promise<void> => {
    fs.mkdirSync(indexer.typingsBaseDir, { recursive: true });
    const typings = getCustomLabelFiles(indexer)
        .filter((filename) => fs.existsSync(filename))
        .map((filename) => {
            const data = fs.readFileSync(filename);
            return declarationsFromCustomLabels(data);
        });
    const typingContent = await Promise.all(typings);
    const fileContent = typingContent.join('\n');
    if (fileContent.length > 0) {
        fs.writeFileSync(getCustomLabelTypings(indexer), fileContent);
    }
};

// Utility function to get meta files
export const getMetaFiles = (indexer: TypingIndexerData): string[] => {
    const globPath = normalize(
        `${indexer.workspaceRoot}/${getSfdxPackageDirsPattern(
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
export const getCustomLabelFiles = (indexer: TypingIndexerData): string[] => {
    const globPath = normalize(`${getSfdxPackageDirsPattern(indexer.workspaceRoot)}/**/labels/CustomLabels.labels-meta.xml`);
    const result = glob.sync(globPath, { cwd: normalize(indexer.workspaceRoot) }).map((file) => path.join(indexer.workspaceRoot, file));
    return result;
};

// Utility function to get custom label typings path
export const getCustomLabelTypings = (indexer: TypingIndexerData): string => path.join(indexer.typingsBaseDir, 'customlabels.d.ts');

// Legacy class for backward compatibility (deprecated)
export default class TypingIndexer {
    readonly workspaceRoot: string;
    readonly typingsBaseDir: string;
    readonly projectType: WorkspaceType;

    static diff(items: string[], compareItems: string[]): string[] {
        return diffItems(items, compareItems);
    }

    constructor(attributes: BaseIndexerAttributes) {
        this.workspaceRoot = getWorkspaceRoot(attributes.workspaceRoot);
        this.projectType = detectWorkspaceHelper(attributes.workspaceRoot);

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
    }

    init(): void {
        if (this.projectType === 'SFDX') {
            this.createNewMetaTypings();
            this.deleteStaleMetaTypings();
            this.saveCustomLabelTypings();
        }
    }

    createNewMetaTypings(): void {
        createNewMetaTypings(this);
    }

    deleteStaleMetaTypings(): void {
        deleteStaleMetaTypings(this);
    }

    async saveCustomLabelTypings(): Promise<void> {
        return saveCustomLabelTypings(this);
    }

    get metaFiles(): string[] {
        return getMetaFiles(this);
    }

    get metaTypings(): string[] {
        return getMetaTypings(this);
    }

    get customLabelFiles(): string[] {
        return getCustomLabelFiles(this);
    }

    get customLabelTypings(): string {
        return getCustomLabelTypings(this);
    }

    get sfdxPackageDirsPattern(): string {
        return getSfdxPackageDirsPattern(this.workspaceRoot);
    }

    sfdxConfig(root: string): any {
        return getSfdxConfig(root);
    }
}
