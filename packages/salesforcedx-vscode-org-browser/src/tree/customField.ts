/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataTypeTreeProvider } from './metadataTypeTreeProvider';
import * as Effect from 'effect/Effect';
import * as Queue from 'effect/Queue';
import { AllServicesLayer } from '../services/extensionProvider';
import { backgroundFilePresenceCheckQueue } from './filePresence';
import { OrgBrowserTreeItem } from './orgBrowserNode';
import { CustomObjectField, MetadataListResultItem } from './types';

export const createCustomFieldNode =
  (treeProvider: MetadataTypeTreeProvider) =>
  (element: OrgBrowserTreeItem) =>
  (f: CustomObjectField): Effect.Effect<OrgBrowserTreeItem, Error, never> =>
    Effect.gen(function* () {
      // Create a MetadataListResultItem-like object for the custom field
      const fieldMetadata: MetadataListResultItem = {
        fullName: `${element.componentName}.${removeNamespacePrefix(element)(f).name}`,
        type: 'CustomField'
      };

      const treeItem = new OrgBrowserTreeItem({
        kind: 'component',
        xmlName: 'CustomField',
        componentName: `${element.componentName}.${f.name}`,
        label: getFieldLabel(removeNamespacePrefix(element)(f))
      });
      yield* Queue.offer(backgroundFilePresenceCheckQueue, {
        treeItem,
        c: fieldMetadata,
        treeProvider,
        parent: element,
        originalSpan: yield* Effect.currentSpan
      });
      return treeItem;
    }).pipe(
      Effect.withSpan('createCustomFieldNode', {
        attributes: { xmlName: 'CustomField', componentName: `${element.componentName}.${f.name}` }
      }),
      Effect.provide(AllServicesLayer)
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
