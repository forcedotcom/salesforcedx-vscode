/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MessageKey } from '../messages/i18n';
import { ExtensionContextServiceLayer, ICONS, type IconId, type OrgId } from '@salesforce/vscode-services/v2';
import * as Layer from 'effect/Layer';
import type { ExtensionContext } from 'vscode';
import { nls } from '../messages';
import { ConnectionHost } from './connectionHost.js';
import { MediaDescriptions } from './mediaDescriptions.js';
import { MetadataOperationMessages } from './metadataOperationMessages.js';
import { OrgCatalogMessages } from './orgCatalog/orgCatalogMessages.js';
import { PromptMessages } from './promptMessages.js';
import { TemplateMessages } from './templateMessages.js';

/** Per-activation host state and localization; the services graph does not import another Effect major. */
export const makeActivationHostLayers = (context: ExtensionContext) => {
  const extensionContext = ExtensionContextServiceLayer(context);
  const connectionHost = Layer.succeed(
    ConnectionHost,
    ConnectionHost.of({
      globalState: context.globalState,
      messages: {
        expired: nls.localize('error_access_token_expired'),
        expiredDetail: nls.localize('error_access_token_expired_detail'),
        login: nls.localize('error_access_token_expired_login_button'),
        refreshFailed: nls.localize('error_access_token_refresh_failed'),
        orgChanged: (orgId: OrgId) => nls.localize('org_operation_target_changed', orgId)
      }
    })
  );
  const operationMessages = Layer.succeed(
    MetadataOperationMessages,
    MetadataOperationMessages.of({
      deploying: count => nls.localize(count === 1 ? 'deploying_one_component' : 'deploying_n_components', count),
      deleting: count => nls.localize(count === 1 ? 'deleting_one_component' : 'deleting_n_components', count)
    })
  );
  const catalogMessages = Layer.succeed(
    OrgCatalogMessages,
    OrgCatalogMessages.of({
      workspaceMissingContent: (type, metaXml, content) =>
        nls.localize('org_metadata_catalog_workspace_presence_missing_content', type, metaXml, content),
      workspaceScanFailed: (type, description) =>
        nls.localize('org_metadata_catalog_workspace_presence_scan_failed', type, description)
    })
  );
  const promptMessages = Layer.succeed(
    PromptMessages,
    PromptMessages.of({
      overwriteConfirmation: path => nls.localize('metadata_overwrite_confirmation', path),
      overwriteButton: nls.localize('overwrite_button'),
      chooseDifferentFolder: nls.localize('choose_different_folder'),
      selectFolder: nls.localize('select_folder')
    })
  );
  const templateMessages = Layer.succeed(
    TemplateMessages,
    TemplateMessages.of({
      extensionUnavailable: nls.localize('template_service_extension_context_not_available'),
      manifestLoadFailed: cause => nls.localize('template_service_manifest_load_failed', cause),
      manifestParseFailed: nls.localize('template_service_manifest_parse_failed'),
      fileCopyFailed: (path, cause) => nls.localize('template_service_file_copy_failed', path, cause),
      missingSourceApiVersion: nls.localize('template_service_source_api_version_not_defined')
    })
  );
  const mediaDescriptions = Layer.succeed(MediaDescriptions, (icon: IconId) => nls.localize(iconDescriptionKeys[icon]));
  const errorHandlerMessages = {
    orgOperationSuperseded: nls.localize('org_operation_superseded'),
    viewSuggestions: nls.localize('view_suggestions')
  };
  return {
    extensionContext,
    layer: Layer.mergeAll(
      extensionContext,
      connectionHost,
      operationMessages,
      catalogMessages,
      promptMessages,
      templateMessages,
      mediaDescriptions
    ),
    errorHandlerMessages,
    orgChangedMessage: (orgId: OrgId) => nls.localize('org_operation_target_changed', orgId)
  };
};

const iconDescriptionKeys: Record<IconId, MessageKey> = {
  [ICONS.SF_DEFAULT_ORG]: 'icon_sf_default_org',
  [ICONS.SF_DEFAULT_HUB]: 'icon_sf_default_hub',
  [ICONS.ORG_TYPE_DEVHUB]: 'icon_org_type_devhub',
  [ICONS.ORG_TYPE_SANDBOX]: 'icon_org_type_sandbox',
  [ICONS.ORG_TYPE_SCRATCH]: 'icon_org_type_scratch',
  [ICONS.ORG_TYPE_ORG]: 'icon_org_type_org',
  [ICONS.ADD]: 'icon_add',
  [ICONS.BROWSER]: 'icon_browser',
  [ICONS.WARNING]: 'icon_warning'
};
