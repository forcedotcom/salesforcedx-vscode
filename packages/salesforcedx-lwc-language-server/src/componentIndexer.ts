/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
    detectWorkspaceHelper,
    WorkspaceType,
    readJsonSync,
    writeJsonSync,
    SfdxTsConfig,
    TsConfigPaths,
    IFileSystemProvider,
} from '@salesforce/salesforcedx-lightning-lsp-common';
import camelcase from 'camelcase';
import { snakeCase } from 'change-case';
import { Entry, sync } from 'fast-glob';
import * as path from 'node:path';
import normalize from 'normalize-path';
import { getWorkspaceRoot, getSfdxConfig, getSfdxPackageDirsPattern } from './baseIndexer';
import { Tag, TagAttrs, createTag, createTagFromFile, getTagName, getTagUri } from './tag';

const CUSTOM_COMPONENT_INDEX_PATH = path.join('.sfdx', 'indexes', 'lwc');
const CUSTOM_COMPONENT_INDEX_FILE = path.join(CUSTOM_COMPONENT_INDEX_PATH, 'custom-components.json');
const componentPrefixRegex = new RegExp(/^(?<type>c|lightning|interop){0,1}(?<delimiter>:|-{0,1})(?<name>[\w-]+)$/);

type ComponentIndexerAttributes = {
    workspaceRoot: string;
    fileSystemProvider: IFileSystemProvider;
};

const AURA_DELIMITER = ':';
const LWC_DELIMITER = '-';

const tagEqualsFile = (tag: Tag, entry: Entry): boolean => tag.file === entry.path && tag.updatedAt?.getTime() === entry.stats?.mtime.getTime();

export const unIndexedFiles = (entries: Entry[], tags: Tag[]): Entry[] => entries.filter((entry) => !tags.some((tag) => tagEqualsFile(tag, entry)));

// Interface that fast-glob expects for custom file system
interface FastGlobFileSystem {
    readdir: (dirPath: string) => Promise<string[]>;
    stat: (filePath: string) => Promise<{ mtime: Date; isDirectory: () => boolean }>;
    lstat: (filePath: string) => Promise<{ mtime: Date; isDirectory: () => boolean }>;
}

// Adapter class that implements FastGlobFileSystem interface
class FastGlobFileSystemAdapter implements FastGlobFileSystem {
    constructor(private fileSystemProvider: IFileSystemProvider) {}

    public async readdir(dirPath: string): Promise<string[]> {
        const listing = this.fileSystemProvider.getDirectoryListing(`${dirPath}`);
        return listing?.map((item) => item.name) ?? [];
    }

    public async stat(filePath: string): Promise<{ mtime: Date; isDirectory: () => boolean }> {
        const stat = this.fileSystemProvider.getFileStat(`${filePath}`);
        if (!stat) {
            throw new Error(`File not found: ${filePath}`);
        }
        return {
            mtime: new Date(stat.mtime),
            isDirectory: () => stat.type === 'directory',
        };
    }

    public async lstat(filePath: string): Promise<{ mtime: Date; isDirectory: () => boolean }> {
        return await this.stat(filePath);
    }
}

export default class ComponentIndexer {
    public readonly workspaceRoot: string;
    public workspaceType: WorkspaceType = 'UNKNOWN';
    public readonly tags: Map<string, Tag> = new Map();
    public readonly fileSystemProvider: IFileSystemProvider;

    constructor(private readonly attributes: ComponentIndexerAttributes) {
        this.workspaceRoot = getWorkspaceRoot(attributes.workspaceRoot);
        this.fileSystemProvider = attributes.fileSystemProvider;
    }

    public async sfdxConfig(root: string): Promise<any> {
        return await getSfdxConfig(root, this.fileSystemProvider);
    }

    public async getSfdxPackageDirsPattern(): Promise<string> {
        return await getSfdxPackageDirsPattern(this.attributes.workspaceRoot, this.fileSystemProvider);
    }

