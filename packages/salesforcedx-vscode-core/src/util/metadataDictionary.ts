/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { PathStrategyFactory, SourcePathStrategy } from '../commands/util';

const DEFINITIONS: { [key: string]: MetadataInfo } = {
  apexclass: {
    type: 'ApexClass',
    suffix: 'cls',
    directory: 'classes',
    pathStrategy: PathStrategyFactory.createDefaultStrategy(),
    extensions: ['.cls']
  },
  apexcomponent: {
    type: 'ApexComponent',
    suffix: 'component',
    directory: 'components',
    pathStrategy: PathStrategyFactory.createDefaultStrategy(),
    extensions: ['.component']
  },
  apexpage: {
    type: 'ApexPage',
    suffix: 'page',
    directory: 'pages',
    pathStrategy: PathStrategyFactory.createDefaultStrategy(),
    extensions: ['.page']
  },
  apextrigger: {
    type: 'ApexTrigger',
    suffix: 'trigger',
    directory: 'triggers',
    pathStrategy: PathStrategyFactory.createDefaultStrategy(),
    extensions: ['.trigger']
  },
  auradefinitionbundle: {
    type: 'AuraDefinitionBundle',
    suffix: 'cmp',
    directory: 'aura',
    pathStrategy: PathStrategyFactory.createBundleStrategy(),
    extensions: ['.app', '.cmp', '.evt', '.intf']
  },
  customobject: {
    type: 'CustomObject',
    suffix: 'object',
    directory: 'objects',
    pathStrategy: PathStrategyFactory.createBundleStrategy()
  },
  experiencebundle: {
    type: 'ExperienceBundle',
    suffix: 'json',
    directory: 'experiences',
    pathStrategy: PathStrategyFactory.createBundleStrategy()
  },
  lightningcomponentbundle: {
    type: 'LightningComponentBundle',
    suffix: 'js',
    directory: 'lwc',
    pathStrategy: PathStrategyFactory.createBundleStrategy(),
    extensions: ['.js', '.html']
  },
  wavetemplatebundle: {
    type: 'WaveTemplateBundle',
    suffix: 'waveTemplate',
    directory: 'waveTemplates',
    pathStrategy: PathStrategyFactory.createWaveTemplateBundleStrategy(),
    extensions: ['']
  }
};

export class MetadataDictionary {
  public static getInfo(metadataType: string): MetadataInfo | undefined {
    return DEFINITIONS[metadataType.toLowerCase()];
  }
}

export type MetadataInfo = {
  type: string;
  suffix: string;
  directory: string;
  pathStrategy: SourcePathStrategy;
  extensions?: string[];
};
