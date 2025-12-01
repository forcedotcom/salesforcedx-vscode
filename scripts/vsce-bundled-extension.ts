import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import path from 'path';

const logger = (msg: string, obj?: any) => {
  if (!obj) {
    console.log(`*** ${msg}`);
  } else {
    console.log(`*** ${msg}`, obj);
  }
};

const extensionDirectory = process.cwd();
logger('CWD', { extensionDirectory });

const packageContents = require(`${extensionDirectory}/package.json`);
if (!packageContents) {
  console.error('Failed to find extension package.json');
  process.exit(2);
}

const buildDirectory = process.env.VSCODE_EXTENSION_BUILD_LOCATION || tmpdir();

if (!buildDirectory || !existsSync(buildDirectory)) {
  console.error(`Build location does not exist ${buildDirectory}`);
}

const directoryToConstruct = `${extensionDirectory}/extension`;
if (!existsSync(directoryToConstruct)) {
  logger(`Creating the extensions directory ${directoryToConstruct}`);
  mkdirSync(directoryToConstruct, { recursive: true });
}

const packagingConfig = packageContents.packaging;

if (!packagingConfig) {
  console.error('No packaging config found.');
  process.exit(2);
}

for (let i = 0; i < packagingConfig.assets.length; i++) {
  const asset = packagingConfig.assets[i];
  const from = `${extensionDirectory}/${asset}`;
  logger(`copying ${from}`);
  cpSync(from, `${directoryToConstruct}/${asset}`, { recursive: true });
}

const newPackage = {
  ...packageContents,
  ...packagingConfig.packageUpdates
};
delete newPackage.packaging;

// Update the debugger config for dist
if (packagingConfig.debuggers) {
  for (let h = 0; h < packagingConfig.debuggers.length; h++) {
    logger(`Adding debugger at ${h} for ${packagingConfig.debuggers[h]}`);
    newPackage.contributes.debuggers[h].program = packagingConfig.debuggers[h];
  }
}

logger('Write the new package.json file.');
writeFileSync(`${directoryToConstruct}/package.json`, JSON.stringify(newPackage, null, 2), 'utf-8');

// copy extension to build location. Note this is required due to vsce note having any
// option to disable npm workspaces.
const buildLocation = `${buildDirectory}/${newPackage.name}`;

logger('Create buildLocation if necessary.', { buildLocation });
if (!existsSync(buildLocation)) {
  logger('Creating the build location');
  mkdirSync(buildLocation);
}

// Copy the extension directory to the build location
logger('copying extension directory to build location', {
  directoryToConstruct,
  dest: `${buildLocation}/`
});
cpSync(directoryToConstruct, `${buildLocation}/extension`, { recursive: true });

// Remaining commans should be run in the copied dir
const cwd = `${buildLocation}/extension`;
logger(`Now in ${cwd}`);

// Copy workspace packages from monorepo packages directory before npm install
const workspaceRoot = `${extensionDirectory}/../..`;
const monorepoPackages = `${workspaceRoot}/packages`;
const extensionNodeModules = `${cwd}/node_modules/@salesforce`;

