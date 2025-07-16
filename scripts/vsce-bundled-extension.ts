import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

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

// Run npm install
logger('executing npm install');
execSync('npm install', { stdio: 'inherit', cwd });

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
