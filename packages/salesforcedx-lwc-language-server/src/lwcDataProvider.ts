/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'node:path';
import * as vscode from 'vscode';
import { IAttributeData, ITagData, IValueData, IHTMLDataProvider } from 'vscode-html-languageservice';
import ComponentIndexer from './componentIndexer';
import { getLwcName, getTagDescription, getPublicAttributes, getClassMembers, getTagName } from './tag';

export type DataProviderAttributes = {
    indexer: ComponentIndexer;
};

export class LWCDataProvider implements IHTMLDataProvider {
    public activated = false;
    private indexer: ComponentIndexer;
    private _standardTags: ITagData[] = [];
    private _globalAttributes: IAttributeData[] = [];

    constructor(attributes: DataProviderAttributes) {
        this.indexer = attributes.indexer;
    }

    public async init(): Promise<void> {
        const possiblePaths = [
            join(__dirname, '../resources/transformed-lwc-standard.json'), // lib/resources/
            join(__dirname, 'resources/transformed-lwc-standard.json'), // src/resources/
            join(__dirname, '../../resources/transformed-lwc-standard.json'), // fallback
            join(__dirname, '../../../resources/transformed-lwc-standard.json'), // compiled version
        ];

        let standardData: string | undefined;
        for (const filePath of possiblePaths) {
            try {
                const fileBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
                standardData = Buffer.from(fileBuffer).toString('utf-8');
                if (standardData.length > 0) {
                    break;
                }
            } catch {
                // File doesn't exist, continue to next path
            }
        }

        if (!standardData) {
            throw new Error(`Could not find transformed-lwc-standard.json in any of the expected locations: ${possiblePaths.join(', ')}`);
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const standardJson = JSON.parse(standardData);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        this._standardTags = standardJson.tags;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        this._globalAttributes = standardJson.globalAttributes;
    }

    public getId(): string {
        return 'lwc';
    }

    public isApplicable(): boolean {
        return this.activated;
    }

    public provideTags(): ITagData[] {
        const customTags = this.indexer.getCustomData().map((tag) => ({
            name: getLwcName(tag),
            description: getTagDescription(tag),
            attributes: getPublicAttributes(tag),
        }));
        return [...this._standardTags, ...customTags];
    }
    public provideAttributes(tagName: string): IAttributeData[] {
        const tag = this.provideTags().find((t) => t.name === tagName);
        return [...this._globalAttributes, ...(tag?.attributes ?? [])];
    }
    public provideValues(): IValueData[] {
        const values: IValueData[] = [];
        this.indexer.getCustomData().forEach((t) => {
            getClassMembers(t).forEach((cm) => {
                const bindName = `${getTagName(t)}.${cm.name}`;
                values.push({ name: cm.name, description: `${bindName}` });
            });
        });
        return values;
    }
}
