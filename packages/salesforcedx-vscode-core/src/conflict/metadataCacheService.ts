/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ComponentSet,
  MetadataApiRetrieve,
  RetrieveResult,
  SourceComponent,
  SourceRetrieveResult
} from '@salesforce/source-deploy-retrieve';
import { FileProperties } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as shell from 'shelljs';
import * as vscode from 'vscode';
import { RetrieveExecutor } from '../commands/baseDeployRetrieve';
import { getRootWorkspacePath } from '../util';

export interface MetadataContext {
  baseDirectory: string;
  commonRoot: string;
  components: SourceComponent[];
}

export interface MetadataCacheResult {
  selectedPath: string;
  selectedIsDirectory: boolean;

  cachePropPath?: string;
  cache: MetadataContext;
  project: MetadataContext;
}

export class MetadataCacheService {
  private static CACHE_FOLDER = ['.sfdx', 'diff'];
  private static PROPERTIES_FOLDER = ['prop'];
  private static PROPERTIES_FILE = 'file-props.json';

  private username: string;
  private cachePath: string;
  private componentPath?: string;
  private projectPath?: string;
  private sourceComponents: ComponentSet;

  public constructor(username: string) {
    this.username = username;
    this.sourceComponents = new ComponentSet();
    this.cachePath = this.makeCachePath(username);
  }

  public initialize(componentPath: string, projectPath: string): void {
    this.componentPath = componentPath;
    this.projectPath = projectPath;
  }

  public async loadCache(
    componentPath: string,
    projectPath: string
  ): Promise<MetadataCacheResult | undefined> {
    this.initialize(componentPath, projectPath);
    const components = await this.getSourceComponents();
    const operation = await this.createRetrieveOperation(components);
    const results = await operation.start();
    return this.processResults(results);
  }

  public async getSourceComponents(): Promise<ComponentSet> {
    return this.componentPath
      ? (this.sourceComponents = ComponentSet.fromSource(this.componentPath))
      : new ComponentSet();
  }

  public async createRetrieveOperation(
    comps?: ComponentSet
  ): Promise<MetadataApiRetrieve> {
    const components = comps || (await this.getSourceComponents());
    this.clearDirectory(this.cachePath, true);

    const operation = components.retrieve({
      usernameOrConnection: this.username,
      output: this.cachePath,
      merge: false
    });

    return operation;
  }

  public async processResults(
    result: RetrieveResult | SourceRetrieveResult | undefined
  ): Promise<MetadataCacheResult | undefined> {
    if (!result) {
      return;
    }

    const { components, properties } = this.extractResults(result);
    if (components.length > 0 && this.componentPath && this.projectPath) {
      const propsFile = this.saveProperties(properties);
      const cacheCommon = this.findLongestCommonDir(components, this.cachePath);

      const projCommon = this.findLongestCommonDir(
        this.sourceComponents.getSourceComponents().toArray(),
        this.projectPath
      );

      const isPathDirectory =
        fs.existsSync(this.componentPath) &&
        fs.lstatSync(this.componentPath).isDirectory();

      return {
        selectedPath: this.componentPath,
        selectedIsDirectory: isPathDirectory,

        cache: {
          baseDirectory: this.cachePath,
          commonRoot: cacheCommon,
          components
        },
        cachePropPath: propsFile,

        project: {
          baseDirectory: this.projectPath,
          commonRoot: projCommon,
          components: this.sourceComponents.getSourceComponents().toArray()
        }
      };
    }
  }

  private extractResults(
    result: RetrieveResult | SourceRetrieveResult
  ): { components: SourceComponent[]; properties: FileProperties[] } {
    let components: SourceComponent[] = [];
    const properties: FileProperties[] = [];

    if (result instanceof RetrieveResult) {
      if (Array.isArray(result.response.fileProperties)) {
        properties.push(...result.response.fileProperties);
      } else {
        properties.push(result.response.fileProperties);
      }
      components = result.components.getSourceComponents().toArray();
    } else {
      result.successes?.forEach(s => {
        if (s.properties) {
          properties.push(s.properties);
        }
        components.push(s.component);
      });
    }
    return { components, properties };
  }

