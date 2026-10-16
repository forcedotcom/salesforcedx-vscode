/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionPackageJsonSchema, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { SFDX_CORE_CONFIGURATION_NAME } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import { isError, isNotUndefined, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';

type XMLExtensionApi = {
  addXMLCatalogs: (catalogs: string[]) => void;
  addXMLFileAssociations: (fileAssociations: { systemId: string; pattern: string }[]) => void;
};

type SchemaDocumentationInspection =
  | Pick<
      NonNullable<ReturnType<vscode.WorkspaceConfiguration['inspect']>>,
      'globalValue' | 'workspaceValue' | 'workspaceFolderValue' | 'globalLanguageValue' | 'workspaceLanguageValue'
    >
  | undefined;

class RedHatXmlExtensionSetupError extends Schema.TaggedError<RedHatXmlExtensionSetupError>()(
  'RedHatXmlExtensionSetupError',
  {
    message: Schema.String,
    cause: Schema.Unknown
  }
) {}

class XmlConfigurationInspectError extends Schema.TaggedError<XmlConfigurationInspectError>()(
  'XmlConfigurationInspectError',
  {
    message: Schema.String,
    cause: Schema.Unknown,
    setting: Schema.String
  }
) {}

class RedHatXmlSupportError extends Schema.TaggedError<RedHatXmlSupportError>()('RedHatXmlSupportError', {
  message: Schema.String
}) {}

const MIN_XML_SERVER_HEAP_MB = 1024;
const XMX_REGEX = /-Xmx(\d+)([kKmMgG]?)\b/;

const toMegabytes = (value: number, unit: string): number => {
  switch (unit.toLowerCase()) {
    case 'g':
      return value * 1024;
    case 'k':
      return Math.floor(value / 1024);
    case '':
      return Math.floor(value / (1024 * 1024)); // bare number = bytes
    default:
      return value; // 'm'
  }
};

/**
 * Returns the vmargs string with -Xmx raised to MIN_XML_SERVER_HEAP_MB if it is currently
 * below that threshold, or undefined when no change is needed.
 */
export const ensureMinXmlHeap = (vmArgs: string | undefined): string | undefined => {
  const current = vmArgs ?? '';
  const match = XMX_REGEX.exec(current);
  if (!match) {
    // No -Xmx present — append one
    return `${current ? `${current} ` : ''}-Xmx${MIN_XML_SERVER_HEAP_MB}M`;
  }
  const heapMb = toMegabytes(parseInt(match[1], 10), match[2]);
  if (heapMb >= MIN_XML_SERVER_HEAP_MB) {
    return undefined; // already sufficient
  }
  return current.replace(XMX_REGEX, `-Xmx${MIN_XML_SERVER_HEAP_MB}M`);
};

export const shouldSetSchemaDocumentationTypeToNone = (inspection: SchemaDocumentationInspection): boolean =>
  [
    inspection?.globalValue,
    inspection?.workspaceValue,
    inspection?.workspaceFolderValue,
    inspection?.globalLanguageValue,
    inspection?.workspaceLanguageValue
  ].every(isUndefined);

const getLocalFilePaths = (extensionUri: URI, targetFileNames: string[]): string[] =>
  targetFileNames.map(targetFileName => Utils.joinPath(extensionUri, 'resources', targetFileName).fsPath);

const getErrorMessage = (error: unknown): string => (isError(error) ? error.message : String(error));

const reportToChannel = Effect.fn('metadataXmlSupport.reportToChannel')(function* (message: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(message);
});

const reportCaughtMessage = (error: { message: string }) => reportToChannel(error.message);

const reportSetupFailure = Effect.fn('metadataXmlSupport.reportSetupFailure')(function* (error: unknown) {
  yield* reportToChannel(nls.localize('metadata_xml_fail_redhat_extension'));
  yield* reportToChannel(getErrorMessage(error));
});

/** Setup Red Hat XML with Salesforce metadata schemas and settings. */
const setupRedhatXml = Effect.fn('metadataXmlSupport.setupRedhatXml')(
  function* (
    inputCatalogs: Parameters<XMLExtensionApi['addXMLCatalogs']>[0],
    inputFileAssociations: Parameters<XMLExtensionApi['addXMLFileAssociations']>[0],
    redHatExtension: vscode.Extension<XMLExtensionApi>
  ) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;
    const settingsService = yield* api.services.SettingsService;

    yield* Effect.tryPromise({
      try: async () => {
        if (!redHatExtension.isActive) {
          await redHatExtension.activate();
        }
        redHatExtension.exports.addXMLCatalogs(inputCatalogs);
        redHatExtension.exports.addXMLFileAssociations(inputFileAssociations);
      },
      catch: cause =>
        new RedHatXmlExtensionSetupError({
          message: getErrorMessage(cause),
          cause
        })
    });

    const inspectXmlConfiguration = <A>(setting: string) =>
      Effect.try({
        try: () => vscode.workspace.getConfiguration('xml').inspect<A>(setting),
        catch: cause =>
          new XmlConfigurationInspectError({
            message: getErrorMessage(cause),
            cause,
            setting
          })
      });

    // Suppress Red Hat XML schema documentation (unless user opts in) to prevent duplication,
    // but only if they haven't already set a value for the XML setting at any scope.
    const doNotSuppress = yield* settingsService.getValueOrElse(
      SFDX_CORE_CONFIGURATION_NAME,
      'metadata.doNotSuppressRedhatSchemaDocumentation',
      false
    );
    if (!doNotSuppress) {
      const docTypeInspect = yield* inspectXmlConfiguration<string>('preferences.showSchemaDocumentationType');
      if (shouldSetSchemaDocumentationTypeToNone(docTypeInspect)) {
        yield* settingsService.setValue(
          'xml',
          'preferences.showSchemaDocumentationType',
          'none',
          vscode.ConfigurationTarget.Workspace
        );
      }
    }

    // Ensure the XML language server has enough memory to avoid OOM crashes on large Salesforce
    // projects. Write to User settings so it persists across all projects, but only if the
    // current User-level value is absent or below the minimum heap threshold.
    const vmArgsInspect = yield* inspectXmlConfiguration<string>('server.vmargs');
    const updatedVmArgs = ensureMinXmlHeap(vmArgsInspect?.globalValue);
    if (isNotUndefined(updatedVmArgs)) {
      yield* settingsService.setValue('xml', 'server.vmargs', updatedVmArgs, vscode.ConfigurationTarget.Global);
      yield* channelService.appendToChannel(nls.localize('metadata_xml_vmargs_configured'));
    }

    yield* channelService.appendToChannel(nls.localize('metadata_xml_redhat_extension_setup_success'));
  },
  Effect.catchTags({
    MissingSettingsError: reportSetupFailure,
    RedHatXmlExtensionSetupError: error => reportSetupFailure(error.cause),
    XmlConfigurationInspectError: error => reportSetupFailure(error.cause)
  })
);

