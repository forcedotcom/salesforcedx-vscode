/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { NonEmptyComponentSet } from './core/componentSetService';
import type { DefaultOrgInfoSchema } from './core/schemas/defaultOrgInfo';
import type { FilePropertiesSchema } from './core/schemas/fileProperties';
import type { TraceFlagItem, TraceFlagLogType } from './core/schemas/traceFlagSchemas';
import type { SourceTrackingOptions } from './core/sourceTrackingService';
import type { TemplateOptionsFor } from './core/templateService';
import type { ConnectionData } from './owned/metadata';
import type { ProjectInfo } from './owned/projectInfo';
import type { ServicesOrg } from './owned/servicesOrg';
import type { Connection, SfProject } from '@salesforce/core';
import type { ComponentSet, DeployResult, MetadataMember, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import type { ChangeResult } from '@salesforce/source-tracking';
import type { CreateOutput, TemplateType } from '@salesforce/templates';
import type * as Schema from 'effect/Schema';
import type { DescribeMetadataObject } from 'jsforce/lib/api/metadata/schema';
import type * as vscode from 'vscode';
import type { URI } from 'vscode-uri';

type DefaultOrgInfo = Schema.Schema.Type<typeof DefaultOrgInfoSchema>;
type FilePropertiesPlain = Schema.Schema.Type<typeof FilePropertiesSchema>;

/**
 * Template creation parameters
 */
type CreateParams<T extends TemplateType = TemplateType> = {
  cwd: string;
  templateType: T;
  outputdir?: URI;
  options: TemplateOptionsFor<T>;
};

/**
 * Core services contract - defines the API surface that both Effect services and PlainServicesApi must satisfy.
 * This is the single source of truth for what methods are available.
 *
 * Adding a method here requires:
 * 1. Implementing it in the underlying Effect service
 * 2. Implementing it in PlainServicesApi (with Promise wrapper)
 *
 * TypeScript will enforce both sides stay in sync.
 */
export type ServicesContract = {
  // Connection / Org
  readonly getConnection: () => Connection;
  readonly invalidateCachedConnections: () => void;
  readonly withDefaultOrg: <R>(use: (org: ServicesOrg) => R | Promise<R>) => Promise<R>;
  readonly getConnectionData: () => ConnectionData;

  // Workspace
  readonly getWorkspaceInfo: () => {
    uri: URI;
    path: string;
    fsPath: string;
    isEmpty: boolean;
    isVirtualFs: boolean;
    cwd: string;
  };

  // Project
  readonly isSalesforceProject: () => boolean;
  readonly getSfProject: () => SfProject;
  readonly getProjectInfo: () => ProjectInfo;
  readonly isInPackageDirectories: (uri: URI) => boolean;

  // Settings
  readonly getApiVersion: () => string;

  // Config
  readonly getTargetDevHub: () => string | undefined;
  readonly unsetTargetOrg: () => void;
  readonly unsetTargetDevHub: () => void;

  // Aliases
  readonly getAllAliases: () => Record<string, string>;
  readonly getUsernameFromAlias: (alias: string) => string | undefined;

  // File System
  readonly readFile: (filePath: string | URI) => string;
  readonly writeFile: (filePath: string | URI, content: string) => void;
  readonly fileOrFolderExists: (filePath: string | URI) => boolean;
  readonly findFiles: (include: vscode.GlobPattern, exclude?: vscode.GlobPattern | null, maxResults?: number) => URI[];
  readonly isDirectory: (path: string | URI) => boolean;
  readonly isFile: (path: string | URI) => boolean;
  readonly createDirectory: (dirPath: string | URI) => void;
  readonly deleteFile: (filePath: string) => void;
  readonly readDirectory: (dirPath: string | URI) => URI[];

  // Editor
  readonly getActiveEditorUri: () => URI;
  readonly getActiveEditorText: (selection?: boolean) => string;

  // Channel (these are fire-and-forget, not async)
  // Note: These are excluded from PromisifiedContract conversion

  // Metadata Describe
  readonly describe: () => DescribeMetadataObject[];

  // Metadata Deploy
  readonly deploy: (components: ComponentSet) => DeployResult;

  // Metadata Retrieve (basic signatures - specialized ones excluded)
  readonly retrieveComponentSet: (components: ComponentSet) => RetrieveResult;

  // Source Tracking (basic methods)
  readonly hasTracking: () => boolean;
  readonly getConflicts: () => ChangeResult[];
  readonly checkConflicts: () => void;

  // Terminal
  readonly simpleExec: (command: string, parse?: (stdout: string) => string, timeoutMs?: number) => string;

  // Component Set
  readonly getComponentSetFromUris: (uris: readonly URI[]) => ComponentSet;
  readonly getComponentSetFromManifest: (manifestUri: URI) => ComponentSet;
  readonly getComponentSetFromProjectDirectories: () => ComponentSet;
};

/**
 * Extended contract methods that have specialized signatures not suitable for basic contract.
 * These are documented here but implemented directly in PlainServicesApi.
 */
export type ServicesContractExtensions = {
  // Org Info (returns specialized type)
  readonly getTargetOrgInfo: () => DefaultOrgInfo;

  // Settings (generic methods)
  readonly getSettingsValue: <T>(section: string, key: string, defaultValue?: T) => T | undefined;
  readonly setSettingsValue: (section: string, key: string, value: unknown) => void;

  // Metadata operations with optional parameters
  readonly listMetadata: (type: string, folder?: string) => readonly FilePropertiesPlain[];
  readonly retrieve: (members: MetadataMember[], options?: SourceTrackingOptions) => RetrieveResult;
  readonly retrieveComponentSetToDirectory: (components: NonEmptyComponentSet, outputPath: URI) => RetrieveResult;

  // Source tracking with specialized return types
  readonly getLocalChangesAsComponentSet: () => ComponentSet[];
  readonly getRemoteNonDeletesAsComponentSet: (options: { applyIgnore: boolean }) => ComponentSet;

  // Template creation with generic type parameter
  readonly createFromTemplate: <T extends TemplateType>(params: CreateParams<T>) => CreateOutput;

  // Trace flags
  readonly getTraceFlags: () => TraceFlagItem[];
  readonly ensureTraceFlag: (
    userId: string,
    duration?: number,
    logType?: TraceFlagLogType,
    existingDebugLevelId?: string
  ) => { created: boolean; traceFlagId: string };
};

/**
 * Event handlers - these are not async operations, so they're separate from the contract.
 * PlainServicesApi must include these as vscode.Event types.
 */
export type ServicesEvents = {
  readonly onDidChangeTargetOrg: DefaultOrgInfo;
  readonly onDidChangeActiveEditor: vscode.TextEditor | undefined;
  readonly onDidChangeTraceFlags: TraceFlagItem[];
};

/**
 * Synchronous fire-and-forget methods - not part of the async contract.
 */
export type ServicesSyncMethods = {
  readonly appendToChannel: (message: string) => void;
  readonly clearChannel: () => void;
};

/**
 * Helper type to convert contract methods into Promise-returning versions for PlainServicesApi.
 * Note: Synchronous methods like appendToChannel/clearChannel must be added separately
 * to PlainServicesApi since they're fire-and-forget.
 */
export type PromisifiedContract<T> = {
  [K in keyof T]: T[K] extends (...args: infer P) => infer R ? (...args: P) => Promise<Awaited<R>> : T[K];
};
