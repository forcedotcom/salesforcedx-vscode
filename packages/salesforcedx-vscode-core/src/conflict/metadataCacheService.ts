/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import {
  ComponentSet,
  FileProperties,
  MetadataApiRetrieve,
  RetrieveResult,
  SourceComponent
} from '@salesforce/source-deploy-retrieve-bundle';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as shell from 'shelljs';
import * as vscode from 'vscode';
import { RetrieveExecutor } from '../commands/baseDeployRetrieve';
import { WorkspaceContext } from '../context/workspaceContext';
import { SalesforcePackageDirectories } from '../salesforceProject';
import { componentSetUtils } from '../services/sdr/componentSetUtils';
import { workspaceUtils } from '../util';

export type MetadataContext = {
  baseDirectory: string;
  commonRoot: string;
  components: SourceComponent[];
};

export const enum PathType {
  Folder = 'folder',
  Individual = 'individual',
  Manifest = 'manifest',
  Unknown = 'unknown'
}

export type MetadataCacheResult = {
  selectedPath: string;
  selectedType: PathType;

  cachePropPath?: string;
  cache: MetadataContext;
  project: MetadataContext;
  properties: FileProperties[];
};

export type CorrelatedComponent = {
  cacheComponent: SourceComponent;
  projectComponent: SourceComponent;
  lastModifiedDate: string;
};

type RecomposedComponent = {
  component?: SourceComponent;
  children: Map<string, SourceComponent>;
};

const STATE_FOLDER = projectPaths.relativeStateFolder();

export class MetadataCacheService {
  private static CACHE_FOLDER = [STATE_FOLDER, 'diff'];
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
   * @param projectPath The base path of a SFDX Project
   */
  public initialize(componentPath: string, projectPath: string, isManifest: boolean = false): void {
    this.componentPath = componentPath;
    this.projectPath = projectPath;
    this.isManifest = isManifest;
  }

  /**
   * Load a metadata cache based on a project path that defines a set of components.
   *
   * @param componentPath A path referring to a project folder, an individual component resource
   * or a manifest file
   * @param projectPath The base path of a SFDX Project
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
    if (components.size === 0) {
      return undefined;
    }
    const operation = await this.createRetrieveOperation(components);
    const results = await operation.pollStatus();
    return this.processResults(results);
  }

  public async getSourceComponents(): Promise<ComponentSet> {
    if (this.componentPath && this.projectPath) {
      const packageDirs = await SalesforcePackageDirectories.getPackageDirectoryFullPaths();
      this.sourceComponents = this.isManifest
        ? await ComponentSet.fromManifest({
            manifestPath: this.componentPath,
            resolveSourcePaths: packageDirs,
            forceAddWildcards: true
          })
        : ComponentSet.fromSource(this.componentPath);
      return this.sourceComponents;
    }
    return new ComponentSet();
  }

  public async createRetrieveOperation(comps?: ComponentSet): Promise<MetadataApiRetrieve> {
    const components = comps || (await this.getSourceComponents());
    this.clearDirectory(this.cachePath, true);

    await componentSetUtils.setApiVersion(components);
    const connection = await WorkspaceContext.getInstance().getConnection();
    const operation = await components.retrieve({
      usernameOrConnection: connection,
      output: this.cachePath,
      merge: false,
      suppressEvents: true
    });

    return operation;
  }

  public async processResults(result: RetrieveResult | undefined): Promise<MetadataCacheResult | undefined> {
    if (!result) {
      return;
    }

    const { components, properties } = this.extractResults(result);
    if (components.length > 0 && this.componentPath && this.projectPath) {
      const propsFile = this.saveProperties(properties);
      const cacheCommon = this.findLongestCommonDir(components, this.cachePath);

      const sourceComps = this.sourceComponents.getSourceComponents().toArray();
      const projCommon = this.findLongestCommonDir(sourceComps, this.projectPath);

      let selectedType = PathType.Unknown;
      if (fs.existsSync(this.componentPath) && fs.lstatSync(this.componentPath).isDirectory()) {
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
        },
        properties
      };
    }
  }

  private extractResults(result: RetrieveResult): {
    components: SourceComponent[];
    properties: FileProperties[];
  } {
    const properties: FileProperties[] = [];
    if (Array.isArray(result.response.fileProperties)) {
      properties.push(...result.response.fileProperties);
    } else {
      properties.push(result.response.fileProperties);
    }
    const components = result.components.getSourceComponents().toArray();
    return { components, properties };
  }

  private findLongestCommonDir(comps: SourceComponent[], baseDir: string): string {
    if (comps.length === 0) {
      return '';
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

  /**
   * Groups the information in a MetadataCacheResult by component.
   * Child components are returned as an array entry unless their parent is present.
   * @param result A MetadataCacheResult
   * @returns An array with one entry per retrieved component, with all corresponding information about the component included
   */
  public static correlateResults(result: MetadataCacheResult): CorrelatedComponent[] {
    const components: CorrelatedComponent[] = [];

    const projectIndex = new Map<string, RecomposedComponent>();
    this.pairParentsAndChildren(projectIndex, result.project.components);

    const cacheIndex = new Map<string, RecomposedComponent>();
    this.pairParentsAndChildren(cacheIndex, result.cache.components);

    const fileIndex = new Map<string, FileProperties>();
    for (const fileProperty of result.properties) {
      fileIndex.set(MetadataCacheService.makeKey(fileProperty.type, fileProperty.fullName), fileProperty);
    }

    fileIndex.forEach((fileProperties, key) => {
      const cacheComponent = cacheIndex.get(key);
      const projectComponent = projectIndex.get(key);
      if (cacheComponent && projectComponent) {
        if (cacheComponent.component && projectComponent.component) {
          components.push({
            cacheComponent: cacheComponent.component,
            projectComponent: projectComponent.component,
            lastModifiedDate: fileProperties.lastModifiedDate
          });
        } else {
          cacheComponent.children.forEach((cacheChild, childKey) => {
            const projectChild = projectComponent.children.get(childKey);
            if (projectChild) {
              components.push({
                cacheComponent: cacheChild,
                projectComponent: projectChild,
                lastModifiedDate: fileProperties.lastModifiedDate
              });
            }
          });
        }
      }
    });

    return components;
  }

