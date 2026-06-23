/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// IMPORT-FREE CONSUMER GATE.
// This fixture imports the owned-data surface from the PUBLISHED `salesforcedx-vscode-services-types/owned`
// entry and is type-checked by a dedicated tsconfig (test-consumer/tsconfig.json) whose `types: []` and
// isolated module resolution mean NO Salesforce SDK / effect typings are available. If any owned type
// transitively referenced an SDK/effect type, this file would fail to type-check. It proves the owned surface
// is genuinely consumable with zero Salesforce-SDK / effect installation.
import type {
  OwnedServicesApi,
  DeployOutcome,
  RetrieveOutcome,
  ProjectInfo,
  SourceSpec,
  ComponentSetInfo,
  OrgChange,
  MetadataTypeInfo,
  ServicesOrg,
  ConnectionData,
  OwnedMetadataMember,
  TemplateCreateOutcome
} from 'salesforcedx-vscode-services-types/owned';
import { ICONS, componentSetHas, componentFilenamesByNameAndType } from 'salesforcedx-vscode-services-types/owned';

// Exercise the data-only API surface purely at the type level — no runtime, no SDK.
declare const api: OwnedServicesApi;

const useApi = async (): Promise<void> => {
  const data: ConnectionData = await api.getConnectionData();
  void data.accessToken;
  void data.username;

  const project: ProjectInfo = await api.getProjectInfo();
  void project.defaultPackage.path;
  void project.sfdcLoginUrl;

  const manifestSpec: SourceSpec = { kind: 'manifest', manifestUri: 'file:///x/package.xml' };
  const deploy: DeployOutcome = await api.deployFromSource(manifestSpec, { ignoreConflicts: true });
  void deploy.appliedToOrg;
  void deploy.fileResponses[0]?.problemType;

  const retrieve: RetrieveOutcome = await api.retrieveToSource({ kind: 'projectDirectories' });
  void retrieve.components[0]?.lastModifiedDate;

  const members: readonly OwnedMetadataMember[] = [{ type: 'ApexClass', fullName: 'Foo' }];
  const byMembers: RetrieveOutcome = await api.retrieveMembers(members);
  void byMembers.success;

  const info: ComponentSetInfo = await api.describeProjectComponents({ kind: 'projectDirectories', members });
  void componentSetHas(info, { type: 'ApexClass', fullName: 'Foo' });
  void componentFilenamesByNameAndType(info, { type: 'ApexClass', fullName: 'Foo' });

  const types: readonly MetadataTypeInfo[] = await api.describeMetadata();
  void types[0]?.xmlName;

  const conflicts: readonly OrgChange[] = await api.getConflictChanges();
  void conflicts[0]?.fullName;

  const created: TemplateCreateOutcome = await api.createFromTemplateOwned({
    cwd: '/proj',
    templateType: 'apex_class',
    options: { classname: 'Foo' }
  });
  void created.rawOutput;

  // Loan facade — lends an owned ServicesOrg, never a live Connection.
  await api.withDefaultOrg(async (org: ServicesOrg) => {
    const result = await org.query<{ Id: string }>('SELECT Id FROM Account', { tooling: false });
    return result.records.length;
  });

  void ICONS.SF_DEFAULT_ORG;
};

void useApi;
