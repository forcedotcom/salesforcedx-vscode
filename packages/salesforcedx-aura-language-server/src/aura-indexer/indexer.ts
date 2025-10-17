/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Indexer, TagInfo, createTagInfo, createAttributeInfo, elapsedMillis } from '@salesforce/salesforcedx-lightning-lsp-common';
import LineColumnFinder from 'line-column';
import EventsEmitter from 'node:events';
import * as vscode from 'vscode';
import { Node } from 'vscode-html-languageservice';
import { Location } from 'vscode-languageserver';
import URI from 'vscode-uri';
import * as auraUtils from '../auraUtils';
import { parse } from '../auraUtils';
import { AuraWorkspaceContext } from '../context/auraContext';
import { componentFromFile, componentFromDirectory } from '../util/componentUtil';

export default class AuraIndexer implements Indexer {
    public readonly eventEmitter = new EventsEmitter();

    private context: AuraWorkspaceContext;
    private indexingTasks: Promise<void>;

    private AURA_TAGS: Map<string, TagInfo> = new Map();
    private AURA_EVENTS: Map<string, TagInfo> = new Map();
    private AURA_NAMESPACES: Set<string> = new Set();

    constructor(context: AuraWorkspaceContext) {
        this.context = context;
        this.context.addIndexingProvider({ name: 'aura', indexer: this });
    }

    public async configureAndIndex(): Promise<void> {
        await this.loadSystemTags();
        await this.loadStandardComponents();
        await this.indexCustomComponents();
    }

    public async waitForIndexing(): Promise<void> {
        return this.indexingTasks;
    }

    public resetIndex(): void {
        this.eventEmitter.emit('clear');
        this.AURA_TAGS.clear();
        this.AURA_EVENTS.clear();
    }

    public getAuraTags(): Map<string, TagInfo> {
        return this.AURA_TAGS;
    }

    public getAuraNamespaces(): string[] {
        return [...this.AURA_NAMESPACES];
    }

    public getAuraByTag(tag: string): TagInfo | undefined {
        return this.getAuraTags().get(tag);
    }

    public clearTagsforDirectory(directory: string, sfdxProject: boolean): void {
        const name = componentFromDirectory(directory, sfdxProject);
        this.deleteCustomTag(name);
    }

    public async indexFile(file: string, sfdxProject: boolean): Promise<TagInfo | undefined> {
        let uri: vscode.Uri;
        try {
            uri = vscode.Uri.file(file);
            await vscode.workspace.fs.stat(uri);
        } catch {
            this.clearTagsforFile(file, sfdxProject);
            return;
        }
        const content = await vscode.workspace.fs.readFile(uri);
        const markup = new TextDecoder().decode(content);
        const result = parse(markup);
        const tags: Node[] = [];
        for (const root of result.roots) {
            tags.push(...this.searchAura(root));
        }

        const tagInfo = this.getTagInfo(file, sfdxProject, markup, result.roots[0]);
        if (!tagInfo) {
            this.clearTagsforFile(file, sfdxProject);
            return;
        }
        if (!tagInfo.name) {
            console.warn(`File ${file} has malformed tagname, ignoring`);
            return;
        }

        const attributeInfos = tags
            .filter((tag) => tag.tag?.startsWith('aura:attribute'))
            .filter(
                (node) =>
                    (node.parent && (node.parent.tag === 'aura:application' || node.parent.tag === 'aura:component')) ??
                    (node?.parent?.tag === 'aura:event' || node?.parent?.tag === 'aura:interface'),
            )
            .map((node) => {
                const attributes = node.attributes ?? {};
                const documentation = this.trimQuotes(attributes.description ?? '');
                const jsName = this.trimQuotes(attributes.name ?? '');
                const type = this.trimQuotes(attributes.type ?? '');
                const startColumn = new LineColumnFinder(markup).fromIndex(node.start);
                const endColumn = new LineColumnFinder(markup).fromIndex(node.end - 1);

                const location: Location = {
                    uri: URI.file(file).toString(),
                    range: {
                        start: {
                            line: startColumn.line,
                            character: startColumn.col,
                        },
                        end: {
                            line: endColumn.line,
                            character: endColumn.col,
                        },
                    },
                };

                return createAttributeInfo(jsName, documentation, undefined, undefined, type, location);
            });
        tagInfo.attributes = attributeInfos;
        this.setCustomTag(tagInfo);
        return tagInfo;
    }

    private async indexCustomComponents(): Promise<void> {
        const startTime = globalThis.performance.now();
        const markupfiles = await this.context.findAllAuraMarkup();

        for (const file of markupfiles) {
            try {
                await this.indexFile(file, this.context.type === 'SFDX');
            } catch (e) {
                console.log(`Error parsing markup from ${file}:`, e);
            }
        }
        console.info(`Indexed ${markupfiles.length} files in ${elapsedMillis(startTime)} ms`);
    }

