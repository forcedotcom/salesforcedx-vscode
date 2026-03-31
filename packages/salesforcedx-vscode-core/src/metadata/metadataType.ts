/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export interface MetadataType {
  name: string;
  suffix: string;
  directory: string;
  inFolder?: boolean;
  perMetaTypeFolder?: boolean;
}

export const metadataTypes: { [key: string]: MetadataType } = {
  ApexClass: {
    name: 'ApexClass',
    suffix: 'cls',
    directory: 'classes'
  },
  ApexComponent: {
    name: 'ApexComponent',
    suffix: 'component',
    directory: 'components'
  },
  ApexPage: {
    name: 'ApexPage',
    suffix: 'page',
    directory: 'pages'
  },
  ApexTrigger: {
    name: 'ApexTrigger',
    suffix: 'trigger',
    directory: 'triggers'
  },
  AuraDefinitionBundle: {
    name: 'AuraDefinitionBundle',
    suffix: 'aurabundle',
    directory: 'aura'
  },
  Bot: {
    name: 'Bot',
    suffix: 'bot',
    directory: 'bots'
  },
  BotVersion: {
    name: 'BotVersion',
    suffix: 'botVersion',
    directory: 'botVersions'
  },
  CustomObject: {
    name: 'CustomObject',
    suffix: 'object',
    directory: 'objects'
  },
  CustomField: {
    name: 'CustomField',
    suffix: 'field',
    directory: 'fields'
  },
  LightningComponentBundle: {
    name: 'LightningComponentBundle',
    suffix: 'js',
    directory: 'lwc'
  },
  StaticResource: {
    name: 'StaticResource',
    suffix: 'resource',
    directory: 'staticresources'
  },
  Workflow: {
    name: 'Workflow',
    suffix: 'workflow',
    directory: 'workflows'
  }
};

export function getMetadataType(typeName: string): MetadataType | undefined {
  return metadataTypes[typeName];
}

export function getMetadataTypeBySuffix(suffix: string): MetadataType | undefined {
  return Object.values(metadataTypes).find(type => type.suffix === suffix);
}
