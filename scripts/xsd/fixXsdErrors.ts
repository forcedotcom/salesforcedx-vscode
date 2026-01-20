/**
 * Script to fix XSD validation errors by replacing undefined type references with xsd:anyType
 */

import * as fs from 'fs';
import * as path from 'path';

interface ErrorInfo {
  lineNumber: number;
  typeName: string;
}

function parseErrorFile(errorFilePath: string): ErrorInfo[] {
  const content = fs.readFileSync(errorFilePath, 'utf-8');
  const errors: ErrorInfo[] = [];

  // Parse lines like: 1. Undefined type reference: "PermissionSetTabVisibility" (used on line: 473)
  const errorRegex = /\d+\.\s+Undefined type reference:\s+"([^"]+)"\s+\(used on lines?:\s+([0-9,\s]+)\)/g;

  let match;
  while ((match = errorRegex.exec(content)) !== null) {
    const typeName = match[1];
    const lineNumbersStr = match[2];

    // Parse line numbers (can be comma-separated)
    const lineNumbers = lineNumbersStr.split(',').map(s => parseInt(s.trim(), 10));

    for (const lineNumber of lineNumbers) {
      errors.push({ lineNumber, typeName });
    }
  }

  return errors;
}

function fixXsdFile(xsdFilePath: string, errors: ErrorInfo[]): void {
  const content = fs.readFileSync(xsdFilePath, 'utf-8');
  const lines = content.split('\n');

  let fixedCount = 0;
  const fixedLines = new Set<number>();

  // Sort errors by line number to process them in order
  const sortedErrors = errors.sort((a, b) => a.lineNumber - b.lineNumber);

  for (const error of sortedErrors) {
    const lineIndex = error.lineNumber - 1; // Convert to 0-based index

    if (lineIndex < 0 || lineIndex >= lines.length) {
      console.warn(`Warning: Line ${error.lineNumber} is out of bounds`);
      continue;
    }

    // Skip if we've already fixed this line
    if (fixedLines.has(error.lineNumber)) {
      continue;
    }

    const line = lines[lineIndex];

    // Look for type="<typeName>" and replace with type="xsd:anyType"
    // This regex handles both the exact type and variations
    const typeRegex = /type="[^"]+"/;

    if (typeRegex.test(line)) {
      const originalLine = line;
      const fixedLine = line.replace(typeRegex, 'type="xsd:anyType"');

      if (originalLine !== fixedLine) {
        lines[lineIndex] = fixedLine;
        fixedLines.add(error.lineNumber);
        fixedCount++;
        console.log(`Fixed line ${error.lineNumber}: "${error.typeName}" → "xsd:anyType"`);
      }
    } else {
      console.warn(`Warning: Could not find type attribute on line ${error.lineNumber}`);
      console.warn(`  Content: ${line.trim()}`);
    }
  }

  // Write the fixed content back
  fs.writeFileSync(xsdFilePath, lines.join('\n'), 'utf-8');

  console.log(`\n✅ Fixed ${fixedCount} type references in ${xsdFilePath}`);
}

/** Use fixed values to override known issues in the XSD file */
function fixKnownXSDIssues(xsdFilePath: string): void {
  const content = fs.readFileSync(xsdFilePath, 'utf-8');
  let modifiedContent = content;
  let fixCount = 0;

  // Fix targetConfigs - it's a simple type but has children, so it needs to be xsd:anyType
  // Look for lines containing name="targetConfigs" and ensure the type attribute is xsd:anyType
  const targetConfigsRegex = /(<xsd:element\s+name="targetConfigs"[^>]*?\s+type=)"[^"]+"/g;
  if (targetConfigsRegex.test(content)) {
    modifiedContent = modifiedContent.replace(targetConfigsRegex, '$1"xsd:anyType"');
    fixCount++;
    console.log('Fixed targetConfigs type to xsd:anyType');
  }

  if (fixCount > 0) {
    fs.writeFileSync(xsdFilePath, modifiedContent, 'utf-8');
    console.log(`\n✅ Fixed ${fixCount} known issue(s) in ${xsdFilePath}`);
  }
}

function main() {
  const repoRoot = path.resolve(__dirname, '../..');
  const errorFilePath = path.join(repoRoot, 'xsdErrors.txt');
  const xsdFilePath = path.join(
    repoRoot,
    'packages/salesforcedx-vscode-core/resources/salesforce_metadata_api_common.xsd'
  );

  console.log('Fixing known issues in the XSD file...');
  fixKnownXSDIssues(xsdFilePath);

  console.log('\nParsing error file...');
  const errors = parseErrorFile(errorFilePath);
  console.log(`Found ${errors.length} error references to fix`);

  console.log('\nFixing XSD file...');
  fixXsdFile(xsdFilePath, errors);

  // Delete the error file after successful fix
  console.log('\nDeleting error file...');
  fs.unlinkSync(errorFilePath);
  console.log(`Deleted ${errorFilePath}`);

  console.log('\n✨ Done!');
}

main();
