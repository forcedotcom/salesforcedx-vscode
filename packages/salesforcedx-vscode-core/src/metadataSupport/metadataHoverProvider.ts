/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { MetadataDocumentationService } from './metadataDocumentationService';

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
   */
  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    // Only provide hover for XML files that are likely metadata files
    if (!this.isMetadataFile(document)) {
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
    const metadataType = this.extractMetadataType(lineText, word, position.character);
    if (metadataType) {
      const documentation = this.documentationService.getDocumentation(metadataType);
      if (documentation) {
        const markdownContent = new vscode.MarkdownString();
        markdownContent.appendCodeblock(metadataType, 'xml');
        markdownContent.appendMarkdown(documentation.description);

        if (documentation.fields && documentation.fields.length > 0) {
          markdownContent.appendMarkdown('\n\n**Key Fields:**\n');
          documentation.fields.slice(0, 5).forEach(field => {
            markdownContent.appendMarkdown(`- \`${field.name}\`: ${field.description}\n`);
          });
          if (documentation.fields.length > 5) {
            markdownContent.appendMarkdown(`- *... and ${documentation.fields.length - 5} more fields*\n`);
          }
        }

        if (documentation.developerGuideUrl) {
          markdownContent.appendMarkdown(`\n\n[📖 View in Developer Guide](${documentation.developerGuideUrl})`);
        }

        return new vscode.Hover(markdownContent, wordRange);
      }
    }

    // If not a metadata type, try to get field documentation
    const fieldInfo = this.extractFieldInfo(document, position);
    if (fieldInfo) {
      const fieldDocumentation = await this.documentationService.getFieldDocumentation(
        fieldInfo.metadataType,
        fieldInfo.fieldName
      );

      if (fieldDocumentation) {
        const markdownContent = new vscode.MarkdownString();
        markdownContent.appendCodeblock(`${fieldInfo.metadataType}.${fieldInfo.fieldName}`, 'xml');
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

  /**
   * Check if the document is likely a metadata file
   */
  private isMetadataFile(document: vscode.TextDocument): boolean {
    const fileName = path.basename(document.fileName);
    const fileExtension = path.extname(fileName);

    // Check for common metadata file patterns
    return (
      fileExtension === '.xml' &&
      (fileName.endsWith('-meta.xml') ||
        fileName.includes('.object') ||
        fileName.includes('.flow') ||
        fileName.includes('.layout') ||
        fileName.includes('.profile') ||
        fileName.includes('.permissionset') ||
        fileName.includes('.app') ||
        fileName.includes('.tab') ||
        fileName.includes('.trigger') ||
        fileName.includes('.cls') ||
        fileName.includes('.component') ||
        fileName.includes('.page') ||
        fileName.includes('.email') ||
        fileName.includes('.report') ||
        fileName.includes('.dashboard') ||
        fileName.includes('.resource') ||
        fileName.includes('.workflow') ||
        fileName.includes('.validationRule') ||
        fileName.includes('.customField') ||
        document.getText().includes('http://soap.sforce.com/2006/04/metadata'))
    );
  }

  /**
   * Extract metadata type or field from the current line and cursor position
   */
  private extractMetadataType(lineText: string, word: string, cursorPosition: number): string | null {
    // Look for XML element patterns
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

        // Check if this looks like a metadata type (starts with capital letter)
        if (/^[A-Z]/.test(cleanElementName)) {
          return cleanElementName;
        }
      }
    }

    // Also check if the word itself is a metadata type
    if (/^[A-Z]/.test(word) && word.length > 2) {
      return word;
    }

    return null;
  }

  /**
   * Extract field information for internal tags within metadata
   */
  private extractFieldInfo(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { metadataType: string; fieldName: string } | null {
    const line = document.lineAt(position.line);
    const wordRange = document.getWordRangeAtPosition(position);

    if (!wordRange) {
      return null;
    }

    // Look for XML element patterns for fields (lowercase or camelCase)
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
          // Find the parent metadata type by scanning upward
          const parentType = this.findParentMetadataType(document, position.line);
          if (parentType) {
            return { metadataType: parentType, fieldName: cleanElementName };
          }
        }
      }
    }

    return null;
  }

  /**
   * Find the parent metadata type by scanning upward from current line
   */
  private findParentMetadataType(document: vscode.TextDocument, startLine: number): string | null {
    for (let i = startLine; i >= 0; i--) {
      const line = document.lineAt(i).text;
      const xmlElementRegex = /<([\w:]+)(\s|>)/g;
      let match;

      while ((match = xmlElementRegex.exec(line)) !== null) {
        const elementName = match[1];
        const cleanElementName = elementName.includes(':') ? elementName.split(':')[1] : elementName;

        // Check if this looks like a metadata type (starts with capital letter)
        if (/^[A-Z]/.test(cleanElementName)) {
          return cleanElementName;
        }
      }
    }

    return null;
  }
}
