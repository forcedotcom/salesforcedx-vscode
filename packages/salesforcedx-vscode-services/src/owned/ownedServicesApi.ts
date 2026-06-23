/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Hand-authored, services-owned. NO imports from @salesforce/*, jsforce, or effect.
//
// OwnedServicesApi is the IMPORT-FREE published surface for external consumers that want the data-only
// services API without installing the Salesforce SDK or effect. It is the Promise-returning ("plain")
// form of exactly the owned-data members of the services contract — every signature references only
// owned data types (this file + sibling owned/*.ts). It is a curated SUBSET of the full
// SalesforceVSCodeServicesApi: the deprecated 3pp getters and the effect-coupled `services` sub-object
// are intentionally absent so this surface stays import-free by construction.
//
// Authoring rule (the @types/vscode technique): keep these signatures in lock-step with the owned-data
// members of contract.ts (ServicesContract + ServicesContractExtensions). The contract is the source of
// truth for the in-extension implementation; this is the hand-authored published view of its data-only part.
import type { OrgChange } from './changes';
import type { ComponentSetInfo, OwnedMetadataMember } from './components';
import type { DeployFromSourceOptions, DeployOutcome, RetrieveOptions, RetrieveOutcome, SourceSpec } from './deploy';
import type { ConnectionData, MetadataTypeInfo, TemplateCreateOutcome } from './metadata';
import type { ProjectInfo } from './projectInfo';
import type { ServicesOrg } from './servicesOrg';

/** Template-creation parameters for createFromTemplateOwned (owned form — templateType is a plain string). */
export type OwnedCreateParams = {
  readonly cwd: string;
  /** Template type name, e.g. 'lightning_web_component' | 'apex_class' (a @salesforce/templates TemplateType value). */
  readonly templateType: string;
  /** Optional override output directory, as a string path or URI string. */
  readonly outputdir?: string;
  /** Template-type-specific options passed through to the templates library. */
  readonly options: Record<string, unknown>;
};

/**
 * The import-free, data-only public services API surface. All methods return owned data (or lend a
 * services-owned `ServicesOrg` facade); no live Salesforce-SDK instance ever appears.
 */
export type OwnedServicesApi = {
  // Connection / Org (data-only)
  /** Loan a services-owned org facade for the default org; the facade is returned, never a live Connection. */
  readonly withDefaultOrg: <R>(use: (org: ServicesOrg) => R | Promise<R>) => Promise<R>;
  /** Auth data for the default org (enough to build your own SDK Connection); never a live Connection. */
  readonly getConnectionData: () => Promise<ConnectionData>;

  // Project (data-only)
  readonly getProjectInfo: () => Promise<ProjectInfo>;

  // Metadata describe (data-only)
  readonly describeMetadata: () => Promise<readonly MetadataTypeInfo[]>;
  readonly describeProjectComponents: (spec: SourceSpec) => Promise<ComponentSetInfo>;

  // Deploy / Retrieve (data-only, SourceSpec-based)
  readonly deployFromSource: (spec: SourceSpec, opts?: DeployFromSourceOptions) => Promise<DeployOutcome>;
  readonly retrieveToSource: (spec: SourceSpec, opts?: RetrieveOptions) => Promise<RetrieveOutcome>;
  readonly retrieveRemoteChanges: (opts?: RetrieveOptions) => Promise<RetrieveOutcome>;
  readonly retrieveMembers: (
    members: readonly OwnedMetadataMember[],
    opts?: RetrieveOptions
  ) => Promise<RetrieveOutcome>;

  // Source tracking (data-only)
  readonly getConflictChanges: () => Promise<readonly OrgChange[]>;
  readonly getLocalChanges: (opts?: { readonly applyIgnore?: boolean }) => Promise<readonly OrgChange[]>;
  readonly getRemoteChanges: (opts?: { readonly applyIgnore?: boolean }) => Promise<readonly OrgChange[]>;

  // Template creation (data-only)
  readonly createFromTemplateOwned: (params: OwnedCreateParams) => Promise<TemplateCreateOutcome>;
};