    private clearTagsforFile(file: string, sfdxProject: boolean): void {
        const name = componentFromFile(file, sfdxProject);
        this.deleteCustomTag(name ?? '');
    }

    private deleteCustomTag(tag: string): void {
        this.AURA_TAGS.delete(tag);
        this.AURA_EVENTS.delete(tag);

        this.eventEmitter.emit('delete', tag);
    }
    private setAuraNamespaceTag(namespace: string | undefined): void {
        if (namespace && !this.AURA_NAMESPACES.has(namespace)) {
            this.AURA_NAMESPACES.add(namespace);
            this.eventEmitter.emit('set-namespace', namespace);
        }
    }

    private setCustomEventTag(info: TagInfo): void {
        this.setAuraNamespaceTag(info.namespace);
        this.AURA_EVENTS.set(info.name ?? '', info);
        this.eventEmitter.emit('set', info);
    }

    private setCustomTag(info: TagInfo): void {
        this.setAuraNamespaceTag(info.namespace);
        this.AURA_TAGS.set(info.name ?? '', info);
        this.eventEmitter.emit('set', info);
    }

    private async loadSystemTags(): Promise<void> {
        const uri = vscode.Uri.file(auraUtils.getAuraSystemResourcePath());
        const content = await vscode.workspace.fs.readFile(uri);
        const data = new TextDecoder().decode(content);
        const auraSystem = JSON.parse(data);
        for (const tag in auraSystem) {
            if (auraSystem.hasOwnProperty(tag) && typeof tag === 'string') {
                const tagObj = auraSystem[tag];
                const info = createTagInfo(null, 'SYSTEM', false, []);
                if (tagObj.attributes) {
                    for (const a of tagObj.attributes) {
                        // TODO - could we use more in depth doc from component library here?
                        info.attributes.push(createAttributeInfo(a.name, a.description, undefined, undefined, a.type, undefined, 'Aura Attribute'));
                    }
                }
                info.documentation = tagObj.description;
                info.name = tag;
                info.namespace = tagObj.namespace;

                this.setCustomTag(info);
            }
        }
    }

    private async loadStandardComponents(): Promise<void> {
        const uri = vscode.Uri.file(auraUtils.getAuraStandardResourcePath());
        const content = await vscode.workspace.fs.readFile(uri);
        const data = new TextDecoder().decode(content);
        const auraStandard = JSON.parse(data);
        for (const tag in auraStandard) {
            if (auraStandard.hasOwnProperty(tag) && typeof tag === 'string') {
                const tagObj = auraStandard[tag];
                const info = createTagInfo(null, 'STANDARD', false, []);
                if (tagObj.attributes) {
                    tagObj.attributes.sort((a, b) => a.name.localeCompare(b.name));
                    for (const a of tagObj.attributes) {
                        // TODO - could we use more in depth doc from component library here?
                        info.attributes.push(createAttributeInfo(a.name, a.description, undefined, undefined, a.type, undefined, 'Aura Attribute'));
                    }
                }
                info.documentation = tagObj.description;
                info.name = tag;
                info.namespace = tagObj.namespace;

                // Update our in memory maps
                // TODO should we move interfaces/apps/etc to a separate map also?
                if (tagObj.type === 'event') {
                    this.setCustomEventTag(info);
                } else {
                    this.setCustomTag(info);
                }
            }
        }
    }

    private searchAura(node: Node): Node[] {
        const results: Node[] = [];
        if (node.tag?.includes(':')) {
            results.push(node);
        }
        for (const child of node.children) {
            results.push(...this.searchAura(child));
        }
        return results;
    }

    private trimQuotes(str: string): string {
        if (!str) {
            return '';
        }
        return str.replace(/"([^"]+(?="))"/g, '$1');
    }

    private getTagInfo(file: string, sfdxProject: boolean, contents: string, node: Node): TagInfo | undefined {
        if (!node) {
            return undefined;
        }
        const attributes = node.attributes ?? {};
        const documentation = this.trimQuotes(attributes.description ?? '');

        const startColumn = new LineColumnFinder(contents).fromIndex(node.start);
        const endColumn = new LineColumnFinder(contents).fromIndex(node.end - 1);

        const location: Location = {
            uri: URI.file(file).toString(),
            range: {
                start: {
                    line: startColumn.line,
                    character: startColumn.col,
                },
                end: {
                    line: endColumn.line,
                    character: endColumn.col,
                },
            },
        };
        const name = componentFromFile(file, sfdxProject) ?? undefined;
        const info = createTagInfo(file, 'CUSTOM', false, [], location, documentation, name, 'c');
        return info;
    }
}
