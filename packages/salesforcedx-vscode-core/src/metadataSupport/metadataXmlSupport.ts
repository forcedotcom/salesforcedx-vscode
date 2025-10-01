/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';

type XMLExtensionApi = {
  addXMLCatalogs: (catalogs: string[]) => void;
  addXMLFileAssociations: (fileAssociations: { systemId: string; pattern: string }[]) => void;
};

/**
 * Provides XML schema support for Salesforce metadata files using RedHat XML extension
 */
export class MetadataXmlSupport {
  private static instance: MetadataXmlSupport;

  public static getInstance(): MetadataXmlSupport {
    if (!MetadataXmlSupport.instance) {
      MetadataXmlSupport.instance = new MetadataXmlSupport();
    }
    return MetadataXmlSupport.instance;
  }

  private getLocalFilePath(targetFileNames: string[], extensionContext: vscode.ExtensionContext): string[] {
    const listOfPaths: string[] = [];
    targetFileNames.forEach(targetFileName => {
      listOfPaths.push(extensionContext.asAbsolutePath(path.join('resources', targetFileName)));
    });
    return listOfPaths;
  }

  /**
   * Setup RedHat XML extension with metadata schema support
   * @param inputCatalogs - list of catalog file paths
   * @param inputFileAssociations - list of file associations
   */
  private async setupRedhatXml(
    inputCatalogs: Parameters<XMLExtensionApi['addXMLCatalogs']>[0],
    inputFileAssociations: Parameters<XMLExtensionApi['addXMLFileAssociations']>[0]
  ): Promise<void> {
    const redHatExtension = vscode.extensions.getExtension<XMLExtensionApi>('redhat.vscode-xml');
    try {
      if (!redHatExtension) {
        channelService.appendLine(nls.localize('metadata_xml_no_redhat_extension_found'));
        return;
      }

      if (!redHatExtension.isActive) {
        await redHatExtension.activate();
      }
      redHatExtension.exports.addXMLCatalogs(inputCatalogs);
      redHatExtension.exports.addXMLFileAssociations(inputFileAssociations);

      // Disable RedHat XML hover to prevent duplication with our custom hover provider
      const config = vscode.workspace.getConfiguration('xml');
      await config.update('preferences.showSchemaDocumentationType', 'none', vscode.ConfigurationTarget.Workspace);

      channelService.appendLine(nls.localize('metadata_xml_redhat_extension_setup_success'));
    } catch (error) {
      channelService.appendLine(nls.localize('metadata_xml_fail_redhat_extension'));
      const errorMsg = error instanceof Error ? error.message : String(error);
      channelService.appendLine(errorMsg);
    }
  }

  /**
   * Initialize metadata XML support by configuring RedHat XML extension
   */
  public async initializeMetadataSupport(extensionContext: vscode.ExtensionContext): Promise<void> {
    const redHatExtension = vscode.extensions.getExtension('redhat.vscode-xml');

    if (!redHatExtension) {
      channelService.appendLine(nls.localize('metadata_xml_no_redhat_extension_found'));
      return;
    }

    const pluginVersionNumber = redHatExtension.packageJSON['version'];

    if (typeof pluginVersionNumber !== 'string') {
      channelService.appendLine(nls.localize('metadata_xml_no_redhat_extension_found'));
      return;
    }

    // Check if the installed plugin version is compatible
    // 0.14.0 or 0.16+ are supported, 0.15.0 has a regression
    const [major, minor] = pluginVersionNumber.split('.').map(i => parseInt(i, 10));

    if (major >= 1 || minor === 14 || minor >= 16) {
      const catalogs = this.getLocalFilePath(['metadata-catalog.xml'], extensionContext);
      const fileAssociations = [
        {
          systemId: this.getLocalFilePath(['salesforce_metadata_api_clean.xsd'], extensionContext)[0],
          pattern: '**/*-meta.xml'
        }
      ];

      await this.setupRedhatXml(catalogs, fileAssociations);
    } else if (minor === 15) {
      channelService.appendLine(nls.localize('metadata_xml_redhat_extension_regression'));
    } else {
      channelService.appendLine(nls.localize('metadata_xml_deprecated_redhat_extension'));
    }
  }
}
