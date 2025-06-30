/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFile } from '@salesforce/salesforcedx-utils-vscode';
import * as ejs from 'ejs';
import { DocumentSymbol } from 'vscode';
import { nls } from '../../messages';
import { ejsTemplateHelpers, EjsTemplatesEnum } from '../../oasUtils';
import { ApexAnnotationDetail, ApexOASClassDetail, ApexOASMethodDetail } from '../schemas';

export const getMethodImplementation = (
  methodName: string,
  doc: string,
  methodsDocSymbolMap: Map<string, DocumentSymbol>
): string => {
  const methodSymbol = methodsDocSymbolMap.get(methodName);
  if (methodSymbol) {
    const startLine = methodSymbol.range.start.line;
    const endLine = methodSymbol.range.end.line;
    const lines = doc.split('\n').map(line => line.trim());
    return lines.slice(startLine - 1, endLine + 1).join('\n');
  } else {
    throw new Error(nls.localize('method_not_found_in_doc_symbols', methodName));
  }
};

export const getAnnotationsWithParameters = (annotations: ApexAnnotationDetail[]): string =>
  annotations
    .map(annotation => {
      const paramsEntries = Object.entries(annotation.parameters);
      const paramsAsStr =
        paramsEntries.length > 0 ? paramsEntries.map(([key, value]) => `${key}: ${value}`).join(', ') : undefined;
      return paramsAsStr
        ? `Annotation name: ${annotation.name} , Parameters: ${paramsAsStr}`
        : `Annotation name: ${annotation.name}.`;
    })
    .join('\n, ');

export const buildClassPrompt = (classDetail: ApexOASClassDetail): string =>
  [
    `The class name of the given method is ${classDetail.name}.`,
    ...(classDetail.annotations.length > 0
      ? [`The class is annotated with ${getAnnotationsWithParameters(classDetail.annotations)}`]
      : []),
    ...(classDetail.comment !== undefined
      ? [
          `The documentation of the class is ${classDetail.comment
            .replace(/\/\*\*|\*\//g, '') // remove opening and closing comment markers
            .split('\n')
            .map(line => line.trim().replace(/^\* ?/, '')) // remove leading '*'
            .filter(line => line.length > 0)
            .join(' ')}.`
        ]
      : []),
    '' // for an extra newline at the end
  ].join('\n');

export const getPromptForMethodContext = (methodContext: ApexOASMethodDetail | undefined): string => {
  if (!methodContext) return '';
  let methodContextPrompt = '';
  methodContext.annotations.forEach(annotation => {
    switch (annotation.name) {
      case 'HttpGet':
        methodContextPrompt += 'For the given method only produce the GET verb.\n';
        break;
      case 'HttpPatch':
        methodContextPrompt += 'For the given method only produce the PATCH verb.\n';
        break;
      case 'HttpPost':
        methodContextPrompt += 'For the given method only produce the POST verb.\n';
        break;
      case 'HttpPut':
        methodContextPrompt += 'For the given method only produce the PUT verb.\n';
        break;
      case 'HttpDelete':
        methodContextPrompt += 'For the given method only produce the DELETE verb.\n';
        break;
    }
  });
  return methodContextPrompt;
};

export const generatePromptForMethod = async (
  methodName: string,
  docText: string,
  methodsDocSymbolMap: Map<string, DocumentSymbol>,
  methodsContextMap: Map<string, ApexOASMethodDetail>,
  classPrompt: string
): Promise<string> => {
  const templatePath = await ejsTemplateHelpers.getTemplatePath(EjsTemplatesEnum.METHOD_BY_METHOD);

  const methodImplementation = getMethodImplementation(methodName, docText, methodsDocSymbolMap);
  const methodContext = methodsContextMap.get(methodName);
  const additionalUserPrompts = getPromptForMethodContext(methodContext);
  try {
    const templateContent = await readFile(templatePath.fsPath);
    const renderedTemplate = ejs.render(templateContent, {
      classPrompt,
      methodImplementation,
      additionalUserPrompts
    });

    return renderedTemplate;
  } catch (e) {
    console.error(e);
    throw e;
  }
};
