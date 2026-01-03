#!/usr/bin/env node
/**
 * Convert metadata_types_map_scraped.json to XSD file compatible with the RedHat XML extension.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MetadataTypesMap } from './scrapeUtils';

/**
 * Remove zero-width characters that cause XSD validation errors.
 * These invisible characters are sometimes scraped from documentation pages.
 */
const removeZeroWidthCharacters = (text: string): string => {
  if (!text) return text;

  // Remove all zero-width characters:
  // U+200B: Zero Width Space
  // U+200C: Zero Width Non-Joiner
  // U+200D: Zero Width Joiner
  // U+FEFF: Zero Width No-Break Space (BOM)
  return text.replaceAll(/[\u200B-\u200D\uFEFF]/g, '');
};

/**
 * Clean a name to be valid for XSD element names.
 */
const cleanXsdName = (name: string): string => {
  // First remove zero-width characters
  let cleaned = removeZeroWidthCharacters(name);

  // Replace spaces and special characters with underscores
  cleaned = cleaned.replace(/[^\w]/g, '_');

  // Ensure it starts with a letter or underscore
  if (cleaned && !/^[a-zA-Z_]/.test(cleaned[0])) {
    cleaned = 'field_' + cleaned;
  }

  // Remove multiple consecutive underscores
  cleaned = cleaned.replace(/_+/g, '_');

  // Remove trailing underscores
  cleaned = cleaned.replace(/_+$/, '');

  return cleaned ?? 'unknown_field';
};

/**
 * Map Salesforce field types to XSD types.
 */
const mapFieldTypeToXsd = (fieldType: string): string => {
  // First remove zero-width characters
  const cleanedFieldType = removeZeroWidthCharacters(fieldType);

  // Handle empty field types
  if (!cleanedFieldType || cleanedFieldType.trim() === '') {
    return 'xsd:anyType';
  }

  const lowerFieldType = cleanedFieldType.toLowerCase();

  // Handle arrays - strip [] and recurse to get base type
  if (cleanedFieldType.endsWith('[]')) {
    const baseType = cleanedFieldType.slice(0, -2);
    return mapFieldTypeToXsd(baseType);
  }

  // Basic types
  if (lowerFieldType.includes('string') || lowerFieldType.includes('text')) {
    return 'xsd:string';
  } else if (lowerFieldType.includes('boolean')) {
    return 'xsd:boolean';
  } else if (lowerFieldType.includes('int')) {
    return 'xsd:int';
  } else if (
    lowerFieldType.includes('double') ||
    lowerFieldType.includes('decimal') ||
    lowerFieldType.includes('number')
  ) {
    return 'xsd:double';
  } else if (lowerFieldType.includes('date')) {
    if (lowerFieldType.includes('time')) {
      return 'xsd:dateTime';
    } else {
      return 'xsd:date';
    }
  } else if (lowerFieldType.includes('base64')) {
    return 'xsd:base64Binary';
  } else if (lowerFieldType.includes('reference')) {
    return 'xsd:string'; // References are typically string IDs
  } else if (lowerFieldType.includes('multipicklist')) {
    return 'xsd:anyType'; // Multi-picklists are anyType
  } else if (lowerFieldType.includes('picklist') || lowerFieldType.includes('enumeration')) {
    return 'xsd:string'; // Picklists are string values
  } else if (lowerFieldType.includes('email')) {
    return 'xsd:string';
  } else if (lowerFieldType.includes('url')) {
    return 'xsd:anyURI';
  } else if (lowerFieldType.includes('phone')) {
    return 'xsd:string';
  } else {
    // For unknown types, assume they're custom metadata types and return as-is
    // This allows types like "AIScoringStep" to be referenced directly
    return cleanedFieldType;
  }
};

/**
 * Escape XML special characters and remove zero-width characters.
 */
