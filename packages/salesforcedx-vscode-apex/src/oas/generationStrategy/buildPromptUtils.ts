/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as ejs from 'ejs';
import * as fs from 'fs';
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
    const method = lines.slice(startLine - 1, endLine + 1).join('\n');
    return method;
  } else {
    throw new Error(nls.localize('method_not_found_in_doc_symbols', methodName));
  }
};

export const getAnnotationsWithParameters = (annotations: ApexAnnotationDetail[]): string => {
  const annotationsStr =
    annotations
      .map(annotation => {
        const paramsEntries = Object.entries(annotation.parameters);
        const paramsAsStr =
          paramsEntries.length > 0
            ? paramsEntries.map(([key, value]) => `${key}: ${value}`).join(', ') + '\n'
            : undefined;
        return paramsAsStr
          ? `Annotation name: ${annotation.name} , Parameters: ${paramsAsStr}`
          : `Annotation name: ${annotation.name}`;
      })
      .join(', ') + '\n';
  return annotationsStr;
};

export const buildClassPrompt = (classDetail: ApexOASClassDetail): string => {
  let prompt = '';
  prompt += `The class name of the given method is ${classDetail.name}.\n`;
  if (classDetail.annotations.length > 0) {
    prompt += `The class is annotated with ${getAnnotationsWithParameters(classDetail.annotations)}.\n`;
  }

  if (classDetail.comment !== undefined) {
    prompt += `The documentation of the class is ${classDetail.comment.replace(/\/\*\*([\s\S]*?)\*\//g, '').trim()}.\n`;
  }

  return prompt;
};

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

export const generatePromptForMethod = (
  methodName: string,
  docText: string,
  methodsDocSymbolMap: Map<string, DocumentSymbol>,
  methodsContextMap: Map<string, ApexOASMethodDetail>,
  classPrompt: string
): string => {
  const templatePath = ejsTemplateHelpers.getTemplatePath(EjsTemplatesEnum.METHOD_BY_METHOD);

  let additionalUserPrompts = '';
  const methodImplementation = getMethodImplementation(methodName, docText, methodsDocSymbolMap);
  const methodContext = methodsContextMap.get(methodName);
  additionalUserPrompts += getPromptForMethodContext(methodContext);
  try {
    const renderedTemplate = ejs.render(fs.readFileSync(templatePath.fsPath, 'utf8'), {
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
