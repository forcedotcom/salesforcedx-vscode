/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ChannelService } from './channelService.js';
import type { RegisterCommandWithRuntime } from './commandRegistration.js';
import type { ConnectionService, ConnectionError } from './connectionService.js';
import type { ErrorHandlerService } from './errorHandlerService.js';
import type { InactiveOrgOperationError, UserCancellationError } from './errors.js';
import type { ExtensionContextService, ExtensionContextServiceLayer } from './extensionContextService.js';
import type { NotificationModeService } from './notificationModeService.js';
import type { ORG_METADATA_SCHEME } from './orgMetadataReference.js';
import type { PublicServices, publicServiceKeys } from './publicServiceKeys.js';
import type { LegacyTelemetrySender, SdkLayerConfig, V2SdkLayerFor } from './sdkLayer.js';
import type { TargetOrgRef } from './targetOrgRef.js';
import type { TraceFlagItemStruct } from './traceFlagSchemas.js';
import type * as SfTemplates from '@salesforce/templates';
import type * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as Layer from 'effect/Layer';
import type * as vscode from 'vscode';

/** Activation exposes this only after live V4 service binding. */
export type SalesforceVSCodeServicesApiV2 = {
  readonly v2: {
    readonly services: typeof publicServiceKeys & {
      readonly ExtensionContextService: typeof ExtensionContextService;
      readonly ExtensionContextServiceLayer: typeof ExtensionContextServiceLayer;
      readonly ErrorHandlerService: typeof ErrorHandlerService;
      readonly ChannelServiceLayer: (displayName: string) => Layer.Layer<ChannelService>;
      readonly ErrorHandlerServiceLayer: Layer.Layer<ErrorHandlerService, never, ChannelService>;
      readonly getErrorMessage: (error: unknown) => string;
      readonly registerCommandWithRuntime: RegisterCommandWithRuntime;
      readonly ClearDefaultOrgRef: () => Effect.Effect<void>;
      readonly preventOrgChanges: <A, E, R>(
        command: Effect.Effect<A, E, R>
      ) => Effect.Effect<A, E | ConnectionError | InactiveOrgOperationError, R | ConnectionService | TargetOrgRef>;
      readonly NotificationModeService: typeof NotificationModeService;
      readonly UserCancellationError: typeof UserCancellationError;
      readonly TraceFlagItemStruct: typeof TraceFlagItemStruct;
      readonly ORG_METADATA_SCHEME: typeof ORG_METADATA_SCHEME;
      readonly TemplateType: typeof SfTemplates.TemplateType;
      readonly NotificationModeServiceLayer: (
        extensionSection: string,
        statusBarId: string,
        statusBarName: string
      ) => Layer.Layer<NotificationModeService>;
      readonly getSdkLayerConfigFromContext: (context: vscode.ExtensionContext) => SdkLayerConfig;
      readonly getLegacyTelemetrySender: LegacyTelemetrySender;
      readonly SdkLayerFor: V2SdkLayerFor;
      readonly prebuiltServicesDependencies: Context.Context<PublicServices>;
      readonly prebuiltServicesLayer: Layer.Layer<PublicServices>;
    };
  };
};
export { publicServiceKeys, type PublicServices } from './publicServiceKeys.js';