const escapeXml = (text: string): string => {
  if (!text) return '';

  // First remove zero-width characters, then escape XML special characters
  return removeZeroWidthCharacters(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
};

/**
 * Convert JSON metadata to XSD schema that fits the format for hover documentation.
 */
const createXsdFromJson = (jsonFilePath: string, outputFilePath: string): number => {
  // Load JSON data
  const jsonContent = fs.readFileSync(jsonFilePath, 'utf-8');
  const metadataTypes: MetadataTypesMap = JSON.parse(jsonContent);

  // Create XSD header
  const currentTime = new Date().toISOString();
  const numTypes = Object.keys(metadataTypes).length;

  const xsdLines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!--',
    'Salesforce Metadata Types XSD - Generated from metadata documentation',
    'This file contains all metadata type definitions for hover documentation and IDE support.',
    '',
    `Generated on: ${currentTime}`,
    `Total metadata types: ${numTypes}`,
    '-->',
    '<xsd:schema',
    ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"',
    ' elementFormDefault="qualified">'
  ];

  // Add base Metadata type
  xsdLines.push(
    ' <xsd:complexType name="Metadata">',
    '  <xsd:choice>',
    '   <xsd:element name="fullName" minOccurs="0" type="xsd:string"/>',
    '  </xsd:choice>',
    '  <xsd:attribute name="fqn" type="xsd:string"/>',
    ' </xsd:complexType>'
  );

  // Collect all unique parent types to ensure they're defined
  const allParentTypes = new Set<string>();
  Object.values(metadataTypes).forEach(typeData => {
    if (typeData.parent && typeData.parent !== 'Metadata') {
      allParentTypes.add(typeData.parent);
    }
  });

  // Process parent types first (those that are used as base types but aren't 'Metadata')
  const sortedParentTypes = Array.from(allParentTypes).sort();

  // Process each metadata type (sorted alphabetically)
  // First process types that are used as parents, then the rest
  const allTypeNames = Object.keys(metadataTypes).filter(typeName => typeName !== 'Metadata');
  const nonParentTypes = allTypeNames.filter(name => !allParentTypes.has(name));
  const sortedTypes = [...sortedParentTypes.filter(name => allTypeNames.includes(name)), ...nonParentTypes.sort()];

  for (const typeName of sortedTypes) {
    const typeData = metadataTypes[typeName];
    const cleanTypeName = cleanXsdName(typeName);
    const fields = typeData.fields ?? [];

    // Create complex type
    const shortDesc = typeData.short_description ?? '';
    const url = typeData.url ?? '';
    const parentType = typeData.parent ?? 'Metadata'; // Default to Metadata if not specified

    xsdLines.push(` <xsd:complexType name="${cleanTypeName}">`);

    // Add type-level documentation
    if (shortDesc || url) {
      xsdLines.push('  <xsd:annotation>');
      if (shortDesc) {
        const escapedDesc = escapeXml(shortDesc);
        xsdLines.push(`   <xsd:documentation>${escapedDesc}</xsd:documentation>`);
      }
      if (url) {
        const escapedUrl = escapeXml(url);
        xsdLines.push(`   <xsd:appinfo>Documentation: ${escapedUrl}</xsd:appinfo>`);
      }
      xsdLines.push('  </xsd:annotation>');
    }

    xsdLines.push('  <xsd:complexContent>');
    xsdLines.push(`   <xsd:extension base="${parentType}">`);

    if (fields.length > 0) {
      xsdLines.push('    <xsd:choice maxOccurs="unbounded">');

      // Add fields
      for (const field of fields) {
        const fieldName = field['Field Name'] ?? '';
        const fieldType = field['Field Type'] ?? '';
        const description = field.Description ?? '';

        if (fieldName) {
          const cleanFieldName = cleanXsdName(fieldName);
          const xsdType = mapFieldTypeToXsd(fieldType);

          xsdLines.push(
            `     <xsd:element name="${cleanFieldName}" minOccurs="0" maxOccurs="unbounded" type="${xsdType}">`
          );

          // Add field-level documentation
          if (description || fieldType) {
            xsdLines.push('      <xsd:annotation>');
            if (description) {
              const escapedDesc = escapeXml(description);
              xsdLines.push(`       <xsd:documentation>${escapedDesc}</xsd:documentation>`);
            }
            if (fieldType) {
              const escapedType = escapeXml(fieldType);
              xsdLines.push(`       <xsd:appinfo>Type: ${escapedType}</xsd:appinfo>`);
            }
            xsdLines.push('      </xsd:annotation>');
          }

          xsdLines.push('     </xsd:element>');
        }
      }

      xsdLines.push('     <xsd:any minOccurs="0" maxOccurs="unbounded" processContents="lax"/>');
      xsdLines.push('    </xsd:choice>');
    } else {
      // No fields, just extend base Metadata
      xsdLines.push('    <xsd:choice>');
      xsdLines.push('     <xsd:any minOccurs="0" maxOccurs="unbounded" processContents="lax"/>');
      xsdLines.push('    </xsd:choice>');
    }

    xsdLines.push('   </xsd:extension>');
    xsdLines.push('  </xsd:complexContent>');
    xsdLines.push(' </xsd:complexType>');
  }

  // Add element declarations for all metadata types
  for (const typeName of sortedTypes) {
    // Skip the base Metadata type
    if (typeName === 'Metadata') {
      continue;
    }

    const cleanTypeName = cleanXsdName(typeName);
    xsdLines.push(` <xsd:element name="${cleanTypeName}" type="${cleanTypeName}"/>`);
  }

  // Close schema
  xsdLines.push('</xsd:schema>');

  // Write to file
  fs.writeFileSync(outputFilePath, xsdLines.join('\n') + '\n', 'utf-8');

  return numTypes;
};

/**
 * Main function to convert JSON to XSD.
 */
const main = (): void => {
  const workspaceRoot = path.resolve(__dirname, '..', '..');
  const jsonFile = path.join(workspaceRoot, 'packages/salesforcedx-vscode-core/metadata_types_map_scraped.json');
  const xsdFile = path.join(
    workspaceRoot,
    'packages/salesforcedx-vscode-core/resources/salesforce_metadata_api_common.xsd'
  );

  if (!fs.existsSync(jsonFile)) {
    console.error(`Error: ${jsonFile} not found`);
    process.exit(1);
  }

  console.log(`Converting ${jsonFile} to XSD format...`);

  try {
    const numTypes = createXsdFromJson(jsonFile, xsdFile);
    console.log(`Successfully converted ${numTypes} metadata types to XSD`);
    console.log(`Output saved to: ${xsdFile}`);

    // Print file size
    const stats = fs.statSync(xsdFile);
    const fileSizeKB = stats.size / 1024;
    console.log(`XSD file size: ${fileSizeKB.toFixed(1)} KB`);
  } catch (error) {
    console.error(`Error during conversion: ${error}`);
    throw error;
  }
};

// Run the script
if (require.main === module) {
  main();
}

export { createXsdFromJson, mapFieldTypeToXsd, escapeXml, cleanXsdName, removeZeroWidthCharacters };
