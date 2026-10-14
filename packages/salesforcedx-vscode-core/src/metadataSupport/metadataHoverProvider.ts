/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isNotNull, isNotUndefined } from 'effect/Predicate';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { MetadataDocumentationService } from './metadataDocumentationService';

/**
 * Check if the document is likely a Salesforce metadata file
 */
export const isMetadataFile = (
  document: vscode.TextDocument,
  documentationService: MetadataDocumentationService
): boolean => {
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

  while (isNotNull((match = xmlElementRegex.exec(documentText)))) {
    const elementName = match[2];
    // Remove namespace prefix if present
    const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;

    // Check if this is a valid Salesforce metadata type
    if (documentationService.isValidMetadataType(cleanElementName)) {
      return true;
    }
  }

  return false;
};

/**
 * Extract metadata type or field from the current line and cursor position
 */
export const extractMetadataType = (
  lineText: string,
  word: string,
  cursorPosition: number,
  documentationService: MetadataDocumentationService
): string | null => {
  // Look for XML element patterns - original logic for compatibility
  const xmlElementRegex = /<(\/?)([\w:]+)(\s|>|\/)/g;
  let match;

  while (isNotNull((match = xmlElementRegex.exec(lineText)))) {
    const [fullMatch, , elementName] = match;
    const matchStart = match.index;
    const matchEnd = match.index + fullMatch.length;

    // Check if cursor is within this element
    if (cursorPosition >= matchStart && cursorPosition <= matchEnd) {
      // Remove namespace prefix if present
      const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;

      // Check if this is a valid Salesforce metadata type
      if (documentationService.isValidMetadataType(cleanElementName)) {
        return cleanElementName;
      }
    }
  }

  // Additional check for multi-line elements (when closing > is on next line)
  const multiLineElementRegex = /<(\/?)([\w:]+)$/g;
  let multiLineMatch;

  while (isNotNull((multiLineMatch = multiLineElementRegex.exec(lineText)))) {
    const [fullMatch, , elementName] = multiLineMatch;
    const matchStart = multiLineMatch.index;
    const matchEnd = multiLineMatch.index + fullMatch.length;

    // Check if cursor is within this element
    if (cursorPosition >= matchStart && cursorPosition <= matchEnd) {
      // Remove namespace prefix if present
      const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;

      // Check if this is a valid Salesforce metadata type
      if (documentationService.isValidMetadataType(cleanElementName)) {
        return cleanElementName;
      }
    }
  }

  // Also check if the word itself is a valid metadata type
  if (documentationService.isValidMetadataType(word)) {
    return word;
  }

  return null;
};

/**
 * Replace XML comments in a line with spaces so tags inside them aren't parsed, keeping character offsets
 */
const maskComments = (line: string, inComment: boolean): { text: string; inComment: boolean } => {
  let text = '';
  let rest = line;
  let commentOpen = inComment;
  while (rest.length > 0) {
    const marker = commentOpen ? '-->' : '<!--';
    const index = rest.indexOf(marker);
    if (index === -1) {
      text += commentOpen ? ' '.repeat(rest.length) : rest;
      break;
    }
    const end = index + marker.length;
    text += commentOpen ? ' '.repeat(end) : rest.slice(0, index) + ' '.repeat(marker.length);
    rest = rest.slice(end);
    commentOpen = !commentOpen;
  }
  return { text, inComment: commentOpen };
};

/**
 * Find the parent metadata type and all intermediate layers by scanning upward from current line.
 * When `endCharacter` is given, only the part of the start line before it is parsed,
 * and null is returned if that character is inside a comment.
 */
