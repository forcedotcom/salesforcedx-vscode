/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { VALID_METADATA_TYPES } from '../constants';
import { MetadataDocumentationService } from './metadataDocumentationService';

/**
 * Check if the document is likely a Salesforce metadata file
 */
export const isMetadataFile = (document: vscode.TextDocument): boolean => {
  // Since we're now registered for all XML files, check if this is a Salesforce metadata file
  // by looking for the Salesforce metadata namespace or valid metadata types
  const documentText = document.getText();

  // Check for Salesforce metadata namespace
  if (documentText.includes('http://soap.sforce.com/2006/04/metadata')) {
    return true;
  }

  // Check for valid Salesforce metadata types
  const xmlElementRegex = /<(\/?)([\w:]+)(\s|>|\/)/g;
  let match;

  while ((match = xmlElementRegex.exec(documentText)) !== null) {
    const elementName = match[2];
    // Remove namespace prefix if present
    const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;

    // Check if this is a valid Salesforce metadata type
    if (VALID_METADATA_TYPES.has(cleanElementName)) {
      return true;
    }
  }

  return false;
};

/**
 * Extract metadata type or field from the current line and cursor position
 */
export const extractMetadataType = (lineText: string, word: string, cursorPosition: number): string | null => {
  // Look for XML element patterns - original logic for compatibility
  const xmlElementRegex = /<(\/?)([\w:]+)(\s|>|\/)/g;
  let match;

  while ((match = xmlElementRegex.exec(lineText)) !== null) {
    const [fullMatch, , elementName] = match;
    const matchStart = match.index;
    const matchEnd = match.index + fullMatch.length;

    // Check if cursor is within this element
    if (cursorPosition >= matchStart && cursorPosition <= matchEnd) {
      // Remove namespace prefix if present
      const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;

      // Check if this is a valid Salesforce metadata type
      if (VALID_METADATA_TYPES.has(cleanElementName)) {
        return cleanElementName;
      }
    }
  }

  // Additional check for multi-line elements (when closing > is on next line)
  const multiLineElementRegex = /<(\/?)([\w:]+)$/g;
  let multiLineMatch;

  while ((multiLineMatch = multiLineElementRegex.exec(lineText)) !== null) {
    const [fullMatch, , elementName] = multiLineMatch;
    const matchStart = multiLineMatch.index;
    const matchEnd = multiLineMatch.index + fullMatch.length;

    // Check if cursor is within this element
    if (cursorPosition >= matchStart && cursorPosition <= matchEnd) {
      // Remove namespace prefix if present
      const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;

      // Check if this is a valid Salesforce metadata type
      if (VALID_METADATA_TYPES.has(cleanElementName)) {
        return cleanElementName;
      }
    }
  }

  // Also check if the word itself is a valid metadata type
  if (VALID_METADATA_TYPES.has(word)) {
    return word;
  }

  return null;
};

/**
 * Find the parent metadata type by scanning upward from current line
 */
export const findParentMetadataType = (document: vscode.TextDocument, startLine: number): string | null => {
  for (let i = startLine; i >= 0; i--) {
    const line = document.lineAt(i).text;
    const xmlElementRegex = /<([\w:]+)(\s|>)/g;
    let match;

    while ((match = xmlElementRegex.exec(line)) !== null) {
      const elementName = match[1];
      const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;

      // Check if this is a valid Salesforce metadata type
      if (VALID_METADATA_TYPES.has(cleanElementName)) {
        return cleanElementName;
      }
    }

    // Also check for multi-line elements (when closing > is on next line)
    const multiLineElementRegex = /<([\w:]+)$/g;
    let multiLineMatch;

    while ((multiLineMatch = multiLineElementRegex.exec(line)) !== null) {
      const elementName = multiLineMatch[1];
      const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;

      // Check if this is a valid Salesforce metadata type
      if (VALID_METADATA_TYPES.has(cleanElementName)) {
        return cleanElementName;
      }
    }
  }

  return null;
};

/**
 * Find the parent metadata type and all intermediate layers by scanning upward from current line
 */