const setupCompatibleRedhatXml = Effect.fn('metadataXmlSupport.setupCompatibleRedhatXml')(function* (
  redHatExtension: vscode.Extension<XMLExtensionApi>
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const extensionContext = yield* (yield* api.services.ExtensionContextService).getContext;
  const extensionUri = URI.parse(extensionContext.extensionUri.toString());
  yield* setupRedhatXml(
    getLocalFilePaths(extensionUri, ['metadata-catalog.xml']),
    [
      {
        systemId: getLocalFilePaths(extensionUri, ['salesforce_metadata_api_namespace1.xsd'])[0],
        pattern: '**/*-meta.xml'
      }
    ],
    redHatExtension
  );
});

/** Initialize metadata XML support by configuring Red Hat XML. */
export const initializeMetadataSupport = Effect.fn('metadataXmlSupport.initializeMetadataSupport')(
  function* () {
    const redHatExtension = yield* Option.match(
      Option.fromNullable(vscode.extensions.getExtension<XMLExtensionApi>('redhat.vscode-xml')),
      {
        onNone: () =>
          Effect.fail(
            new RedHatXmlSupportError({
              message: nls.localize('metadata_xml_no_redhat_extension_found')
            })
          ),
        onSome: Effect.succeed
      }
    );
    // 0.14.0 or 0.16+ are supported, 0.15.0 has a regression
    yield* Schema.decodeUnknown(ExtensionPackageJsonSchema.pipe(Schema.pick('version')))(
      redHatExtension.packageJSON
    ).pipe(
      Effect.map(({ version }) => version),
      Effect.filterOrFail(
        Schema.is(Schema.NonEmptyString),
        () =>
          new RedHatXmlSupportError({
            message: nls.localize('metadata_xml_no_redhat_extension_found')
          })
      ),
      Effect.map(version => version.split('.').map(part => parseInt(part, 10))),
      Effect.map(([major, minor]) => ({ major, minor })),
      Effect.flatMap(parsed =>
        Match.value(parsed).pipe(
          Match.when(
            ({ major: maj, minor: min }) => maj >= 1 || min === 14 || min >= 16,
            () => setupCompatibleRedhatXml(redHatExtension)
          ),
          Match.when(
            ({ minor: min }) => min === 15,
            () =>
              Effect.fail(
                new RedHatXmlSupportError({
                  message: nls.localize('metadata_xml_redhat_extension_regression')
                })
              )
          ),
          Match.orElse(() =>
            Effect.fail(
              new RedHatXmlSupportError({
                message: nls.localize('metadata_xml_deprecated_redhat_extension')
              })
            )
          )
        )
      )
    );
  },
  Effect.catchTag('RedHatXmlSupportError', reportCaughtMessage)
);