export { AliasService } from './aliasService.js';
export type { SdkLayerConfig, V2SdkLayerFor, LegacyTelemetryItem, LegacyTelemetrySender } from './sdkLayer.js';
export { TraceFlagService, type TraceFlagReadError, type TraceFlagWriteError } from './traceFlagService.js';
export {
  TraceFlagLogType,
  TraceFlagItemSchema,
  TraceFlagItemStruct,
  ToolingTraceFlagRecordSchema,
  ToolingDebugLevelStruct,
  CreateDebugLevelStruct,
  DebugLevelItemSchema,
  type TraceFlagItem,
  type DebugLevelItem,
  type CreateDebugLevelPayload
} from './traceFlagSchemas.js';
export {
  TraceFlagCreateError,
  TraceFlagUpdateError,
  TraceFlagNotFoundError,
  DebugLevelCreateError,
  DebugLevelDeleteError,
  UserIdNotFoundError
} from './traceFlagErrors.js';
export { ApexLogService, ApexLogListItem, ApexLogBodyFetchError, type ListLogsOptions } from './apexLogService.js';
export {
  ExecuteAnonymousService,
  ExecuteAnonymousError,
  type ExecuteAnonymousResult,
  type ExecuteAnonymousWithLog
} from './executeAnonymousService.js';
export { ConfigService } from './configService.js';
export { ConnectionService, type ConnectionError, type OrgAuthorizationSummary } from './connectionService.js';
export { ProjectService, type ProjectError } from './projectService.js';
export { ComponentSetService, type NonEmptyComponentSet, type ComponentSetBuildError } from './componentSetService.js';
export {
  MetadataRetrieveService,
  type MetadataRetrieveDirectoryError,
  type MetadataRetrieveOptions,
  type MetadataRetrieveOperationError
} from './metadataRetrieveService.js';
export { MetadataDeployService, type MetadataDeployOperationError } from './metadataDeployService.js';
export { MetadataDeleteService } from './metadataDeleteService.js';
export {
  LightningComponentService,
  type LightningComponentKind,
  type RenameBundleParams
} from './lightningComponentService.js';
export {
  SourceTrackingService,
  type SourceTrackingReadError,
  type SourceTrackingOperationError,
  type SourceTrackingStatusOptions
} from './sourceTrackingService.js';
export {
  RequestStatusValue,
  isSDRSuccess,
  isSDRFailure,
  fileResponseHasPath,
  toComponentStatusChangeType,
  toRequestStatus,
  makeFileResponseFailure
} from './sdrGuards.js';
export { MetadataRegistryService } from './metadataRegistryService.js';
export {
  MetadataDescribeService,
  FOLDERED_METADATA_TYPES,
  type MetadataTypeDescription,
  type SObjectGlobalDescribeItem,
  type MetadataDescribeReadError,
  type MetadataListReadError
} from './metadataDescribeService.js';
export {
  QueryService,
  type QueryOptions,
  type QueryPage,
  type QueryPageError,
  type QueryServiceResult
} from './queryService.js';
export {
  TransmogrifierService,
  type DescribeSObjectResult,
  type RestSObjectDescribeTransmogrifierInput,
  type WorkspaceSObjectMetadataDocument,
  type WorkspaceSObjectMetadataTransmogrifierInput,
  type PersistedSObjectSemanticModelTransmogrifierInput,
  type TransmogrifierInput
} from './transmogrifierService.js';
export { ActiveMetadataOperationRef } from './activeMetadataOperationRef.js';
export { OrgMetadataCatalogChangePubSub, type OrgMetadataCatalogChange } from './orgMetadataCatalogChangePubSub.js';
export { OrgMetadataCatalogError } from './orgMetadataCatalogErrors.js';
export {
  OrgMetadataCatalog,
  type OrgMetadataCatalogService,
  type OrgMetadataCatalogReadError,
  type OrgMetadataCatalogComponentResolution
} from './orgMetadataCatalog.js';
export {
  MetadataChangeNotificationService,
  MetadataOperationEvent,
  MetadataChangeEvent,
  MetadataChangeType,
  metadataChangeFileUris,
  dedupeMetadataChanges
} from './metadataChangeNotificationService.js';
export { UriSchema, DocumentUriSchema, type DocumentUri } from './uriSchema.js';
export { SObjectSchema, type SObject, type SObjectField, type ChildRelationship } from './sObject.js';
export { FilePropertiesSchema, FilePropertiesByFullName } from './fileProperties.js';
export {
  ArtifactProjectionSchemas,
  ArtifactPresenceSchema,
  ArtifactProviderKindSchema,
  CatalogEntryDescriptorSchema,
  SourceDocumentSchema,
  SObjectPicklistValueSchema,
  SObjectFieldRuntimeCapabilitiesSchema,
  SObjectSemanticFieldSchema,
  SObjectChildRelationshipSchema,
  SObjectSemanticValueSchema,
  SObjectSemanticModelSchema,
  CanonicalSemanticModelSchema,
  CatalogEntryProjectionSchema,
  SourceDocumentProjectionSchema,
  SObjectSemanticProjectionSchema,
  ArtifactProjectionSchema,
  ProjectionUnavailableReasonSchema,
  ProjectionUnavailableSchema,
  type ArtifactPresence,
  type ArtifactProviderKind,
  type CatalogEntryDescriptor,
  type SourceDocument,
  type SObjectPicklistValue,
  type SObjectFieldRuntimeCapabilities,
  type SObjectSemanticField,
  type SObjectChildRelationship,
  type SObjectSemanticValue,
  type SObjectSemanticModel,
  type CanonicalSemanticModel,
  type CatalogEntryProjection,
  type SourceDocumentProjection,
  type SObjectSemanticProjection,
  type ArtifactProjection,
  type ProjectionUnavailableReason,
  type ProjectionUnavailable
} from './artifactProjection.js';
export {
  ORG_METADATA_SCHEME,
  OrgMetadataReference,
  OrgMetadataComponentReference,
  OrgMetadataDocumentLocation,
  isOrgMetadataComponentReference,
  orgIdFromOrgMetadataUri,
  getTypeSuffix,
  documentUri,
  documentUris,
  parseDocumentUri
} from './orgMetadataReference.js';
export {
  OrgMetadataCatalogEntrySchema,
  type OrgMetadataConsistency,
  type OrgMetadataHierarchyConsistency,
  type OrgMetadataCatalogReference,
  type OrgMetadataCatalogComponentReference,
  type OrgSObjectSummary,
  type OrgSObjectDescription,
  type OrgMetadataFieldDetails,
  type OrgMetadataCatalogInternalEntry,
  type OrgMetadataCatalogFolderEntry,
  type OrgMetadataCatalogComponentEntry,
  type OrgMetadataCatalogFieldEntry,
  type OrgMetadataCatalogEntry
} from './orgMetadataCatalogTypes.js';
export {
  NonEmptyTrimmedString,
  ArtifactTargetKindSchema,
  ArtifactNamespaceSchema,
  MetadataComponentArtifactIdentitySchema,
  SObjectArtifactIdentitySchema,
  ArtifactIdentitySchema,
  normalizeArtifactIdentityPart,
  normalizeArtifactNamespace,
  normalizeArtifactIdentity,
  artifactIdentityKey,
  artifactIdentitiesEqual,
  artifactNamespacesEqual,
  type ArtifactTargetKind,
  type ArtifactNamespace,
  type MetadataComponentArtifactIdentity,
  type SObjectArtifactIdentity,
  type ArtifactIdentity
} from './artifactIdentity.js';
export {
  AuthFields,
  authFieldsFrom,
  authFieldsFromConnection,
  orgIdFrom,
  orgIdFromConnection,
  type AuthInfoFields
} from './authFields.js';
export { TargetOrgRef } from './targetOrgRef.js';
export { WorkspaceService, type WorkspaceInfo, type WorkspaceWithFolder } from './workspaceService.js';
export { SettingsService, WebSessionContextSchema, type WebSessionContext } from './settingsService.js';
export { FsService, type FsProvider } from './fsService.js';
export { HashableUri } from './hashableUri.js';
export { FileChangePubSub, type FileChangeEvent } from './fileChangePubSub.js';
export { SettingsChangePubSub } from './settingsChangePubSub.js';
export { HostFileWatcher } from './hostFileWatcher.js';
export { ChannelService } from './channelService.js';
export { EditorService, type ActiveEditorContext } from './editorService.js';
export { ErrorHandlerService } from './errorHandlerService.js';
export { MediaService } from './mediaService.js';
export { PromptService, type OutputDirectoryPrompt } from './promptService.js';
export { TerminalService, TerminalServiceError, type SimpleExecInput } from './terminalService.js';
export {
  TemplateService,
  TemplatesRootPathNotAvailableError,
  TemplatesManifestLoadError,
  type TemplateReadError,
  type CreateParams,
  type TemplateOptionsFor,
  type ProjectCreateOptions,
  type ApexClassCreateOptions,
  type ApexTriggerCreateOptions,
  type LightningComponentCreateOptions,
  type LightningAppCreateOptions,
  type LightningEventCreateOptions,
  type LightningInterfaceCreateOptions,
  type VisualforceComponentCreateOptions,
  type VisualforcePageCreateOptions
} from './templateService.js';
export type { TemplateType, CreateOutput } from '@salesforce/templates';
export {
  NotificationModeService,
  type ToastAction,
  type ProgressAndSuccessMode,
  type ProgressOnlyMode,
  type SuccessOnlyMode
} from './notificationModeService.js';
export { ICONS, type IconId } from './icons.js';
export type { RegisterCommandWithRuntime } from './commandRegistration.js';
export { ExtensionContextService, ExtensionContextServiceLayer } from './extensionContextService.js';
export { DefaultOrgInfoSchema, OrgId, SalesforceId, CliId, type DefaultOrgInfo } from './defaultOrgInfo.js';
export {
  AccessTokenExpiredError,
  FailedToCreateAuthInfoError,
  FailedToCreateConfigAggregatorError,
  FailedToCreateConnectionError,
  NoTargetOrgConfiguredError,
  NoWorkspaceOpenError,
  NoActiveEditorError,
  SettingsError,
  ConfigWriteError,
  FsServiceError,
  HostFileNotFoundError,
  HostFileWatchError,
  FailedToSaveAuthInfoError,
  FailedToListAuthorizationsError,
  GetAuthFieldsError,
  InactiveOrgOperationError,
  FailedToResolveSfProjectError,
  NotInPackageDirectoryError,
  GetRegistryAccessError,
  SoqlError,
  FieldError,
  TransmogrifierError,
  MetadataDescribeError,
  ListMetadataError,
  EmptyComponentSetError,
  FailedToBuildComponentSetError,
  MetadataRetrieveError,
  MetadataDeployError,
  MetadataDeleteError,
  UserCancellationError,
  SourceTrackingError,
  SourceTrackingNotEnabledError,
  SourceTrackingConflictError
} from './errors.js';