    public async getComponentEntries(): Promise<Entry[]> {
        let files: Entry[] = [];
        const fsAdapter = new FastGlobFileSystemAdapter(this.fileSystemProvider);

        switch (this.workspaceType) {
            case 'SFDX':
                const sfdxSource = normalize(`${this.workspaceRoot}/${await this.getSfdxPackageDirsPattern()}/**/*/lwc/**/*.js`);
                files = sync(sfdxSource, {
                    stats: true,
                    fs: fsAdapter, // Use our custom file system adapter
                });
                return files.filter((item: Entry): boolean => {
                    const data = path.parse(item.path);
                    return data.dir.endsWith(data.name);
                });
            default:
                // For CORE_ALL and CORE_PARTIAL
                const defaultSource = normalize(`${this.workspaceRoot}/**/*/modules/**/*.js`);
                files = sync(defaultSource, {
                    stats: true,
                    fs: fsAdapter, // Use our custom file system adapter
                });
                return files.filter((item: Entry): boolean => {
                    const data = path.parse(item.path);
                    return data.dir.endsWith(data.name);
                });
        }
    }

    public getCustomData(): Tag[] {
        return Array.from(this.tags.values());
    }

    public findTagByName(query: string): Tag | null {
        try {
            const matches = componentPrefixRegex.exec(query);
            if (!matches?.groups) {
                return this.tags.get(query) ?? null;
            }
            const { delimiter, name } = matches.groups;
            if (delimiter === AURA_DELIMITER && !/[-_]+/.test(name)) {
                return this.tags.get(name) ?? this.tags.get(snakeCase(name)) ?? null;
            }
            if (delimiter === LWC_DELIMITER) {
                return this.tags.get(name) ?? this.tags.get(camelcase(name)) ?? null;
            }
            return this.tags.get(query) ?? null;
        } catch {
            return null;
        }
    }

    public findTagByURI(uri: string): Tag | null {
        const uriText = uri.replace('.html', '.js');
        return Array.from(this.tags.values()).find((tag) => getTagUri(tag) === uriText) ?? null;
    }

