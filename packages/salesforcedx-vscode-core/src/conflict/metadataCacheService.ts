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
  SourceComponent
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

export const enum PathType {
  Folder = 'folder',
  Individual = 'individual',
  Manifest = 'manifest',
  Unknown = 'unknown'
}

export interface MetadataCacheResult {
  selectedPath: string;
  selectedType: PathType;

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
  private isManifest: boolean = false;
  private sourceComponents: ComponentSet;

  public constructor(username: string) {
    this.username = username;
    this.sourceComponents = new ComponentSet();
    this.cachePath = this.makeCachePath(username);
  }

  /**
   * Specify the base project path and a component path that will define the metadata to cache for the project.
   *
   * @param componentPath A path referring to a project folder or an individual component resource
   * @param projectPath The base path of an sfdx project
   */
  public initialize(
    componentPath: string,
    projectPath: string,
    isManifest: boolean = false
  ): void {
    this.componentPath = componentPath;
    this.projectPath = projectPath;
    this.isManifest = isManifest;
  }

  /**
   * Load a metadata cache based on a project path that defines a set of components.
   *
   * @param componentPath A path referring to a project folder, an individual component resource
   * or a manifest file
   * @param projectPath The base path of an sfdx project
   * @param isManifest Whether the componentPath references a manifest file
   * @returns MetadataCacheResult describing the project and cache folders
   */
  public async loadCache(
    componentPath: string,
    projectPath: string,
    isManifest: boolean = false
  ): Promise<MetadataCacheResult | undefined> {
    this.initialize(componentPath, projectPath, isManifest);
    const components = await this.getSourceComponents();
    const operation = await this.createRetrieveOperation(components);
    const results = await operation.start();
    return this.processResults(results);
  }

  public async getSourceComponents(): Promise<ComponentSet> {
    if (this.componentPath && this.projectPath) {
      this.sourceComponents = this.isManifest
        ? await ComponentSet.fromManifest({
            manifestPath: this.componentPath,
            resolveSourcePaths: [this.projectPath]
          })
        : ComponentSet.fromSource(this.componentPath);
      return this.sourceComponents;
    }
    return new ComponentSet();
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
    result: RetrieveResult | undefined
  ): Promise<MetadataCacheResult | undefined> {
    if (!result) {
      return;
    }

    const { components, properties } = this.extractResults(result);
    if (components.length > 0 && this.componentPath && this.projectPath) {
      const propsFile = this.saveProperties(properties);
      const cacheCommon = this.findLongestCommonDir(components, this.cachePath);

      const sourceComps = this.sourceComponents.getSourceComponents().toArray();
      const projCommon = this.findLongestCommonDir(
        sourceComps,
        this.projectPath
      );

      let selectedType = PathType.Unknown;
      if (
        fs.existsSync(this.componentPath) &&
        fs.lstatSync(this.componentPath).isDirectory()
      ) {
        selectedType = PathType.Folder;
      } else if (this.isManifest) {
        selectedType = PathType.Manifest;
      } else {
        selectedType = PathType.Individual;
      }

      return {
        selectedPath: this.componentPath,
        selectedType,

        cache: {
          baseDirectory: this.cachePath,
          commonRoot: cacheCommon,
          components
        },
        cachePropPath: propsFile,

        project: {
          baseDirectory: this.projectPath,
          commonRoot: projCommon,
          components: sourceComps
        }
      };
    }
  }

  private extractResults(
    result: RetrieveResult
  ): { components: SourceComponent[]; properties: FileProperties[] } {
    const properties: FileProperties[] = [];
    if (Array.isArray(result.response.fileProperties)) {
      properties.push(...result.response.fileProperties);
    } else {
      properties.push(result.response.fileProperties);
    }
    const components = result.components.getSourceComponents().toArray();
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
  private isManifest: boolean = false;

  constructor(
    username: string,
    executionName: string,
    logName: string,
    callback: MetadataCacheCallback,
    isManifest: boolean = false
  ) {
    super(executionName, logName);
    this.callback = callback;
    this.isManifest = isManifest;
    this.cacheService = new MetadataCacheService(username);
  }

  protected async getComponents(response: any): Promise<ComponentSet> {
    this.cacheService.initialize(
      response.data,
      getRootWorkspacePath(),
      this.isManifest
    );
    return await this.cacheService.getSourceComponents();
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

  protected async postOperation(result: RetrieveResult | undefined) {
    const cache:
      | MetadataCacheResult
      | undefined = await this.cacheService.processResults(result);
    await this.callback(cache);
  }
}
