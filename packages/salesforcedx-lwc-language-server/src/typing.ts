/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import * as xml2js from 'xml2js';

/** One `<labels>` block from CustomLabels.labels-meta.xml (xml2js shape with explicitArray: false). */
interface CustomLabelBlock {
  fullName: string;
}

interface CustomLabelsXml {
  CustomLabels?: {
    labels?: CustomLabelBlock | CustomLabelBlock[];
  };
}

const isCustomLabelsXml = (value: unknown): value is CustomLabelsXml => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('CustomLabels' in value)) {
    return true;
  }
  const cl = value.CustomLabels;
  if (typeof cl !== 'object' || cl === null) {
    return false;
  }
  if (!('labels' in cl)) {
    return true;
  }
  const labels = cl.labels;
  return typeof labels === 'object' && labels !== null;
};

const metaRegex = new RegExp(/(?<name>[\w.-]+)\.(?<type>\w.+)-meta$/);

const declaration = (type: string, name: string): string => {
  let modulePath: string;
  switch (type) {
    case 'asset':
      modulePath = `@salesforce/contentAssetUrl/${name}`;
      break;
    case 'resource':
      modulePath = `@salesforce/resourceUrl/${name}`;
      break;
    case 'messageChannel':
      modulePath = `@salesforce/messageChannel/${name}__c`;
      break;
    case 'customLabel':
      modulePath = `@salesforce/label/c.${name}`;
      break;
    default:
      throw new Error(`${type} not supported`);
  }

  return `declare module "${modulePath}" {
    var ${name}: string;
    export default ${name};
}`;
};

// Type definition for Typing data structure
export type Typing = {
  type: string;
  name: string;
  fileName: string;
};

// Allowed types constant
const ALLOWED_TYPES: string[] = ['asset', 'resource', 'messageChannel', 'customLabel'];

// Factory function to create Typing objects
export const createTyping = (attributes: { type: string; name: string }): Typing => {
  if (!ALLOWED_TYPES.includes(attributes.type)) {
    const errorMessage: string = `Cannot create a Typing with "${attributes.type}" type. Must be one of [${ALLOWED_TYPES.toString()}]`;
    throw new Error(errorMessage);
  }

  return {
    type: attributes.type,
    name: attributes.name,
    fileName: `${attributes.name}.${attributes.type}.d.ts`
  };
};

// Utility function to create Typing from meta filename
export const fromMeta = (metaFilename: string): Typing => {
  const parsedPath = path.parse(metaFilename);
  const { name, type } = metaRegex.exec(parsedPath.name)?.groups ?? { name: '', type: '' };
  return createTyping({ name, type });
};

// Utility function to generate declarations from custom labels
export const declarationsFromCustomLabels = async (xmlDocument: string | Buffer): Promise<string> => {
  const parsed: unknown = await new xml2js.Parser({ explicitArray: false }).parseStringPromise(xmlDocument);
  if (!isCustomLabelsXml(parsed) || !parsed.CustomLabels?.labels) {
    return '';
  }
  const labelsNode = parsed.CustomLabels.labels;
  return (Array.isArray(labelsNode) ? labelsNode : [labelsNode])
    .map(label => declaration('customLabel', label.fullName))
    .join('\n');
};

// Utility function to get declaration for a Typing object
export const getDeclaration = (typing: Typing): string => declaration(typing.type, typing.name);
