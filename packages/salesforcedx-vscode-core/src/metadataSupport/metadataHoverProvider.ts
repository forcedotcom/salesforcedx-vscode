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
   * Provide hover information for metadata types
   */
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
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

    // Check if we're hovering over a metadata type element
    const metadataType = this.extractMetadataType(lineText, word, position.character);
    if (!metadataType) {
      return null;
    }

    const documentation = this.documentationService.getDocumentation(metadataType);
    if (!documentation) {
      return null;
    }

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
   * Extract metadata type from the current line and cursor position
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
}