  /**
   * Creates a map in which parent components and their children are stored together
   * @param index The map which is mutated by this function
   * @param components The parent and/or child components to add to the map
   */
  private static pairParentsAndChildren(index: Map<string, RecomposedComponent>, components: SourceComponent[]) {
    for (const comp of components) {
      const key = MetadataCacheService.makeKey(comp.type.name, comp.fullName);
      // If the component has a parent it is assumed to be a child
      if (comp.parent) {
        const parentKey = MetadataCacheService.makeKey(comp.parent.type.name, comp.parent.fullName);
        const parentEntry = index.get(parentKey);
        if (parentEntry) {
          // Add the child component if we have an entry for the parent
          parentEntry.children.set(key, comp);
        } else {
          // Create a new entry that does not have a parent yet
          index.set(parentKey, {
            children: new Map<string, SourceComponent>().set(key, comp)
          });
        }
      } else {
        const entry = index.get(key);
        if (entry) {
          // Add this parent to an existing entry without overwriting the children
          entry.component = comp;
        } else {
          // Create a new entry with just the parent
          index.set(key, {
            component: comp,
            children: new Map<string, SourceComponent>()
          });
        }
      }
    }
  }

  private static makeKey(type: string, fullName: string): string {
    return `${type}#${fullName}`;
  }

  public getCachePath(): string {
    return this.cachePath;
  }

  public makeCachePath(cacheKey: string): string {
    return path.join(os.tmpdir(), ...MetadataCacheService.CACHE_FOLDER, cacheKey);
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

export type MetadataCacheCallback = (username: string, cache: MetadataCacheResult | undefined) => Promise<void>;

export class MetadataCacheExecutor extends RetrieveExecutor<string> {
  private cacheService: MetadataCacheService;
  private callback: MetadataCacheCallback;
  private isManifest: boolean = false;
  private username: string;

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
    this.username = username;
    this.cacheService = new MetadataCacheService(username);
  }

  protected async getComponents(response: any): Promise<ComponentSet> {
    this.cacheService.initialize(response.data, workspaceUtils.getRootWorkspacePath(), this.isManifest);
    return this.cacheService.getSourceComponents();
  }

  protected async doOperation(
    components: ComponentSet,
    token: vscode.CancellationToken
  ): Promise<RetrieveResult | undefined> {
    const operation = await this.cacheService.createRetrieveOperation(components);
    this.setupCancellation(operation, token);
    return operation.pollStatus();
  }

  protected async postOperation(result: RetrieveResult | undefined) {
    const cache: MetadataCacheResult | undefined = await this.cacheService.processResults(result);
    await this.callback(this.username, cache);
  }
}