if (existsSync(monorepoPackages)) {
  logger('Copying workspace packages from monorepo packages directory');
  if (!existsSync(extensionNodeModules)) {
    mkdirSync(extensionNodeModules, { recursive: true });
  }
  // Copy workspace packages that might be needed
  const workspacePackages = [
    { name: 'salesforcedx-lightning-lsp-common', dir: 'salesforcedx-lightning-lsp-common' },
    { name: 'salesforcedx-lwc-language-server', dir: 'salesforcedx-lwc-language-server' },
    { name: 'salesforcedx-aura-language-server', dir: 'salesforcedx-aura-language-server' }
  ];
  for (const pkg of workspacePackages) {
    const src = `${monorepoPackages}/${pkg.dir}`;
    const dest = `${extensionNodeModules}/${pkg.name}`;
    if (existsSync(src)) {
      logger(`Copying ${pkg.name} from ${src} to ${dest}`);
      // Verify that the out directory exists before copying (language servers need to be compiled)
      const outDir = `${src}/out`;
      if (!existsSync(outDir)) {
        console.error(`ERROR: ${pkg.name} has not been compiled. The 'out' directory does not exist at ${outDir}`);
        console.error(`Please run 'npm run compile' in the ${pkg.dir} package before packaging.`);
        process.exit(1);
      }

      // Verify that the server.js file exists for language servers
      if (pkg.name.includes('language-server')) {
        const serverJsPath = path.join(src, 'out', 'src', 'server.js');
        if (!existsSync(serverJsPath)) {
          console.error(`ERROR: ${pkg.name} server.js not found at ${serverJsPath}`);
          console.error(`Please run 'npm run compile' in the ${pkg.dir} package before packaging.`);
          process.exit(1);
        }
        logger(`Verified server.js exists for ${pkg.name} at ${serverJsPath}`);
      }

      cpSync(src, dest, { recursive: true, dereference: true });
      // Verify that the out directory was copied successfully
      const destOutDir = `${dest}/out`;
      if (!existsSync(destOutDir)) {
        console.error(`ERROR: Failed to copy 'out' directory for ${pkg.name} to ${destOutDir}`);
        process.exit(1);
      }

      // Verify server.js was copied for language servers
      if (pkg.name.includes('language-server')) {
        const copiedServerJsPath = path.join(dest, 'out', 'src', 'server.js');
        if (!existsSync(copiedServerJsPath)) {
          console.error(`ERROR: server.js not found in copied package: ${copiedServerJsPath}`);
          process.exit(1);
        }
        logger(`Verified server.js was copied for ${pkg.name} to ${copiedServerJsPath}`);
      }

      logger(`Successfully copied ${pkg.name} including out directory`);
    }
  }
}

// Temporarily remove local workspace packages from dependencies
// They're already copied to node_modules, so we don't need npm to install them
// This prevents npm from trying to fetch them from the registry
const packageJsonPath = `${cwd}/package.json`;
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const originalDependencies = { ...packageJson.dependencies };

// Remove workspace packages from dependencies temporarily
const workspacePackageNames = [
  '@salesforce/salesforcedx-lightning-lsp-common',
  '@salesforce/salesforcedx-lwc-language-server',
  '@salesforce/salesforcedx-aura-language-server'
];

const removedDependencies: Record<string, string> = {};
for (const pkgName of workspacePackageNames) {
  if (packageJson.dependencies[pkgName]) {
    removedDependencies[pkgName] = packageJson.dependencies[pkgName];
    delete packageJson.dependencies[pkgName];
  }
}

writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');

// Run npm install (will install other dependencies, but skip the local ones)
logger('executing npm install');
execSync('npm install --no-audit --no-fund', { stdio: 'inherit', cwd });

// Don't restore workspace packages to dependencies - they're already in node_modules
// This prevents npm prune (run by vsce package) from trying to validate them against the registry
// The packages will still be available in node_modules for the extension to use

// Clean up any existing VSIX files from previous builds
logger('cleaning up existing VSIX files');
const existingVsixFiles = readdirSync(cwd).filter(f => f.endsWith('.vsix'));
for (const vsixFile of existingVsixFiles) {
  logger(`removing existing VSIX file: ${vsixFile}`);
  unlinkSync(`${cwd}/${vsixFile}`);
}

// Run the vsce package command
logger(`Execute vsce from ${cwd}`);
execSync('vsce package', { stdio: 'inherit', cwd });

// copy the vsix back to the extension directory
logger('copy vsix back to extension directory');
const vsixFiles = readdirSync(cwd).filter(f => f.endsWith('.vsix'));
logger('Found VSIX files:', vsixFiles);

if (vsixFiles.length !== 1) {
  console.error(`Unable to find generated vsix file. Found ${vsixFiles.length} .vsix files:`, vsixFiles);
  process.exit(2);
}

copyFileSync(`${cwd}/${vsixFiles[0]}`, `${extensionDirectory}/${vsixFiles[0]}`);

logger('Success');
process.exit(0);