export const findParentMetadataTypeWithLayers = (
  document: vscode.TextDocument,
  startLine: number
): { metadataType: string; intermediateLayers: string[] } | null => {
  const intermediateLayers: string[] = [];
  const elementStack: string[] = [];
  let inOpenTag = false;
  let currentTagName = '';

  // Build a proper XML element stack by parsing the document up to the current line
  for (let i = 0; i <= startLine; i++) {
    const line = document.lineAt(i).text;

    // Handle multi-line opening tags
    if (inOpenTag) {
      // Check if this line closes the opening tag
      if (line.includes('>')) {
        inOpenTag = false;
        if (currentTagName) {
          const cleanElementName = currentTagName.includes(':') ? currentTagName.split(':')[1] : currentTagName;
          elementStack.push(cleanElementName);
          currentTagName = '';
        }
      }
      continue;
    }

    // Find opening tags (both complete and incomplete)
    const openingTagRegex = /<([\w:]+)(?:\s[^>]*)?>/g;
    const incompleteOpeningTagRegex = /<([\w:]+)(?:\s[^>]*)?$/;

    let match;
    while ((match = openingTagRegex.exec(line)) !== null) {
      const elementName = match[1];
      const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;
      elementStack.push(cleanElementName);
    }

    // Check for incomplete opening tags (multi-line)
    const incompleteMatch = incompleteOpeningTagRegex.exec(line);
    if (incompleteMatch) {
      currentTagName = incompleteMatch[1];
      inOpenTag = true;
    }

    // Find closing tags
    const closingTagRegex = /<\/([\w:]+)>/g;
    while ((match = closingTagRegex.exec(line)) !== null) {
      const elementName = match[1];
      const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;
      // Remove the matching opening tag from the stack
      const index = elementStack.lastIndexOf(cleanElementName);
      if (index !== -1) {
        elementStack.splice(index, 1);
      }
    }
  }

  // Now find the metadata type and collect only the direct parent containers
  // We want to find the path from the current element to the root metadata type
  for (let i = elementStack.length - 1; i >= 0; i--) {
    const elementName = elementStack[i];

    // Check if this is a valid Salesforce metadata type
    if (VALID_METADATA_TYPES.has(elementName)) {
      return { metadataType: elementName, intermediateLayers: intermediateLayers.reverse() };
    }

    // Only add significant container elements that are direct parents
    // This helps avoid the extremely long paths by being more selective
    if (elementName.length > 1 && !/^[A-Z]/.test(elementName) && isSignificantContainer(elementName)) {
      // Only add if it's not already in the layers (avoid duplicates)
      if (!intermediateLayers.includes(elementName)) {
        intermediateLayers.push(elementName);
      }
    }
  }

  return null;
};

/**
 * Check if an element is a significant container that should be included in the path
 */
const isSignificantContainer = (elementName: string): boolean => {
  // Only include major container elements that are direct parents of fields
  // This helps avoid the extremely long paths by being very selective
  const significantContainers = new Set([
    'decisions',
    'actionCalls',
    'recordCreates',
    'recordLookups',
    'recordUpdates',
    'screens',
    'formulas',
    'processMetadataValues',
    'inputParameters',
    'inputAssignments',
    'filters',
    'rules',
    'conditions',
    'fields',
    'value'
  ]);

  return significantContainers.has(elementName);
};

/**
 * Extract field information for internal tags within metadata
 */
export const extractFieldInfo = (
  document: vscode.TextDocument,
  position: vscode.Position
): { metadataType: string; fieldName: string; intermediateLayers: string[] } | null => {
  const line = document.lineAt(position.line);
  const wordRange = document.getWordRangeAtPosition(position);

  if (!wordRange) {
    return null;
  }

  // Look for XML element patterns for fields (lowercase or camelCase) - original logic
  const xmlElementRegex = /<(\/?)([\w:]+)(\s|>|\/)/g;
  let match;

  while ((match = xmlElementRegex.exec(line.text)) !== null) {
    const [fullMatch, , elementName] = match;
    const matchStart = match.index;
    const matchEnd = match.index + fullMatch.length;

    // Check if cursor is within this element
    if (position.character >= matchStart && position.character <= matchEnd) {
      // Remove namespace prefix if present
      const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;

      // Check if this looks like a field (not a metadata type)
      if (!/^[A-Z]/.test(cleanElementName) && cleanElementName.length > 1) {
        // Find the parent metadata type and all intermediate layers by scanning upward
        const parentInfo = findParentMetadataTypeWithLayers(document, position.line);
        if (parentInfo) {
          return {
            metadataType: parentInfo.metadataType,
            fieldName: cleanElementName,
            intermediateLayers: parentInfo.intermediateLayers
          };
        }
      }
    }
  }

  // Additional check for multi-line field elements (when closing > is on next line)
  const multiLineElementRegex = /<(\/?)([\w:]+)$/g;
  let multiLineMatch;

  while ((multiLineMatch = multiLineElementRegex.exec(line.text)) !== null) {
    const [fullMatch, , elementName] = multiLineMatch;
    const matchStart = multiLineMatch.index;
    const matchEnd = multiLineMatch.index + fullMatch.length;

    // Check if cursor is within this element
    if (position.character >= matchStart && position.character <= matchEnd) {
      // Remove namespace prefix if present
      const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;

      // Check if this looks like a field (not a metadata type)
      if (!/^[A-Z]/.test(cleanElementName) && cleanElementName.length > 1) {
        // Find the parent metadata type and all intermediate layers by scanning upward
        const parentInfo = findParentMetadataTypeWithLayers(document, position.line);
        if (parentInfo) {
          return {
            metadataType: parentInfo.metadataType,
            fieldName: cleanElementName,
            intermediateLayers: parentInfo.intermediateLayers
          };
        }
      }
    }
  }

  return null;
};