  private findLongestCommonDir(
    comps: SourceComponent[],
    baseDir: string
  ): string {
    if (comps.length === 0) {
      return baseDir;
    }
    if (comps.length === 1) {
      return this.getRelativePath(comps[0], baseDir);
    }

    const allPaths = comps.map(c => this.getRelativePath(c, baseDir));
    const baseline = allPaths[0];
    let shortest = baseline.length;

    for (let whichPath = 1; whichPath < allPaths.length; whichPath++) {
      const sample = allPaths[whichPath];
      shortest = Math.min(shortest, sample.length);

      for (let comparePos = 0; comparePos < shortest; comparePos++) {
        if (baseline[comparePos] !== sample[comparePos]) {
          shortest = comparePos;
          break;
        }
      }
    }

    const dir = baseline.substring(0, shortest);
    return dir.endsWith(path.sep) ? dir.slice(0, -path.sep.length) : dir;
  }

  private saveProperties(properties: FileProperties[]): string {
    const props = {
      componentPath: this.componentPath,
      fileProperties: properties
    };
    const propDir = this.getPropsPath();
    const propsFile = path.join(propDir, MetadataCacheService.PROPERTIES_FILE);

    fs.mkdirSync(propDir);
    fs.writeFileSync(propsFile, JSON.stringify(props));
    return propsFile;
  }

  private getRelativePath(comp: SourceComponent, baseDir: string): string {
    const compPath = comp.content || comp.xml;
    if (compPath) {
      const compDir = path.dirname(compPath);
      return compDir.substring(baseDir.length + path.sep.length);
    }
    return '';
  }

  public getCachePath(): string {
    return this.cachePath;
  }

  public makeCachePath(cacheKey: string): string {
    return path.join(
      os.tmpdir(),
      ...MetadataCacheService.CACHE_FOLDER,
      cacheKey
    );
  }

  public getPropsPath(): string {
    return path.join(this.cachePath, ...MetadataCacheService.PROPERTIES_FOLDER);
  }

  public clearCache(throwErrorOnFailure: boolean = false): string {
    this.clearDirectory(this.cachePath, throwErrorOnFailure);
    return this.cachePath;
  }

  private clearDirectory(dirToRemove: string, throwErrorOnFailure: boolean) {
    try {
      shell.rm('-rf', dirToRemove);
    } catch (error) {
      if (throwErrorOnFailure) {
        throw error;
      }
    }
  }
}

export type MetadataCacheCallback = (
  cache: MetadataCacheResult | undefined
) => Promise<void>;

export class MetadataCacheExecutor extends RetrieveExecutor<string> {
  private cacheService: MetadataCacheService;
  private callback: MetadataCacheCallback;

  constructor(
    username: string,
    executionName: string,
    logName: string,
    callback: MetadataCacheCallback
  ) {
    super(executionName, logName);
    this.callback = callback;
    this.cacheService = new MetadataCacheService(username);
  }

  protected async getComponents(response: any): Promise<ComponentSet> {
    this.cacheService.initialize(response.data, getRootWorkspacePath());
    return this.cacheService.getSourceComponents();
  }

  protected async doOperation(
    components: ComponentSet,
    token: vscode.CancellationToken
  ): Promise<RetrieveResult | undefined> {
    const operation = await this.cacheService.createRetrieveOperation(
      components
    );
    this.setupCancellation(operation, token);
    return operation.start();
  }

  protected async postOperation(
    result: RetrieveResult | SourceRetrieveResult | undefined
  ) {
    const cache:
      | MetadataCacheResult
      | undefined = await this.cacheService.processResults(result);
    await this.callback(cache);
  }
}
