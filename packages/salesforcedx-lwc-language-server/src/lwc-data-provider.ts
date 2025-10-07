/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import { join } from 'node:path';
import { IAttributeData, ITagData, IValueData, IHTMLDataProvider } from 'vscode-html-languageservice';
import ComponentIndexer from './component-indexer';
import { getLwcName, getTagDescription, getPublicAttributes, getClassMembers, getTagName } from './tag';

export type DataProviderAttributes = {
    indexer: ComponentIndexer;
};

export class LWCDataProvider implements IHTMLDataProvider {
    activated = false;
    indexer?: ComponentIndexer;
    private readonly _standardTags: ITagData[];
    private readonly _globalAttributes: IAttributeData[];

    constructor(attributes?: DataProviderAttributes) {
        this.indexer = attributes.indexer;
        let standardData: string;
        const possiblePaths = [
            join(__dirname, '../resources/transformed-lwc-standard.json'), // lib/resources/
            join(__dirname, 'resources/transformed-lwc-standard.json'), // src/resources/
            join(__dirname, '../../resources/transformed-lwc-standard.json'), // fallback
            join(__dirname, '../../../resources/transformed-lwc-standard.json'), // compiled version
        ];
        for (const filePath of possiblePaths) {
            try {
                standardData = fs.readFileSync(filePath, 'utf-8');
                break;
            } catch {
                /* Continue */
            }
        }
        if (!standardData) {
            throw new Error(`Could not find transformed-lwc-standard.json in any of the expected locations: ${possiblePaths.join(', ')}`);
        }
        const standardJson = JSON.parse(standardData);
        this._standardTags = standardJson.tags;
        this._globalAttributes = standardJson.globalAttributes;
    }

    getId(): string {
        return 'lwc';
    }

    isApplicable(): boolean {
        return this.activated;
    }

    provideTags(): ITagData[] {
        const customTags = this.indexer.customData.map((tag) => ({
            name: getLwcName(tag),
            description: getTagDescription(tag),
            attributes: getPublicAttributes(tag),
        }));
        return [...this._standardTags, ...customTags];
    }
    provideAttributes(tagName: string): IAttributeData[] {
        const tag = this.provideTags().find((t) => t.name === tagName);
        return [...this._globalAttributes, ...(tag?.attributes || [])];
    }
    provideValues(): IValueData[] {
        const values: IValueData[] = [];
        this.indexer.customData.forEach((t) => {
            getClassMembers(t).forEach((cm) => {
                const bindName = `${getTagName(t)}.${cm.name}`;
                values.push({ name: cm.name, description: `${bindName}` });
            });
        });
        return values;
    }
}
