#!/usr/bin/env node
/**
 * Validates the salesforce_metadata_api_common.xsd file for well-formedness and schema validity.
 * If errors are found, they are written to xsdErrors.txt.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseStringPromise } from 'xml2js';

interface ValidationError {
  type: 'well-formed' | 'schema' | 'reference';
  message: string;
  line?: number;
  column?: number;
}

/**
 * Check if XSD file is well-formed XML.
 */
const validateWellFormedXml = async (xsdFilePath: string): Promise<ValidationError[]> => {
  const errors: ValidationError[] = [];

  try {
    const xmlContent = fs.readFileSync(xsdFilePath, 'utf-8');

    // Try to parse as XML
    await parseStringPromise(xmlContent, {
      strict: true,
      async: false
    });

    console.log('✓ XSD file is well-formed XML');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push({
      type: 'well-formed',
      message: `XML parsing error: ${errorMessage}`
    });
  }

  return errors;
};

/**
 * Check for common XSD schema issues like undefined type references.
 */
const validateSchemaReferences = (xsdFilePath: string): ValidationError[] => {
  const errors: ValidationError[] = [];
  const content = fs.readFileSync(xsdFilePath, 'utf-8');
  const lines = content.split('\n');

  // Extract all defined types
  const definedTypes = new Set<string>();
  const typeDefPattern = /<xsd:complexType\s+name="([^"]+)"/g;
  const simpleTypePattern = /<xsd:simpleType\s+name="([^"]+)"/g;

  let match;
  while ((match = typeDefPattern.exec(content)) !== null) {
    definedTypes.add(match[1]);
  }
  while ((match = simpleTypePattern.exec(content)) !== null) {
    definedTypes.add(match[1]);
  }

  // Add built-in XSD types
  const builtInTypes = [
    'xsd:string',
    'xsd:int',
    'xsd:integer',
    'xsd:double',
    'xsd:boolean',
    'xsd:date',
    'xsd:dateTime',
    'xsd:time',
    'xsd:anyType',
    'xsd:anyURI',
    'xsd:base64Binary',
    'xsd:hexBinary',
    'xsd:decimal',
    'xsd:float',
    'xsd:long',
    'xsd:short',
    'xsd:byte',
    'xsd:unsignedInt',
    'xsd:anySimpleType'
  ];
  builtInTypes.forEach(type => definedTypes.add(type));

  // Check all type references
  const typeRefPattern = /\s(?:type|base)="([^"]+)"/g;
  const referencedTypes = new Map<string, number[]>(); // type -> line numbers

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    let refMatch;
    const refRegex = /\s(?:type|base)="([^"]+)"/g;

    while ((refMatch = refRegex.exec(line)) !== null) {
      const typeName = refMatch[1];
      if (!referencedTypes.has(typeName)) {
        referencedTypes.set(typeName, []);
      }
      referencedTypes.get(typeName)?.push(lineNumber);
    }
  });

  // Check for undefined references
  Array.from(referencedTypes.entries()).forEach(([typeName, lineNumbers]) => {
    if (!definedTypes.has(typeName)) {
      errors.push({
        type: 'reference',
        message: `Undefined type reference: "${typeName}" (used on line${lineNumbers.length > 1 ? 's' : ''}: ${lineNumbers.slice(0, 5).join(', ')}${lineNumbers.length > 5 ? '...' : ''})`,
        line: lineNumbers[0]
      });
    }
  });

  if (errors.length === 0) {
    console.log('✓ All type references are valid');
    console.log(`  Total defined types: ${definedTypes.size - builtInTypes.length}`);
    console.log(`  Total type references: ${referencedTypes.size}`);
  }

  return errors;
};

/**
 * Check for duplicate type definitions.
 */
const validateNoDuplicateTypes = (xsdFilePath: string): ValidationError[] => {
  const errors: ValidationError[] = [];
  const content = fs.readFileSync(xsdFilePath, 'utf-8');
  const lines = content.split('\n');

  const definedTypes = new Map<string, number[]>(); // type -> line numbers
  const typeDefPattern = /<xsd:(?:complexType|simpleType)\s+name="([^"]+)"/;

  lines.forEach((line, index) => {
    const match = line.match(typeDefPattern);
    if (match) {
      const typeName = match[1];
      const lineNumber = index + 1;

      if (!definedTypes.has(typeName)) {
        definedTypes.set(typeName, []);
      }
      definedTypes.get(typeName)?.push(lineNumber);
    }
  });

  // Find duplicates
  Array.from(definedTypes.entries()).forEach(([typeName, lineNumbers]) => {
    if (lineNumbers.length > 1) {
      errors.push({
        type: 'schema',
        message: `Duplicate type definition: "${typeName}" defined ${lineNumbers.length} times on lines: ${lineNumbers.join(', ')}`,
        line: lineNumbers[0]
      });
    }
  });

  if (errors.length === 0) {
    console.log('✓ No duplicate type definitions found');
  }

  return errors;
};

/**
 * Check for invalid XML characters or encoding issues.
 */
