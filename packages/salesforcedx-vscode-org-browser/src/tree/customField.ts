/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { MetadataRegistryService } from 'salesforcedx-vscode-services/src/core/metadataRegistryService';
import { MetadataRetrieveService } from 'salesforcedx-vscode-services/src/core/metadataRetrieveService';
import { SdkLayer } from 'salesforcedx-vscode-services/src/observability/spans';
import type { WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import { fileIsPresent, getFileGlob } from './filePresence';
import { OrgBrowserTreeItem } from './orgBrowserNode';
import { CustomObjectField, MetadataListResultItem } from './types';

export const createCustomFieldNode =
  (element: OrgBrowserTreeItem) =>
  (
    f: CustomObjectField
  ): Effect.Effect<OrgBrowserTreeItem, Error, MetadataRetrieveService | MetadataRegistryService | WorkspaceService> =>
    Effect.gen(function* () {
      // Create a MetadataListResultItem-like object for the custom field
      const fieldMetadata: MetadataListResultItem = {
        fullName: `${element.componentName}.${f.name}`,
        type: 'CustomField'
      };

      // special filter to keep from returning true when the parent object is found but the field is not
      const globs = (yield* getFileGlob('CustomField')(fieldMetadata)).filter(g => g.endsWith('field-meta.xml'));
      // TODO: find a way to short-circuit this so the first "true" the returns is all we need
      const isPresent = (yield* Effect.all(
        globs.map(glob => fileIsPresent(glob)),
        { concurrency: 'unbounded' }
      )).some(a => a);

      return new OrgBrowserTreeItem({
        kind: 'component',
        xmlName: 'CustomField',
        componentName: `${element.componentName}.${f.name}`,
        label: getFieldLabel(f),
        filePresent: isPresent
      });
    }).pipe(
      Effect.withSpan('createCustomFieldNode', {
        attributes: { xmlName: 'CustomField', componentName: `${element.componentName}.${f.name}` }
      }),
      Effect.provide(SdkLayer)
    );

/** build out the label for a CustomField */
const getFieldLabel = (f: CustomObjectField): string => {
  switch (f.type) {
    case 'string':
    case 'textarea':
    case 'email':
      return `${f.name} | ${f.type} | length: ${f.length?.toLocaleString()}`;
    case 'reference':
      return `${f.relationshipName} | reference`;
    case 'double':
    case 'currency':
    case 'percent':
      return `${f.name} | ${f.type} | scale: ${f.scale} | precision: ${f.precision}`;
    default:
      return `${f.name} | ${f.type}`;
  }
};