export const findParentMetadataTypeWithLayers = (
  document: vscode.TextDocument,
  startLine: number,
  documentationService: MetadataDocumentationService,
  endCharacter?: number
): { metadataType: string; intermediateLayers: string[] } | null => {
  const elementStack: string[] = [];
  let inOpenTag = false;
  let currentTagName = '';
  let inComment = false;

  // Build a proper XML element stack by parsing the document up to the current line
  for (let i = 0; i <= startLine; i++) {
    const fullLine = document.lineAt(i).text;
    const masked = maskComments(fullLine, inComment);
    inComment = masked.inComment;
    if (i === startLine && isNotUndefined(endCharacter) && masked.text[endCharacter] !== fullLine[endCharacter]) {
      return null;
    }
    const line = i === startLine && isNotUndefined(endCharacter) ? masked.text.slice(0, endCharacter) : masked.text;

    // Handle multi-line opening tags
    if (inOpenTag) {
      // Check if this line closes the opening tag
      if (line.includes('>')) {
        inOpenTag = false;
        if (currentTagName) {
          const cleanElementName = currentTagName.includes(':') ? currentTagName.split(':')[1] : currentTagName;
          // Check if it's not a self-closing tag
          if (!line.trim().startsWith('/>')) {
            elementStack.push(cleanElementName);
          }
          currentTagName = '';
        }
        // Continue processing the rest of the line for closing tags
      } else {
        continue;
      }
    }

    // Find self-closing tags and exclude them from the stack
    const selfClosingTagRegex = /<([\w:]+)(?:\s[^>]*)?\/>/g;
    const selfClosingTags = new Set<number>();
    let match;
    while (isNotNull((match = selfClosingTagRegex.exec(line)))) {
      selfClosingTags.add(match.index);
    }

    // Find opening tags (both complete and incomplete)
    const openingTagRegex = /<([\w:]+)(?:\s[^>]*)?>/g;
    const incompleteOpeningTagRegex = /<([\w:]+)(?:\s[^>]*)?$/;

    while (isNotNull((match = openingTagRegex.exec(line)))) {
      // Skip if this is a self-closing tag
      if (!selfClosingTags.has(match.index)) {
        const elementName = match[1];
        const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;
        elementStack.push(cleanElementName);
      }
    }

    // Check for incomplete opening tags (multi-line)
    const incompleteMatch = incompleteOpeningTagRegex.exec(line);
    if (incompleteMatch) {
      currentTagName = incompleteMatch[1];
      inOpenTag = true;
    }

    // Find closing tags
    const closingTagRegex = /<\/([\w:]+)>/g;
    while (isNotNull((match = closingTagRegex.exec(line)))) {
      const elementName = match[1];
      const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;
      // Remove the matching opening tag from the stack
      const index = elementStack.lastIndexOf(cleanElementName);
      if (index !== -1) {
        elementStack.splice(index, 1);
      }
    }
  }

  // Now find the metadata type and collect intermediate layers
  // The elementStack now contains all currently open elements from root to the current position
  for (let i = 0; i < elementStack.length; i++) {
    const elementName = elementStack[i];

    // Check if this is a valid Salesforce metadata type
    if (documentationService.isValidMetadataType(elementName)) {
      // Found the metadata type - all elements between it and the current position are intermediate layers
      return { metadataType: elementName, intermediateLayers: elementStack.slice(i + 1) };
    }
  }

  return null;
};

/**
 * Build field info for the element whose tag starts at `tagStart` on `line`
 */
const fieldInfoForTag = (
  document: vscode.TextDocument,
  line: number,
  tagStart: number,
  elementName: string,
  isClosingTag: boolean,
  documentationService: MetadataDocumentationService
): { metadataType: string; fieldName: string; intermediateLayers: string[] } | null => {
  // Parse only up to the hovered tag so the hovered element itself isn't an intermediate layer
  const parentInfo = findParentMetadataTypeWithLayers(document, line, documentationService, tagStart);
  if (!parentInfo) {
    return null;
  }

  // A closing tag's element is still open before the tag, so drop it
  const { intermediateLayers } = parentInfo;
  return {
    metadataType: parentInfo.metadataType,
    fieldName: elementName,
    intermediateLayers:
      isClosingTag && intermediateLayers.at(-1) === elementName ? intermediateLayers.slice(0, -1) : intermediateLayers
  };
};

/**
 * Extract field information for internal tags within metadata
 */