const validateEncoding = (xsdFilePath: string): ValidationError[] => {
  const errors: ValidationError[] = [];
  const content = fs.readFileSync(xsdFilePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Check for control characters (except newline, carriage return, tab)
    // eslint-disable-next-line no-control-regex
    const controlCharMatch = line.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/);
    if (controlCharMatch) {
      errors.push({
        type: 'well-formed',
        message: `Invalid control character found on line ${lineNumber}`,
        line: lineNumber
      });
    }

    // Check for unescaped XML special characters in attribute values
    const attrValuePattern = /="([^"]*)"/g;
    let match;
    while ((match = attrValuePattern.exec(line)) !== null) {
      const value = match[1];
      if (value.includes('<') && !value.includes('&lt;')) {
        errors.push({
          type: 'well-formed',
          message: `Unescaped '<' character in attribute value on line ${lineNumber}`,
          line: lineNumber
        });
      }
      if (value.includes('>') && !value.includes('&gt;')) {
        errors.push({
          type: 'well-formed',
          message: `Unescaped '>' character in attribute value on line ${lineNumber}`,
          line: lineNumber
        });
      }
      if (value.includes('&') && !value.match(/&(?:amp|lt|gt|quot|apos);/)) {
        errors.push({
          type: 'well-formed',
          message: `Unescaped '&' character in attribute value on line ${lineNumber}`,
          line: lineNumber
        });
      }
    }
  });

  if (errors.length === 0) {
    console.log('✓ No encoding or character issues found');
  }

  return errors;
};

/**
 * Write errors to xsdErrors.txt.
 */
const writeErrorsToFile = (errors: ValidationError[], outputPath: string): void => {
  if (errors.length === 0) {
    // If no errors, write success message
    const successMessage = `XSD Validation Results - ${new Date().toISOString()}\n\n✓ Validation passed with no errors!\n`;
    fs.writeFileSync(outputPath, successMessage, 'utf-8');
    console.log(`\n✓ No errors found! Success message written to ${outputPath}`);
    return;
  }

  const output: string[] = [];
  output.push(`XSD Validation Errors - ${new Date().toISOString()}`);
  output.push(`Total errors found: ${errors.length}`);
  output.push('');
  output.push('='.repeat(80));
  output.push('');

  // Group errors by type
  const errorsByType = new Map<string, ValidationError[]>();
  errors.forEach(error => {
    if (!errorsByType.has(error.type)) {
      errorsByType.set(error.type, []);
    }
    errorsByType.get(error.type)?.push(error);
  });

  // Write errors by category
  Array.from(errorsByType.entries()).forEach(([type, typeErrors]) => {
    output.push(`${type.toUpperCase()} ERRORS (${typeErrors.length}):`);
    output.push('-'.repeat(80));

    typeErrors.forEach((error, index) => {
      output.push(`${index + 1}. ${error.message}`);
      if (error.line) {
        output.push(`   Line: ${error.line}${error.column ? `, Column: ${error.column}` : ''}`);
      }
      output.push('');
    });
    output.push('');
  });

  fs.writeFileSync(outputPath, output.join('\n'), 'utf-8');
  console.error(`\n✗ ${errors.length} error(s) found. Details written to ${outputPath}`);
};

/**
 * Main validation function.
 */
const main = async (): Promise<void> => {
  const workspaceRoot = path.resolve(__dirname, '..', '..');
  const xsdFile = path.join(
    workspaceRoot,
    'packages/salesforcedx-vscode-core/resources/salesforce_metadata_api_common.xsd'
  );
  const errorFile = path.join(workspaceRoot, 'xsdErrors.txt');

  console.log('Validating XSD file...');
  console.log(`XSD file: ${xsdFile}`);
  console.log('');

  if (!fs.existsSync(xsdFile)) {
    console.error(`Error: XSD file not found at ${xsdFile}`);
    process.exit(1);
  }

  const allErrors: ValidationError[] = [];

  // Check file stats
  const stats = fs.statSync(xsdFile);
  const fileSizeKB = stats.size / 1024;
  console.log(`File size: ${fileSizeKB.toFixed(1)} KB`);
  console.log('');

  try {
    // Run all validation checks
    console.log('Running validation checks...');
    console.log('');

    // 1. Check well-formed XML
    console.log('1. Checking XML well-formedness...');
    const wellFormedErrors = await validateWellFormedXml(xsdFile);
    allErrors.push(...wellFormedErrors);

    // 2. Check encoding
    console.log('\n2. Checking encoding and character validity...');
    const encodingErrors = validateEncoding(xsdFile);
    allErrors.push(...encodingErrors);

    // 3. Check for duplicate types
    console.log('\n3. Checking for duplicate type definitions...');
    const duplicateErrors = validateNoDuplicateTypes(xsdFile);
    allErrors.push(...duplicateErrors);

    // 4. Check type references
    console.log('\n4. Checking type references...');
    const referenceErrors = validateSchemaReferences(xsdFile);
    allErrors.push(...referenceErrors);

    // Write results
    writeErrorsToFile(allErrors, errorFile);

    // Exit with appropriate code
    if (allErrors.length > 0) {
      process.exit(1);
    } else {
      console.log('\n✓ All validation checks passed!');
    }
  } catch (error) {
    console.error(`\nValidation failed with exception: ${error}`);

    const fatalError: ValidationError[] = [
      {
        type: 'well-formed',
        message: `Fatal error during validation: ${error instanceof Error ? error.message : String(error)}`
      }
    ];

    writeErrorsToFile(fatalError, errorFile);
    process.exit(1);
  }
};

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { validateWellFormedXml, validateSchemaReferences, validateNoDuplicateTypes, validateEncoding };
