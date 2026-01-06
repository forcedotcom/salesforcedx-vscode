/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';

// TODO investigate more why this happens
const splitPath = (filePath: path.ParsedPath): string[] => {
  let pathElements = filePath.dir.split(path.sep);
  // Somehow on windows paths are occassionally using forward slash
  if (path.sep === '\\' && !filePath.dir.includes('\\')) {
    pathElements = filePath.dir.split('/');
  }
  return pathElements;
};

export const nameFromFile = (
  file: string,
  sfdxProject: boolean,
  converter: (a: string, b: string) => string
): string | null => {
  const filePath = path.parse(file);
  const fileName = filePath.name;
  const pathElements = splitPath(filePath);
  const parentDirName = pathElements.pop();
  if (fileName === parentDirName) {
    const namespace = sfdxProject ? 'c' : pathElements.pop();
    return converter(namespace ?? '', parentDirName);
  }
  return null;
};

export const nameFromDirectory = (
  file: string,
  sfdxProject: boolean,
  converter: (a: string, b: string) => string
): string => {
  const filePath = path.parse(file);
  return sfdxProject ? converter('c', filePath.name) : converter(splitPath(filePath).pop() ?? '', filePath.name);
};

const componentName = (namespace: string, tag: string): string => `${namespace}:${tag}`;

export const componentFromFile = (file: string, sfdxProject: boolean): string | null =>
  nameFromFile(file, sfdxProject, componentName);

export const componentFromDirectory = (file: string, sfdxProject: boolean): string =>
  nameFromDirectory(file, sfdxProject, componentName);
