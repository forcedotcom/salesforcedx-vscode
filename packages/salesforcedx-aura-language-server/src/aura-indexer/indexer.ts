/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Indexer, TagInfo, extractJsonFromImport } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as LineColumnFinderModule from 'line-column';

import { EventEmitter as EventsEmitter } from 'node:events';
import { Node } from 'vscode-html-languageservice';
import { Location } from 'vscode-languageserver';
import URI from 'vscode-uri';
import { parse, elapsedMillis } from '../auraUtils';
import { AuraWorkspaceContext } from '../context/auraContext';
import * as auraStandardImport from '../resources/aura-standard.json';
import * as transformedAuraSystemImport from '../resources/transformed-aura-system.json';
import { componentFromFile, componentFromDirectory } from '../util/componentUtil';

const LineColumnFinder = LineColumnFinderModule.default ?? LineColumnFinderModule;
export default class AuraIndexer implements Indexer {
  public readonly eventEmitter = new EventsEmitter();

  private context!: AuraWorkspaceContext;

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

  public indexFile(file: string, sfdxProject: boolean): TagInfo | undefined {
    try {
      const stat = this.context.fileSystemProvider.getFileStat(file);
      if (stat?.type !== 'file') {
        return undefined;
      }
    } catch {
      this.clearTagsforFile(file, sfdxProject);
      return;
    }
    const content = this.context.fileSystemProvider.getFileContent(file);
    const markup = content ?? '';
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
      .filter(tag => tag.tag?.startsWith('aura:attribute'))
      .filter(
        node =>
          (node.parent && (node.parent.tag === 'aura:application' || node.parent.tag === 'aura:component')) ??
          (node?.parent?.tag === 'aura:event' || node?.parent?.tag === 'aura:interface')
      )
      .map(node => {
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
              character: startColumn.col
            },
            end: {
              line: endColumn.line,
              character: endColumn.col
            }
          }
        };

        return {
          name: jsName,
          documentation,
          memberType: undefined,
          decorator: undefined,
          type,
          location
        };
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
    // Extract JSON content from import - may be wrapped in .default or spread
    const auraSystem = extractJsonFromImport(transformedAuraSystemImport);

    if (auraSystem && typeof auraSystem === 'object') {
      for (const tag in auraSystem) {
        if (auraSystem.hasOwnProperty(tag) && typeof tag === 'string') {
          // @ts-expect-error - auraSystem is typed as any
          const tagObj = auraSystem[tag];
          const info: TagInfo = {
            file: null,
            type: 'SYSTEM',
            lwc: false,
            attributes: [],
            documentation: ''
          };
          if (tagObj.attributes) {
            for (const a of tagObj.attributes) {
              // TODO - could we use more in depth doc from component library here?
              info.attributes.push({
                name: a.name,
                documentation: a.description,
                memberType: undefined,
                decorator: undefined,
                type: a.type,
                location: undefined,
                detail: 'Aura Attribute'
              });
            }
          }
          info.documentation = tagObj.description;
          info.name = tag;
          info.namespace = tagObj.namespace;

          this.setCustomTag(info);
        }
      }
    }
  }

  private async loadStandardComponents(): Promise<void> {
    // Extract JSON content from import - may be wrapped in .default or spread
    const standardComponents = extractJsonFromImport(auraStandardImport);

    if (standardComponents && typeof standardComponents === 'object') {
      for (const tag in standardComponents) {
        if (standardComponents.hasOwnProperty(tag) && typeof tag === 'string') {
          // @ts-expect-error - standardComponents is typed as any
          const tagObj = standardComponents[tag];
          const info: TagInfo = {
            file: null,
            type: 'STANDARD',
            lwc: false,
            attributes: [],
            documentation: ''
          };
          if (tagObj.attributes) {
            // @ts-expect-error - tagObj.attributes is typed as any
            tagObj.attributes.sort((a, b) => a.name.localeCompare(b.name));
            for (const a of tagObj.attributes) {
              // TODO - could we use more in depth doc from component library here?
              info.attributes.push({
                name: a.name,
                documentation: a.description,
                memberType: undefined,
                decorator: undefined,
                type: a.type,
                location: undefined,
                detail: 'Aura Attribute'
              });
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
          character: startColumn.col
        },
        end: {
          line: endColumn.line,
          character: endColumn.col
        }
      }
    };
    const name = componentFromFile(file, sfdxProject) ?? undefined;
    const info: TagInfo = {
      file,
      type: 'CUSTOM',
      lwc: false,
      attributes: [],
      location,
      documentation: documentation ?? '',
      name,
      namespace: 'c'
    };
    return info;
  }
}
