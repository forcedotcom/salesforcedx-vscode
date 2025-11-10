#!/usr/bin/env node
/**
 * Convert metadata_types_map_scraped.json to XSD file matching the format of salesforce_metadata_api_elephant.xsd.
 */

import * as fs from 'fs';
import * as path from 'path';

type FieldInfo = {
  'Field Name': string;
  'Field Type': string;
  Description: string;
};

type MetadataType = {
  fields: FieldInfo[];
  short_description: string;
  url: string;
};

type MetadataTypesMap = {
  [typeName: string]: MetadataType;
};

/**
 * Clean a name to be valid for XSD element names.
 */
const cleanXsdName = (name: string): string => {
  // Replace spaces and special characters with underscores
  let cleaned = name.replace(/[^\w]/g, '_');

  // Ensure it starts with a letter or underscore
  if (cleaned && !/^[a-zA-Z_]/.test(cleaned[0])) {
    cleaned = 'field_' + cleaned;
  }

  // Remove multiple consecutive underscores
  cleaned = cleaned.replace(/_+/g, '_');

  // Remove trailing underscores
  cleaned = cleaned.replace(/_+$/, '');

  return cleaned || 'unknown_field';
};

/**
 * Map Salesforce field types to XSD types.
 */
const mapFieldTypeToXsd = (fieldType: string): string => {
  const lowerFieldType = fieldType.toLowerCase().trim();

  // Basic types
  if (lowerFieldType.endsWith('[]')) {
    return 'xsd:anyType'; // Arrays - treated as anyType
  } else if (lowerFieldType.includes('string') || lowerFieldType.includes('text')) {
    return 'xsd:string';
  } else if (lowerFieldType.includes('boolean')) {
    return 'xsd:boolean';
  } else if (lowerFieldType.includes('int') || lowerFieldType.includes('integer')) {
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
  } else if (lowerFieldType.includes('picklist') || lowerFieldType.includes('enumeration')) {
    return 'xsd:string'; // Picklists are string values
  } else if (lowerFieldType.includes('multipicklist')) {
    return 'xsd:anyType'; // Multi-picklists are anyType
  } else if (lowerFieldType.includes('email')) {
    return 'xsd:string';
  } else if (lowerFieldType.includes('url')) {
    return 'xsd:anyURI';
  } else if (lowerFieldType.includes('phone')) {
    return 'xsd:string';
  } else {
    return 'xsd:anyType'; // Default to anyType for unknown types
  }
};

/**
 * Escape XML special characters.
 */
const escapeXml = (text: string): string => {
  if (!text) {
    return '';
  }

  let escaped = String(text);

  // Basic XML escaping
  escaped = escaped.replace(/&/g, '&amp;');
  escaped = escaped.replace(/</g, '&lt;');
  escaped = escaped.replace(/>/g, '&gt;');
  escaped = escaped.replace(/"/g, '&quot;');
  escaped = escaped.replace(/'/g, '&apos;');

  return escaped;
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
    ' </xsd:complexType>'
  );

  // Process each metadata type (sorted alphabetically)
  const sortedTypes = Object.keys(metadataTypes).sort();

  for (const typeName of sortedTypes) {
    // Skip the base Metadata type to avoid duplicate definition
    if (typeName === 'Metadata') {
      continue;
    }

    const typeData = metadataTypes[typeName];
    const cleanTypeName = cleanXsdName(typeName);
    const fields = typeData.fields || [];

    // Create complex type
    const shortDesc = typeData.short_description || '';
    const url = typeData.url || '';

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
    xsdLines.push('   <xsd:extension base="Metadata">');

    if (fields.length > 0) {
      xsdLines.push('    <xsd:choice maxOccurs="unbounded">');

      // Add fields
      for (const field of fields) {
        const fieldName = field['Field Name'] || '';
        const fieldType = field['Field Type'] || '';
        const description = field.Description || '';

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

    xsdLines.push('    <xsd:attribute name="fqn" type="xsd:string"/>');
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
  const workspaceRoot = path.resolve(__dirname, '..');
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

export { createXsdFromJson, mapFieldTypeToXsd, escapeXml, cleanXsdName };
