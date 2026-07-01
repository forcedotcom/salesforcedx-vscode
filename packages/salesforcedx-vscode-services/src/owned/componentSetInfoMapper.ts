/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ComponentInfo, ComponentSetInfo } from './components';
import type { ComponentSet, SourceComponent } from '@salesforce/source-deploy-retrieve';

/**
 * Maps a ComponentSet to owned ComponentSetInfo data structure.
 * Reads SDR ComponentSet fields and converts to services-owned types with no external dependencies.
 */
export const toComponentSetInfo = async (componentSet: ComponentSet): Promise<ComponentSetInfo> => {
  const sourceComponents = Array.from(componentSet.getSourceComponents());
  const components: ComponentInfo[] = sourceComponents.map(toComponentInfo);
  const packageXml = await componentSet.getPackageXml();

  return {
    size: componentSet.size,
    sourceApiVersion: componentSet.sourceApiVersion,
    projectDirectory: componentSet.projectDirectory,
    components,
    packageXml
  };
};

/**
 * Maps a SourceComponent to owned ComponentInfo.
 * Extracts fullName, type, xmlPath, and contentPaths from SDR SourceComponent.
 */
const toComponentInfo = (component: SourceComponent): ComponentInfo => {
  const contentPaths = component.walkContent();

  return {
    fullName: component.fullName,
    type: component.type.name,
    xmlPath: component.xml,
    contentPaths
  };
};
