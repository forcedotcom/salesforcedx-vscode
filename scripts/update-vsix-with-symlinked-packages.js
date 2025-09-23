#!/usr/bin/env node
/**
 * Script to update VSIX files with symlinked LSP packages
 * This runs after the main packaging to ensure the latest LSP packages are included
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function logger(message) {
  console.log(`*** ${message}`);
}

function updateVsixWithSymlinkedPackages(vsixPath) {
  if (!fs.existsSync(vsixPath)) {
    logger(`VSIX file not found: ${vsixPath}`);
    return false;
  }

  logger(`Updating VSIX with symlinked packages: ${vsixPath}`);

  // Create temporary directory for extraction
  const tempDir = path.join(path.dirname(vsixPath), 'temp-vsix-update');
  if (fs.existsSync(tempDir)) {
    execSync(`rm -rf "${tempDir}"`, { stdio: 'inherit' });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Extract VSIX
    logger('Extracting VSIX...');
    execSync(`unzip -q "${vsixPath}" -d "${tempDir}"`, { stdio: 'inherit' });

    // Copy symlinked LSP packages
    const lspPackages = [
      '@salesforce/lightning-lsp-common',
      '@salesforce/lwc-language-server',
      '@salesforce/aura-language-server'
    ];

    const extensionDir = path.join(tempDir, 'extension');
    const nodeModulesDir = path.join(extensionDir, 'node_modules');
    const rootNodeModules = path.join(__dirname, '..', 'node_modules');

    for (const pkg of lspPackages) {
      const sourcePath = path.join(rootNodeModules, pkg);
      const destPath = path.join(nodeModulesDir, pkg);

      if (fs.existsSync(sourcePath)) {
        logger(`Copying ${pkg} from ${sourcePath} to ${destPath}`);

        // Remove existing directory if it exists
        if (fs.existsSync(destPath)) {
          execSync(`rm -rf "${destPath}"`, { stdio: 'inherit' });
        }

        // Copy the symlinked package using Node.js fs for better cross-platform support
        const { cpSync } = require('fs');
        cpSync(sourcePath, destPath, { recursive: true });

        // Verify the copy worked for lightning-lsp-common
        if (pkg === '@salesforce/lightning-lsp-common') {
          const engineDtsPath = path.join(destPath, 'lib', 'resources', 'sfdx', 'typings', 'copied', 'engine.d.ts');
          if (fs.existsSync(engineDtsPath)) {
            const stats = fs.statSync(engineDtsPath);
            logger(`engine.d.ts size: ${stats.size} bytes`);
          }
        }
      } else {
        logger(`WARNING: Source path does not exist: ${sourcePath}`);
      }
    }

    // Recreate VSIX
    logger('Recreating VSIX with updated packages...');
    const newVsixPath = path.resolve(vsixPath.replace('.vsix', '-updated.vsix'));
    const newVsixDir = path.dirname(newVsixPath);
    if (!fs.existsSync(newVsixDir)) {
      fs.mkdirSync(newVsixDir, { recursive: true });
    }
    execSync(`cd "${tempDir}" && zip -r "${newVsixPath}" .`, { stdio: 'inherit' });

    // Replace original VSIX
    execSync(`mv "${newVsixPath}" "${vsixPath}"`, { stdio: 'inherit' });

    logger('Successfully updated VSIX with symlinked packages');
    return true;
  } catch (error) {
    logger(`ERROR: ${error.message}`);
    return false;
  } finally {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      execSync(`rm -rf "${tempDir}"`, { stdio: 'inherit' });
    }
  }
}

// Check if symlinked LSP packages exist
function checkSymlinkedPackages() {
  const lspPackages = [
    '@salesforce/lightning-lsp-common',
    '@salesforce/lwc-language-server',
    '@salesforce/aura-language-server'
  ];

  const rootNodeModules = path.join(__dirname, '..', 'node_modules');
  const symlinkedPackages = [];

  for (const pkg of lspPackages) {
    const packagePath = path.join(rootNodeModules, pkg);
    if (fs.existsSync(packagePath)) {
      try {
        const stats = fs.lstatSync(packagePath);
        if (stats.isSymbolicLink()) {
          symlinkedPackages.push(pkg);
        }
      } catch (error) {
        // If we can't check, assume it's a regular package
      }
    }
  }

  return symlinkedPackages;
}

// Find LWC-related VSIX files
function findLwcRelatedVsixFiles() {
  const lwcExtensions = ['salesforcedx-vscode-lwc', 'salesforcedx-vscode-lightning'];

  const packagesDir = path.join(__dirname, '..', 'packages');
  const vsixFiles = [];

  for (const ext of lwcExtensions) {
    const extDir = path.join(packagesDir, ext);
    if (fs.existsSync(extDir)) {
      const files = fs.readdirSync(extDir).filter(file => file.endsWith('.vsix'));
      for (const file of files) {
        vsixFiles.push(path.join(extDir, file));
      }
    }
  }

  return vsixFiles;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node scripts/update-vsix-with-symlinked-packages.js <path-to-vsix> [additional-paths...]');
    console.error(
      '       node scripts/update-vsix-with-symlinked-packages.js --lwc (update all LWC-related extensions)'
    );
    console.error(
      'Example: node scripts/update-vsix-with-symlinked-packages.js packages/salesforcedx-vscode-lwc/salesforcedx-vscode-lwc-64.15.0.vsix'
    );
    console.error('Example: node scripts/update-vsix-with-symlinked-packages.js --lwc');
    process.exit(1);
  }

  // Check if symlinked packages exist
  const symlinkedPackages = checkSymlinkedPackages();
  if (symlinkedPackages.length === 0) {
    logger('No symlinked LSP packages found. Skipping VSIX update.');
    logger('This script is only needed when LSP packages are symlinked for development.');
    process.exit(0);
  }

  logger(`Found symlinked packages: ${symlinkedPackages.join(', ')}`);

  let vsixPaths = [];

  if (args.includes('--lwc')) {
    // Find all LWC-related VSIX files
    vsixPaths = findLwcRelatedVsixFiles();
    if (vsixPaths.length === 0) {
      logger('No LWC-related VSIX files found.');
      process.exit(0);
    }
    logger(`Found LWC-related VSIX files: ${vsixPaths.map(p => path.basename(p)).join(', ')}`);
  } else {
    // Use provided paths
    vsixPaths = args;
  }

  // Update each VSIX file
  let allSuccess = true;
  for (const vsixPath of vsixPaths) {
    logger(`\n--- Updating ${path.basename(vsixPath)} ---`);
    const success = updateVsixWithSymlinkedPackages(vsixPath);
    if (!success) {
      allSuccess = false;
    }
  }

  if (allSuccess) {
    logger(`\n✅ Successfully updated ${vsixPaths.length} VSIX file(s)`);
  } else {
    logger(`\n❌ Some VSIX files failed to update`);
  }

  process.exit(allSuccess ? 0 : 1);
}

module.exports = { updateVsixWithSymlinkedPackages };