export const extractFieldInfo = (
  document: vscode.TextDocument,
  position: vscode.Position,
  documentationService: MetadataDocumentationService
): { metadataType: string; fieldName: string; intermediateLayers: string[] } | null => {
  const line = document.lineAt(position.line);
  const wordRange = document.getWordRangeAtPosition(position);

  if (!wordRange) {
    return null;
  }

  // Look for XML element patterns for fields (lowercase or camelCase) - original logic
  const xmlElementRegex = /<(\/?)([\w:]+)(\s|>|\/)/g;
  let match;

  while (isNotNull((match = xmlElementRegex.exec(line.text)))) {
    const [fullMatch, closingSlash, elementName] = match;
    const matchStart = match.index;
    const matchEnd = match.index + fullMatch.length;

    // Check if cursor is within this element
    if (position.character >= matchStart && position.character <= matchEnd) {
      // Remove namespace prefix if present
      const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;

      // Check if this looks like a field (not a metadata type)
      if (!/^[A-Z]/.test(cleanElementName) && cleanElementName.length > 1) {
        const fieldInfo = fieldInfoForTag(
          document,
          position.line,
          matchStart,
          cleanElementName,
          closingSlash === '/',
          documentationService
        );
        if (fieldInfo) {
          return fieldInfo;
        }
      }
    }
  }

  // Additional check for multi-line field elements (when closing > is on next line)
  const multiLineElementRegex = /<(\/?)([\w:]+)$/g;
  let multiLineMatch;

  while (isNotNull((multiLineMatch = multiLineElementRegex.exec(line.text)))) {
    const [fullMatch, closingSlash, elementName] = multiLineMatch;
    const matchStart = multiLineMatch.index;
    const matchEnd = multiLineMatch.index + fullMatch.length;

    // Check if cursor is within this element
    if (position.character >= matchStart && position.character <= matchEnd) {
      // Remove namespace prefix if present
      const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;

      // Check if this looks like a field (not a metadata type)
      if (!/^[A-Z]/.test(cleanElementName) && cleanElementName.length > 1) {
        const fieldInfo = fieldInfoForTag(
          document,
          position.line,
          matchStart,
          cleanElementName,
          closingSlash === '/',
          documentationService
        );
        if (fieldInfo) {
          return fieldInfo;
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
    if (!isMetadataFile(document, this.documentationService)) {
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
    const metadataType = extractMetadataType(lineText, word, position.character, this.documentationService);
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
    const fieldInfo = extractFieldInfo(document, position, this.documentationService);
    if (fieldInfo) {
      const result = this.documentationService.getFieldDocumentation(
        fieldInfo.metadataType,
        fieldInfo.fieldName,
        fieldInfo.intermediateLayers
      );

      const markdownContent = new vscode.MarkdownString();
      // Build the full path including all intermediate layers
      const fullPath = [fieldInfo.metadataType, ...fieldInfo.intermediateLayers, fieldInfo.fieldName].join('.');
      markdownContent.appendCodeblock(fullPath, 'xml');

      if (result._tag !== 'Found') {
        markdownContent.appendMarkdown(
          result._tag === 'UnknownField'
            ? `⚠️ ${nls.localize('metadata_xml_hover_unknown_field_message', `\`${result.fieldName}\``, `**${result.typeName}**`)}`
            : `⚠️ ${nls.localize('metadata_xml_hover_primitive_parent_message', `\`${result.parentName}\``, `\`${result.parentType}\``, `\`${result.childName}\``)}`
        );
        if (result.developerGuideUrl) {
          markdownContent.appendMarkdown(
            `\n\n[📖 ${nls.localize('metadata_xml_hover_view_type_in_developer_guide_text', result.typeName)}](${result.developerGuideUrl})`
          );
        }
        return new vscode.Hover(markdownContent, wordRange);
      }

      const fieldDocumentation = result.field;
      markdownContent.appendMarkdown(fieldDocumentation.description);

      if (fieldDocumentation.type) {
        markdownContent.appendMarkdown(`\n\n**Type:** \`${fieldDocumentation.type}\``);
      }

      if (isNotUndefined(fieldDocumentation.required)) {
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

    return null;
  }
}
