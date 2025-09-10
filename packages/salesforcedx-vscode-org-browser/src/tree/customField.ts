/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { ExtensionProviderService, ExtensionProviderServiceLive } from '../services/extensionProvider';
import { getFilePaths } from './filePresence';
import { OrgBrowserTreeItem } from './orgBrowserNode';
import { CustomObjectField, MetadataListResultItem } from './types';

export const createCustomFieldNode =
  (element: OrgBrowserTreeItem) =>
  (f: CustomObjectField): Effect.Effect<OrgBrowserTreeItem, Error, never> =>
    ExtensionProviderService.pipe(
      Effect.flatMap(svc => svc.getServicesApi),
      Effect.flatMap(api => {
        const allLayers = Layer.mergeAll(
          api.services.MetadataRetrieveServiceLive,
          api.services.MetadataRegistryServiceLive,
          api.services.WorkspaceServiceLive,
          api.services.ProjectServiceLive,
          api.services.SdkLayer
        );

        return Effect.gen(function* () {
          // Create a MetadataListResultItem-like object for the custom field
          const fieldMetadata: MetadataListResultItem = {
            fullName: `${element.componentName}.${removeNamespacePrefix(element)(f).name}`,
            type: 'CustomField'
          };

          const filePaths = yield* getFilePaths(fieldMetadata);

          return new OrgBrowserTreeItem({
            kind: 'component',
            xmlName: 'CustomField',
            componentName: `${element.componentName}.${f.name}`,
            label: getFieldLabel(removeNamespacePrefix(element)(f)),
            filePresent: filePaths.length > 0
          });
        }).pipe(
          Effect.withSpan('createCustomFieldNode', {
            attributes: { xmlName: 'CustomField', componentName: `${element.componentName}.${f.name}` }
          }),
          Effect.provide(allLayers)
        );
      }),
      Effect.provide(ExtensionProviderServiceLive)
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

const removeNamespacePrefix =
  (element: OrgBrowserTreeItem) =>
  (f: CustomObjectField): CustomObjectField =>
    element.namespace ? { ...f, name: f.name.replace(`${element.namespace}__`, '') } : f;