    public async loadTagsFromIndex(): Promise<void> {
        try {
            const indexPath: string = path.join(this.workspaceRoot, CUSTOM_COMPONENT_INDEX_FILE);
            const uri = `file://${indexPath}`;

            if (this.fileSystemProvider.fileExists(uri)) {
                const content = this.fileSystemProvider.getFileContent(uri);
                if (content) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const index: TagAttrs[] = JSON.parse(content);
                    for (const data of index) {
                        const info = await createTag(data);
                        this.tags.set(getTagName(info), info);
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    public async persistCustomComponents(): Promise<void> {
        const indexJsonString = JSON.stringify(this.getCustomData());

        // Store the component index data for the client to process
        this.fileSystemProvider.updateFileContent('lwc:componentIndex', indexJsonString);
    }

    public async insertSfdxTsConfigPath(filePaths: string[]): Promise<void> {
        const sfdxTsConfigPath = normalize(`${this.workspaceRoot}/.sfdx/tsconfig.sfdx.json`);
        const uri = `file://${sfdxTsConfigPath}`;

        const fileExists = this.fileSystemProvider.fileExists(uri);

        if (fileExists) {
            try {
                const sfdxTsConfig: SfdxTsConfig = await readJsonSync(sfdxTsConfigPath, this.fileSystemProvider);
                sfdxTsConfig.compilerOptions = sfdxTsConfig.compilerOptions ?? { paths: {} };
                sfdxTsConfig.compilerOptions.paths = sfdxTsConfig.compilerOptions.paths ?? {};
                for (const filePath of filePaths) {
                    const { dir, name: fileName } = path.parse(filePath);
                    const componentName = `c/${fileName}`;
                    const componentFilePath = path.join(dir, fileName);
                    const tsConfigFilePaths: string[] = (sfdxTsConfig.compilerOptions.paths[componentName] ??= []);
                    const hasExistingPath = tsConfigFilePaths.includes(componentFilePath);
                    if (!hasExistingPath) {
                        tsConfigFilePaths.push(componentFilePath);
                    }
                }
                await writeJsonSync(sfdxTsConfigPath, sfdxTsConfig, this.fileSystemProvider);
            } catch (err) {
                console.error(err);
            }
        }
    }

    // This is a temporary solution to enable automated LWC module resolution for TypeScript modules.
    // It is intended to update the path mapping in the .sfdx/tsconfig.sfdx.json file.
    // TODO: Once the LWC custom module resolution plugin has been developed in the language server
    // this can be removed.
    public async updateSfdxTsConfigPath(): Promise<void> {
        const sfdxTsConfigPath = normalize(`${this.workspaceRoot}/.sfdx/tsconfig.sfdx.json`);
        const uri = `${sfdxTsConfigPath}`;

        const fileExists = this.fileSystemProvider.fileExists(uri);

        if (fileExists) {
            try {
                const content = this.fileSystemProvider.getFileContent(uri);
                if (content) {
                    const sfdxTsConfig: SfdxTsConfig = JSON.parse(content);
                    // The assumption here is that sfdxTsConfig will not be modified by the user as
                    // it is located in the .sfdx directory.
                    sfdxTsConfig.compilerOptions = sfdxTsConfig.compilerOptions ?? { paths: {} };
                    sfdxTsConfig.compilerOptions.paths = await this.getTsConfigPathMapping();

                    // Update the actual tsconfig file
                    this.fileSystemProvider.updateFileContent(uri, JSON.stringify(sfdxTsConfig, null, 2));
                }
            } catch (err) {
                console.error(err);
            }
        }
    }

    public async getTsConfigPathMapping(): Promise<TsConfigPaths> {
        const files: TsConfigPaths = {};
        if (this.workspaceType === 'SFDX') {
            const sfdxSource = normalize(`${this.workspaceRoot}/${await this.getSfdxPackageDirsPattern()}/**/*/lwc/*/*.{js,ts}`);
            const fsAdapter = new FastGlobFileSystemAdapter(this.fileSystemProvider);
            const filePaths = sync(sfdxSource, {
                stats: true,
                fs: fsAdapter,
            });
            for (const filePath of filePaths) {
                const { dir, name: fileName } = path.parse(filePath.path);
                const folderName = path.basename(dir);
                if (folderName === fileName) {
                    const componentName = `c/${fileName}`;
                    const componentFilePath = path.join(dir, fileName);
                    const tsConfigFilePaths = (files[componentName] ??= []);
                    const hasExistingPath = tsConfigFilePaths.includes(componentFilePath);
                    if (!hasExistingPath) {
                        tsConfigFilePaths.push(componentFilePath);
                    }
                }
            }
        }
        return files;
    }

    public async getUnIndexedFiles(): Promise<Entry[]> {
        return unIndexedFiles(await this.getComponentEntries(), this.getCustomData());
    }

    public async getStaleTags(): Promise<Tag[]> {
        const componentEntries = await this.getComponentEntries();

        return this.getCustomData().filter((tag) => !componentEntries.some((entry) => entry.path === tag.file));
    }

    public async init(): Promise<void> {
        this.workspaceType = await detectWorkspaceHelper(this.attributes.workspaceRoot, this.fileSystemProvider);

        await this.loadTagsFromIndex();

        const unIndexedFilesResult = await this.getUnIndexedFiles();

        const promises = unIndexedFilesResult.map((entry) => createTagFromFile(entry.path, this.fileSystemProvider, entry.stats?.mtime));
        const tags = await Promise.all(promises);

        tags.filter(Boolean).forEach((tag) => {
            if (tag) {
                this.tags.set(getTagName(tag), tag);
            }
        });

        const staleTags = await this.getStaleTags();

        staleTags.forEach((tag) => {
            if (tag) {
                this.tags.delete(getTagName(tag));
            }
        });

        await this.persistCustomComponents();
    }

    public async reindex(): Promise<void> {
        const promises = (await this.getComponentEntries()).map((entry) => createTagFromFile(entry.path, this.fileSystemProvider, entry.stats?.mtime));
        const tags = await Promise.all(promises);
        this.tags.clear();
        tags.forEach((tag) => {
            if (tag) {
                this.tags.set(getTagName(tag), tag);
            }
        });
    }
}