/**
 * Provides hover documentation for Salesforce metadata types in XML files
 */
export class MetadataHoverProvider implements vscode.HoverProvider {
  private documentationService: MetadataDocumentationService;

  constructor() {
    this.documentationService = new MetadataDocumentationService();
  }

  /**
   * Initialize the hover provider by loading metadata documentation
   */
  public async initialize(): Promise<void> {
    await this.documentationService.initialize();
  }

  /**
   * Provide hover information for metadata types and their internal fields
   * Note that the custom implementation is intentional to workaround the RedHat XML extension's ugly formatting
   */
  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    // Only provide hover for XML files that are likely metadata files
    if (!isMetadataFile(document)) {
      return null;
    }

    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return null;
    }

    const word = document.getText(wordRange);
    const line = document.lineAt(position.line);
    const lineText = line.text;

    // First, try to get metadata type documentation
    const metadataType = extractMetadataType(lineText, word, position.character);
    if (metadataType) {
      const documentation = this.documentationService.getDocumentation(metadataType);
      if (documentation) {
        const markdownContent = new vscode.MarkdownString();
        markdownContent.appendCodeblock(metadataType, 'xml');
        markdownContent.appendMarkdown(documentation.description);

        if (documentation.developerGuideUrls && documentation.developerGuideUrls.length > 0) {
          if (documentation.developerGuideUrls.length === 1) {
            markdownContent.appendMarkdown(`\n\n[📖 View in Developer Guide](${documentation.developerGuideUrls[0]})`);
          } else {
            markdownContent.appendMarkdown('\n\n**Documentation Links (best guess first):**');
            documentation.developerGuideUrls.forEach((url, index) => {
              markdownContent.appendMarkdown(`\n- [Option ${index + 1}](${url})`);
            });
          }
        }

        return new vscode.Hover(markdownContent, wordRange);
      }
    }

    // If not a metadata type, try to get field documentation
    const fieldInfo = extractFieldInfo(document, position);
    if (fieldInfo) {
      const fieldDocumentation = this.documentationService.getFieldDocumentation(
        fieldInfo.metadataType,
        fieldInfo.fieldName
      );

      if (fieldDocumentation) {
        const markdownContent = new vscode.MarkdownString();
        // Build the full path including all intermediate layers
        const fullPath = [fieldInfo.metadataType, ...fieldInfo.intermediateLayers, fieldInfo.fieldName].join('.');
        markdownContent.appendCodeblock(fullPath, 'xml');
        markdownContent.appendMarkdown(fieldDocumentation.description);

        if (fieldDocumentation.type) {
          markdownContent.appendMarkdown(`\n\n**Type:** \`${fieldDocumentation.type}\``);
        }

        if (fieldDocumentation.required !== undefined) {
          markdownContent.appendMarkdown(`\n**Required:** ${fieldDocumentation.required ? 'Yes' : 'No'}`);
        }

        if (fieldDocumentation.validValues && fieldDocumentation.validValues.length > 0) {
          markdownContent.appendMarkdown('\n\n**Valid Values:**\n');
          fieldDocumentation.validValues.forEach(value => {
            markdownContent.appendMarkdown(`- \`${value}\`\n`);
          });
        }

        return new vscode.Hover(markdownContent, wordRange);
      }
    }

    return null;
  }
}
