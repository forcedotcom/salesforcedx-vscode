/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { MetadataHoverProvider } from '../../../src/metadataSupport/metadataHoverProvider';

// Mock document
const createMockDocument = (fileName: string, content: string) =>
  ({
    fileName,
    getText: jest.fn(() => content),
    getWordRangeAtPosition: jest.fn((position: vscode.Position) => {
      // Simple mock implementation
      const line = content.split('\n')[position.line];
      if (!line) return undefined;

      const start = Math.max(0, position.character - 10);
      const end = Math.min(line.length, position.character + 10);
      return new vscode.Range(position.line, start, position.line, end);
    }),
    lineAt: jest.fn((line: number) => ({
      text: content.split('\n')[line] || '',
      lineNumber: line
    }))
  }) as any;

describe('MetadataHoverProvider', () => {
  let hoverProvider: MetadataHoverProvider;

  beforeEach(() => {
    hoverProvider = new MetadataHoverProvider();
    jest.clearAllMocks();
  });

  describe('isMetadataFile', () => {
    it('should identify metadata files correctly', () => {
      const metadataDoc = createMockDocument('test-meta.xml', '<ApexClass>');
      const regularDoc = createMockDocument('test.txt', 'some text');

      // Use reflection to access private method for testing
      const isMetadataFile = (hoverProvider as any).isMetadataFile;

      expect(isMetadataFile.call(hoverProvider, metadataDoc)).toBe(true);
      expect(isMetadataFile.call(hoverProvider, regularDoc)).toBe(false);
    });

    it('should identify XML files with metadata namespace', () => {
      const xmlDoc = createMockDocument(
        'test.xml',
        '<?xml version="1.0"?><root xmlns="http://soap.sforce.com/2006/04/metadata">'
      );

      const isMetadataFile = (hoverProvider as any).isMetadataFile;
      expect(isMetadataFile.call(hoverProvider, xmlDoc)).toBe(true);
    });
  });

  describe('extractMetadataType', () => {
    it('should extract metadata type from XML element', () => {
      const extractMetadataType = (hoverProvider as any).extractMetadataType;

      const result = extractMetadataType.call(
        hoverProvider,
        '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
        'ApexClass',
        5
      );

      expect(result).toBe('ApexClass');
    });

    it('should handle namespaced elements', () => {
      const extractMetadataType = (hoverProvider as any).extractMetadataType;

      const result = extractMetadataType.call(hoverProvider, '<tns:CustomObject>', 'CustomObject', 10);

      expect(result).toBe('CustomObject');
    });

    it('should return null for non-metadata elements', () => {
      const extractMetadataType = (hoverProvider as any).extractMetadataType;

      const result = extractMetadataType.call(hoverProvider, '<div>', 'div', 2);

      expect(result).toBeNull();
    });
  });

  describe('provideHover', () => {
    it('should return null for non-metadata files', () => {
      const document = createMockDocument('test.txt', 'some text');
      const position = new vscode.Position(0, 5);

      const result = hoverProvider.provideHover(document, position, {} as any);

      expect(result).toBeNull();
    });

    it('should return null when no word at position', () => {
      const document = createMockDocument('test-meta.xml', '<ApexClass>');
      const position = new vscode.Position(0, 100); // Position beyond text

      // Mock getWordRangeAtPosition to return undefined
      document.getWordRangeAtPosition.mockReturnValue(undefined);

      const result = hoverProvider.provideHover(document, position, {} as any);

      expect(result).toBeNull();
    });
  });
});
