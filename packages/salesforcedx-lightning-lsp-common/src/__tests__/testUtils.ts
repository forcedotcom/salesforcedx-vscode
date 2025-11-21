/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { FileSystemDataProvider } from '../providers/fileSystemDataProvider';
import { DirectoryEntry } from '../types/fileSystemTypes';
import { unixify } from '../utils';

// Test workspace paths for common package (running from source)
const COMMON_SFDX_WORKSPACE_ROOT = resolve(__dirname, '..', '..', '..', '..', 'test-workspaces', 'sfdx-workspace');
const COMMON_CORE_ALL_ROOT = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'test-workspaces',
  'core-like-workspace',
  'app',
  'main',
  'core'
);

// Test workspace paths for other packages (running from compiled code)
const PACKAGE_SFDX_WORKSPACE_ROOT = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'test-workspaces',
  'sfdx-workspace'
);
const PACKAGE_CORE_ALL_ROOT = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'test-workspaces',
  'core-like-workspace',
  'app',
  'main',
  'core'
);

// Export the appropriate paths based on whether we're running from source or compiled code
// Check for 'out' directory in path (cross-platform: Windows uses '\', Unix uses '/')
const normalizedDirname = __dirname.replace(/\\/g, '/');
const isCommonPackage = __dirname.includes('salesforcedx-lightning-lsp-common') && !normalizedDirname.includes('/out/');

export const SFDX_WORKSPACE_ROOT = isCommonPackage ? COMMON_SFDX_WORKSPACE_ROOT : PACKAGE_SFDX_WORKSPACE_ROOT;
export const FORCE_APP_ROOT = join(SFDX_WORKSPACE_ROOT, 'force-app', 'main', 'default');
export const UTILS_ROOT = join(SFDX_WORKSPACE_ROOT, 'utils', 'meta');
export const REGISTERED_EMPTY_FOLDER_ROOT = join(SFDX_WORKSPACE_ROOT, 'registered-empty-folder', 'meta');
export const CORE_ALL_ROOT = isCommonPackage ? COMMON_CORE_ALL_ROOT : PACKAGE_CORE_ALL_ROOT;
export const CORE_PROJECT_ROOT = join(CORE_ALL_ROOT, 'ui-global-components');
export const CORE_MULTI_ROOT = [
  join(CORE_ALL_ROOT, 'ui-force-components'),
  join(CORE_ALL_ROOT, 'ui-global-components')
];

// Helper function to read file content safely
const readFileContent = (filePath: string): string => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (error) {
    console.warn(`Failed to read file ${filePath}:`, error);
  }
  return '';
};

// Helper function to recursively find all files in a directory
const findFilesRecursively = (dirPath: string, basePath: string, files: Record<string, string>): void => {
  try {
    if (!fs.existsSync(dirPath)) {
      return;
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        findFilesRecursively(fullPath, basePath, files);
      } else if (entry.isFile()) {
        const relativePath = fullPath.substring(basePath.length + 1);
        const content = readFileContent(fullPath);
        if (content) {
          files[relativePath] = content;
        }
      }
    }
  } catch {
    // Ignore errors when reading directories
  }
};

// Helper function to get all files from test-workspaces
const getTestWorkspaceFiles = (): Record<string, string> => {
  const files: Record<string, string> = {};

  // Read all files from the test workspace to match what fast-glob would find
  // This ensures the FileSystemDataProvider has all files that would be found by fast-glob
  findFilesRecursively(SFDX_WORKSPACE_ROOT, SFDX_WORKSPACE_ROOT, files);

  return files;
};

const languageId = (path: string): string => {
  const suffix = extname(path);
  if (!suffix) {
    return '';
  }
  switch (suffix.substring(1)) {
    case 'js':
      return 'javascript';
    case 'html':
      return 'html';
    case 'app':
    case 'cmp':
      return 'html'; // aura cmps
  }
  throw new Error(`todo: ${path}`);
};

export const readAsTextDocument = (path: string, fileSystemProvider: FileSystemDataProvider): TextDocument => {
  // Normalize path for cross-platform compatibility
  const uri = unixify(path);
  const content = fileSystemProvider.getFileContent(uri) ?? '';
  return TextDocument.create(uri, languageId(path), 0, content);
};

// File system structure constants for test workspaces
export const SFDX_WORKSPACE_STRUCTURE = {
  'sfdx-project.json': JSON.stringify({
    packageDirectories: [{ path: 'force-app', default: true }, { path: 'utils' }, { path: 'registered-empty-folder' }],
    namespace: '',
    sfdcLoginUrl: 'https://mobile1.t.salesforce.com',
    signupTargetLoginUrl: 'https://mobile1.t.salesforce.com',
    sourceApiVersion: '42.0'
  }),
  // Use dynamic content from test-workspaces
  ...getTestWorkspaceFiles(),
  // Add navmetadata.js for tag tests
  'javascript/__tests__/fixtures/navmetadata.js': `/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable */
import AccountObj from '@salesforce/schema/Account';
import { NavigationMixin } from 'lightning/navigation';
import { LightningElement, api } from 'lwc';

export default class NavMetadata extends NavigationMixin(LightningElement) {
    @api account;

    handleAccountClick() {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.account.Id,
                objectApiName: AccountObj.objectApiName,
                actionName: 'view',
            },
        });
    }
}`,
  // Add metadata.js for tag tests
  'javascript/__tests__/fixtures/metadata.js': `import { LightningElement, api, track, wire } from 'lwc';
import { fancyAdapterId, otherAdapterId } from 'local/foobar';
import myInitialValue from './relative/thing';

import apexMethodName from '@salesforce/apex/Namespace.Classname.apexMethodReference';

/** Foo doc */
export default class Foo extends LightningElement {
    _privateTodo;
    @api get todo () {
        return this._privateTodo;
    }
    set todo (val) {
        return this._privateTodo = val;
    }
    @api
    index;

    @api initializedAsApiNumber = 5;
    @track initializedAsTrackNumber = 5;

    @api indexSameLine;

    @api initializedWithImportedVal = myInitialValue;

    @api arrOfStuff = [1, 'a', false, undefined, null];

    @track
    trackedPrivateIndex;

    @api stringVal = 'foobar';
    @track trackedThing = 'withInitialValue';

    @track trackedArr = ['foo', 1, undefined, null];

    @api callback = () => {};

    @api fooNull = null;

    onclickAction() {
    }

    @api superComplex = {
        some: 'value',
        someOther: ['deep', 1, { value: 'here' }],
        andThen: null,
    };

    @api apiMethod() {
    }

    @wire(fancyAdapterId, { bar: 'baz', blip: 111 }) wiredProperty;
    @wire(fancyAdapterId, { bar: 'baz', blip: [111] }) wiredPropertyWithNestedParam;
    @wire(fancyAdapterId, { bar: 'baz', blip: { foo: 'bar' } }) wiredPropertyWithNestedObjParam;

    @wire(otherAdapterId, { foo: 'bar' })
    myWiredMethod(data) {
        // do something with data
    }

    @wire(apexMethodName, { searchKey: '$searchKey' }) apexWiredProperty;

    @wire(apexMethodName, { searchKey: '$searchKey' }) apexWiredInitVal = 5;

    @wire(apexMethodName, { searchKey: '$searchKey' }) apexWiredInitArr = [
        'hello',
        'world',
        12345,
        undefined,
        null,
        ['foo', 'bar'],
    ];

    get privateComputedValue() {
        return null;
    }

    methodWithArguments(a, b) {
    }
}

export { Foo };

export * from './something';`,
  // Add missing imports for metadata.js
  'javascript/__tests__/fixtures/relative/thing.js': "export default 'test value';",
  'javascript/__tests__/fixtures/something.js': "export const something = 'test';",
  'local/foobar.js': `export const fancyAdapterId = 'fancyAdapter';
export const otherAdapterId = 'otherAdapter';`,
  '@salesforce/apex/Namespace.Classname.apexMethodReference.js': `export default function apexMethodReference() {
    return Promise.resolve();
}`,
  // Add HTML and CSS files for metadata.js to make getAllLocations test pass
  'javascript/__tests__/fixtures/metadata.html': `<template>
    <div class="metadata-component">
        <h1>Metadata Component</h1>
        <p>This is a test component for metadata.js</p>
    </div>
</template>`,
  'javascript/__tests__/fixtures/metadata.css': `.metadata-component {
    padding: 1rem;
    background-color: #f0f0f0;
}

h1 {
    color: #333;
    font-size: 1.5rem;
}`,
  // Fallback content for files not found in test-workspaces
  'force-app/main/default/aura/helloWorldApp/helloWorldApp.app': `<aura:application>
    <c:hello_world />
    <br/>
    <c:import_relative></c:import_relative>
</aura:application>`,
  'force-app/main/default/aura/helloWorldApp/helloWorldApp.app-meta.xml':
    '<?xml version="1.0" encoding="UTF-8"?><AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata"></AuraDefinitionBundle>',
  'force-app/main/default/aura/todoApp/todoApp.app': `<aura:application>
    <ltng:require styles="{!$Resource.todocss}"/>
    <c:todo />
    <c:todoUtil>
    </c:todoUtil>
</aura:application>`,
  'force-app/main/default/aura/todoApp/todoApp.app-meta.xml':
    '<?xml version="1.0" encoding="UTF-8"?><AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata"></AuraDefinitionBundle>',
  'force-app/main/default/aura/wireLdsCmp/wireLdsCmp.cmp': `<aura:component implements="force:appHostable">
        <c:wire_lds/>
</aura:component>`,
  'force-app/main/default/aura/wireLdsCmp/wireLdsCmp.cmp-meta.xml':
    '<?xml version="1.0" encoding="UTF-8"?><AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata"></AuraDefinitionBundle>',
  'force-app/main/default/aura/indexApp/indexApp.app': '<aura:application></aura:application>',
  'force-app/main/default/aura/indexApp/indexApp.app-meta.xml':
    '<?xml version="1.0" encoding="UTF-8"?><AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata"></AuraDefinitionBundle>',
  'force-app/main/default/aura/lightningExamplesApp/lightningExamplesApp.app': '<aura:application></aura:application>',
  'force-app/main/default/aura/lightningExamplesApp/lightningExamplesApp.app-meta.xml':
    '<?xml version="1.0" encoding="UTF-8"?><AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata"></AuraDefinitionBundle>',
  'force-app/main/default/aura/lightningExamplesApp/lightningExamplesAppController.js': `
({
    helper: {
        helperMethod: function() {
            return "helper method";
        }
    },
    doInit: function(component, event, helper) {
        helper.helperMethod();
    }
})`,
  'force-app/main/default/aura/wireLdsApp/wireLdsApp.app': '<aura:application></aura:application>',
  'force-app/main/default/aura/wireLdsApp/wireLdsApp.app-meta.xml':
    '<?xml version="1.0" encoding="UTF-8"?><AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata"></AuraDefinitionBundle>',
  'force-app/main/default/labels/CustomLabels.labels-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">
    <labels>
        <fullName>TestLabel</fullName>
        <value>Test Value</value>
    </labels>
    <labels>
        <fullName>AnotherLabel</fullName>
        <value>Another Value</value>
    </labels>
</CustomLabels>`,
  'utils/meta/lwc/jsconfig.json': JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      target: 'es2017'
    },
    include: ['util/*.js']
  }),
  'registered-empty-folder/meta/lwc/jsconfig.json': JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      target: 'es2017'
    },
    include: ['**/*']
  }),
  // Add meta files for typingIndexer tests
  'force-app/main/default/contentassets/logo.asset-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Logo Asset</label>
</CustomObject>`,
  'force-app/main/default/messageChannels/Channel1.messageChannel-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Channel 1</label>
</CustomObject>`,
  'force-app/main/default/messageChannels/Channel2.messageChannel-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Channel 2</label>
</CustomObject>`,
  'force-app/main/default/staticresources/bike_assets.resource-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Bike Assets</label>
</CustomObject>`,
  'force-app/main/default/staticresources/todocss.resource-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Todo CSS</label>
</CustomObject>`,
  'utils/meta/staticresources/todoutil.resource-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Todo Util</label>
</CustomObject>`,
  // Add specific meta file for the test
  'force-app/main/default/staticresources/logo.resource-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Logo Resource</label>
</CustomObject>`,
  'utils/meta/lwc/jsconfig-orig.json': JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      target: 'es2017'
    },
    include: ['util/*.js']
  }),
  // Add component for lwcDataProvider test
  'force-app/main/default/lwc/test_component/test_component.js': `import { LightningElement, api } from 'lwc';

export default class TestComponent extends LightningElement {
    @api info;
    @api iconName;
    @api otherProperty;
}`,
  'force-app/main/default/lwc/test_component/test_component.js-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>58.0</apiVersion>
    <isExposed>true</isExposed>
</LightningComponentBundle>`,
  '.sfdx/typings/lwc/lds.d.ts': "declare module '@salesforce/lds' { /* LDS types */ }",
  '.sfdx/typings/lwc/engine.d.ts': "declare module '@salesforce/engine' { /* Engine types */ }",
  '.sfdx/typings/lwc/schema.d.ts': "declare module '@salesforce/schema' { /* Schema types */ }",
  '.sfdx/typings/lwc/apex.d.ts': "declare module '@salesforce/apex' { /* Apex types */ }"
};

export const STANDARD_WORKSPACE_STRUCTURE = {
  'package.json': JSON.stringify({
    name: 'lwc-example',
    version: '1.0.0',
    description: '',
    scripts: {
      postinstall:
        'rm -f static/js/engine.js; mkdir -p static/js; cp node_modules/@lwc/engine-dom/dist/umd/es2017/engine.js static/js/engine.js',
      lint: 'eslint *.js src/',
      build: 'cross-env NODE_ENV=development rollup -c',
      start: 'concurrently "npm run build -- --watch" "node server.js"'
    },
    devDependencies: {
      concurrently: '^3.5.0',
      'cross-env': '^5.1.0',
      eslint: '^4.9.0',
      'eslint-plugin-lwc': '^0.2.0',
      express: '^4.16.2',
      '@lwc/compiler': '8.16.0',
      '@lwc/engine-dom': '8.16.0',
      rollup: '^0.50.0',
      '@lwc/rollup-plugin': '8.16.0',
      'rollup-watch': '^4.3.1'
    }
  }),
  'lwc.config.json': JSON.stringify({
    modules: [{ dir: 'src/modules' }]
  }),
  'src/modules/example/app/app.html': '<template><div>Example App</div></template>',
  'src/modules/example/app/app.js': 'export default class App extends LightningElement {}',
  'static/index.html': '<!DOCTYPE html><html><head><title>LWC Example</title></head><body></body></html>'
};

export const CORE_WORKSPACE_STRUCTURE = {
  'workspace-user.xml': '<?xml version="1.0" encoding="UTF-8"?><workspace></workspace>',
  'ui-global-components/modules/one/app-nav-bar/app-nav-bar.html': '<template><div>App Nav Bar</div></template>',
  'ui-global-components/modules/one/app-nav-bar/app-nav-bar.js':
    'export default class AppNavBar extends LightningElement {}',
  'ui-global-components/modules/jsconfig.json': JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      target: 'es2017'
    },
    include: ['**/*']
  }),
  'ui-force-components/modules/force/input-phone/input-phone.html': '<template><div>Input Phone</div></template>',
  'ui-force-components/modules/force/input-phone/input-phone.js':
    'export default class InputPhone extends LightningElement {}',
  'ui-force-components/modules/jsconfig.json': JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      target: 'es2017'
    },
    include: ['**/*']
  }),
  'ui-force-components/tsconfig.json': JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      target: 'es2017'
    }
  }),
  'ui-other-components/modules/other/example-component/example-component.html':
    '<template><div>Example Component</div></template>',
  'ui-other-components/modules/other/example-component/example-component.js':
    'export default class ExampleComponent extends LightningElement {}',
  'ui-other-components/modules/jsconfig.json': JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      target: 'es2017'
    },
    include: ['**/*']
  }),
  '.vscode/typings/lwc/engine.d.ts': "declare module '@salesforce/engine' { /* Engine types */ }",
  '.vscode/typings/lwc/lds.d.ts': "declare module '@salesforce/lds' { /* LDS types */ }"
};

export const CORE_PARTIAL_WORKSPACE_STRUCTURE = {
  'modules/one/app-nav-bar/app-nav-bar.html': '<template><div>App Nav Bar</div></template>',
  'modules/one/app-nav-bar/app-nav-bar.js': 'export default class AppNavBar extends LightningElement {}',
  'modules/jsconfig.json': JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      target: 'es2017'
    }
  })
};

/** Helper function to populate FileSystemDataProvider with workspace structure */
export const populateFileSystemProvider = (
  fileSystemProvider: FileSystemDataProvider,
  workspacePath: string,
  structure: Record<string, string>
): void => {
  // Normalize workspace path for cross-platform compatibility
  const normalizedWorkspacePath = unixify(workspacePath);

  // First, create all directories
  const allPaths = Object.keys(structure);
  const directories = new Set<string>();

  // Extract all directory paths from file paths
  allPaths.forEach(filePath => {
    const pathParts = filePath.split('/');
    for (let i = 1; i < pathParts.length; i++) {
      const dirPath = pathParts.slice(0, i).join('/');
      directories.add(dirPath);
    }
  });

  // Create workspace root directory listing
  const workspaceRootEntries: DirectoryEntry[] = [];
  const rootLevelPaths = allPaths.filter(p => !p.includes('/'));
  const rootLevelDirs = allPaths.filter(p => p.includes('/') && !p.substring(0, p.indexOf('/')).includes('/'));
  const rootLevelItems = new Set([...rootLevelPaths, ...rootLevelDirs.map(p => p.substring(0, p.indexOf('/')))]);

  rootLevelItems.forEach(item => {
    workspaceRootEntries.push({
      name: item,
      type: item.includes('.') ? 'file' : 'directory',
      uri: unixify(join(normalizedWorkspacePath, item))
    });
  });

  if (workspaceRootEntries.length > 0) {
    fileSystemProvider.updateDirectoryListing(normalizedWorkspacePath, workspaceRootEntries);
  }

  // For CORE_PARTIAL detection, create parent workspace-user.xml file
  if (structure === CORE_PARTIAL_WORKSPACE_STRUCTURE) {
    const parentDir = unixify(resolve(normalizedWorkspacePath, '..'));
    const parentWorkspaceUserFile = unixify(join(parentDir, 'workspace-user.xml'));
    fileSystemProvider.updateFileStat(parentWorkspaceUserFile, {
      type: 'file',
      exists: true,
      ctime: 0,
      mtime: 0,
      size: 0
    });
    fileSystemProvider.updateFileContent(
      parentWorkspaceUserFile,
      '<?xml version="1.0" encoding="UTF-8"?><workspace></workspace>'
    );
  }

  // Add template files for SFDX configuration
  const jsconfigSfdxTemplate = JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      baseUrl: '.',
      paths: {
        'c/*': ['*']
      }
    },
    include: ['**/*', '<%= project_root %>/.sfdx/typings/lwc/**/*.d.ts'],
    typeAcquisition: {
      include: ['jest']
    }
  });

  const jsconfigSfdxPath = unixify(join(__dirname, '..', 'resources', 'sfdx', 'jsconfig-sfdx.json'));
  fileSystemProvider.updateFileStat(jsconfigSfdxPath, {
    type: 'file',
    exists: true,
    ctime: 0,
    mtime: 0,
    size: jsconfigSfdxTemplate.length
  });
  fileSystemProvider.updateFileContent(jsconfigSfdxPath, jsconfigSfdxTemplate);

  // Add typings files that the test expects to be created
  const ldsTypingsPath = unixify(join(__dirname, '..', 'resources', 'sfdx', 'lds.d.ts'));
  const ldsTypingsContent = 'declare module "@salesforce/lds" { /* LDS types */ }';
  fileSystemProvider.updateFileStat(ldsTypingsPath, {
    type: 'file',
    exists: true,
    ctime: 0,
    mtime: 0,
    size: ldsTypingsContent.length
  });
  fileSystemProvider.updateFileContent(ldsTypingsPath, ldsTypingsContent);

  const engineTypingsPath = unixify(join(__dirname, '..', 'resources', 'sfdx', 'engine.d.ts'));
  const engineTypingsContent = 'declare module "@salesforce/engine" { /* Engine types */ }';
  fileSystemProvider.updateFileStat(engineTypingsPath, {
    type: 'file',
    exists: true,
    ctime: 0,
    mtime: 0,
    size: engineTypingsContent.length
  });
  fileSystemProvider.updateFileContent(engineTypingsPath, engineTypingsContent);

  const schemaTypingsPath = unixify(join(__dirname, '..', 'resources', 'sfdx', 'schema.d.ts'));
  const schemaTypingsContent = 'declare module "@salesforce/schema" { /* Schema types */ }';
  fileSystemProvider.updateFileStat(schemaTypingsPath, {
    type: 'file',
    exists: true,
    ctime: 0,
    mtime: 0,
    size: schemaTypingsContent.length
  });
  fileSystemProvider.updateFileContent(schemaTypingsPath, schemaTypingsContent);

  const apexTypingsPath = unixify(join(__dirname, '..', 'resources', 'sfdx', 'apex.d.ts'));
  const apexTypingsContent = 'declare module "@salesforce/apex" { /* Apex types */ }';
  fileSystemProvider.updateFileStat(apexTypingsPath, {
    type: 'file',
    exists: true,
    ctime: 0,
    mtime: 0,
    size: apexTypingsContent.length
  });
  fileSystemProvider.updateFileContent(apexTypingsPath, apexTypingsContent);

  // Add Core template files
  const jsconfigCoreTemplate = JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      baseUrl: '.',
      paths: {
        'c/*': ['*']
      }
    },
    include: ['**/*', '<%= project_root %>/.vscode/typings/lwc/**/*.d.ts'],
    typeAcquisition: {
      include: ['jest']
    }
  });

  const jsconfigCorePath = unixify(join(__dirname, '..', 'resources', 'core', 'jsconfig-core.json'));
  fileSystemProvider.updateFileStat(jsconfigCorePath, {
    type: 'file',
    exists: true,
    ctime: 0,
    mtime: 0,
    size: jsconfigCoreTemplate.length
  });
  fileSystemProvider.updateFileContent(jsconfigCorePath, jsconfigCoreTemplate);

  // Add Core settings template
  const settingsCoreTemplate = JSON.stringify({
    'files.watcherExclude': {
      '**/.git/objects/**': true,
      '**/.git/subtree-cache/**': true,
      '**/node_modules/**': true
    },
    'perforce.client': 'username-localhost-blt',
    'perforce.user': 'username',
    'perforce.port': 'ssl:host:port'
  });

  const settingsCorePath = unixify(join(__dirname, '..', 'resources', 'core', 'settings-core.json'));
  fileSystemProvider.updateFileStat(settingsCorePath, {
    type: 'file',
    exists: true,
    ctime: 0,
    mtime: 0,
    size: settingsCoreTemplate.length
  });
  fileSystemProvider.updateFileContent(settingsCorePath, settingsCoreTemplate);

  // Add Core typings files for Core workspaces
  // For CORE_PARTIAL, the typings should be in the parent directory (CORE_ALL_ROOT)
  if (structure === CORE_PARTIAL_WORKSPACE_STRUCTURE) {
    const parentDir = unixify(resolve(normalizedWorkspacePath, '..'));
    const coreTypingsPath = unixify(join(parentDir, '.vscode', 'typings', 'lwc'));
    const coreEngineTypingsPath = unixify(join(coreTypingsPath, 'engine.d.ts'));
    const coreLdsTypingsPath = unixify(join(coreTypingsPath, 'lds.d.ts'));

    const coreEngineContent = "declare module '@salesforce/engine' { /* Engine types */ }";
    const coreLdsContent = "declare module '@salesforce/lds' { /* LDS types */ }";

    // Create directory
    fileSystemProvider.updateFileStat(coreTypingsPath, {
      type: 'directory',
      exists: true,
      ctime: 0,
      mtime: 0,
      size: 0
    });

    // Create engine.d.ts
    fileSystemProvider.updateFileStat(coreEngineTypingsPath, {
      type: 'file',
      exists: true,
      ctime: 0,
      mtime: 0,
      size: coreEngineContent.length
    });
    fileSystemProvider.updateFileContent(coreEngineTypingsPath, coreEngineContent);

    // Create lds.d.ts
    fileSystemProvider.updateFileStat(coreLdsTypingsPath, {
      type: 'file',
      exists: true,
      ctime: 0,
      mtime: 0,
      size: coreLdsContent.length
    });
    fileSystemProvider.updateFileContent(coreLdsTypingsPath, coreLdsContent);
  }

  // Create directory entries and stats
  directories.forEach(dirPath => {
    const fullDirPath = unixify(join(normalizedWorkspacePath, dirPath));

    fileSystemProvider.updateFileStat(fullDirPath, {
      type: 'directory',
      exists: true,
      ctime: 0,
      mtime: 0,
      size: 0
    });

    // Create directory listing
    const entries: DirectoryEntry[] = [];
    const childPaths = allPaths.filter(
      p => p.startsWith(`${dirPath}/`) && !p.substring(dirPath.length + 1).includes('/')
    );
    childPaths.forEach(childPath => {
      const childName = childPath.substring(dirPath.length + 1);
      entries.push({
        name: childName,
        type: childName.includes('.') ? 'file' : 'directory',
        uri: unixify(join(normalizedWorkspacePath, dirPath, childName))
      });
    });

    if (entries.length > 0) {
      fileSystemProvider.updateDirectoryListing(fullDirPath, entries);
    }
  });

  // Then, create all files with content
  Object.entries(structure).forEach(([filePath, content]) => {
    const fullFilePath = unixify(join(normalizedWorkspacePath, filePath));

    fileSystemProvider.updateFileStat(fullFilePath, {
      type: 'file',
      exists: true,
      ctime: 0,
      mtime: 0,
      size: content.length
    });

    fileSystemProvider.updateFileContent(fullFilePath, content);
  });
};

// Pre-configured file system providers for different workspace types
export const sfdxFileSystemProvider = new FileSystemDataProvider();
export const standardFileSystemProvider = new FileSystemDataProvider();
export const coreFileSystemProvider = new FileSystemDataProvider();
export const coreProjectFileSystemProvider = new FileSystemDataProvider();
export const coreMultiFileSystemProvider = new FileSystemDataProvider();

// Initialize the file system providers with their respective workspace structures
populateFileSystemProvider(sfdxFileSystemProvider, SFDX_WORKSPACE_ROOT, SFDX_WORKSPACE_STRUCTURE);
populateFileSystemProvider(
  standardFileSystemProvider,
  isCommonPackage
    ? resolve(__dirname, '..', '..', '..', '..', 'test-workspaces', 'standard-workspace')
    : resolve(__dirname, '..', '..', '..', '..', '..', 'test-workspaces', 'standard-workspace'),
  STANDARD_WORKSPACE_STRUCTURE
);
populateFileSystemProvider(coreFileSystemProvider, CORE_ALL_ROOT, CORE_WORKSPACE_STRUCTURE);
populateFileSystemProvider(coreProjectFileSystemProvider, CORE_PROJECT_ROOT, CORE_PARTIAL_WORKSPACE_STRUCTURE);

// Set up Core Multi workspace with multiple roots
populateFileSystemProvider(coreMultiFileSystemProvider, CORE_MULTI_ROOT[0], {
  'modules/force/input-phone/input-phone.html': '<template><div>Input Phone</div></template>',
  'modules/force/input-phone/input-phone.js': 'export default class InputPhone extends LightningElement {}',
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      target: 'es2017',
      module: 'commonjs'
    }
  })
});
populateFileSystemProvider(coreMultiFileSystemProvider, CORE_MULTI_ROOT[1], {
  'modules/one/app-nav-bar/app-nav-bar.html': '<template><div>App Nav Bar</div></template>',
  'modules/one/app-nav-bar/app-nav-bar.js': 'export default class AppNavBar extends LightningElement {}'
});

// Create parent workspace-user.xml for CORE_PARTIAL detection
const coreMultiParentDir = dirname(CORE_MULTI_ROOT[0]);
const coreMultiParentWorkspaceUserFile = join(coreMultiParentDir, 'workspace-user.xml');
coreMultiFileSystemProvider.updateFileStat(coreMultiParentWorkspaceUserFile, {
  type: 'file',
  exists: true,
  ctime: 0,
  mtime: 0,
  size: 0
});
coreMultiFileSystemProvider.updateFileContent(
  coreMultiParentWorkspaceUserFile,
  '<?xml version="1.0" encoding="UTF-8"?><workspace></workspace>'
);

// Add typings files for Core Multi test
const coreMultiTypingsPath = join(coreMultiParentDir, '.vscode', 'typings', 'lwc');
const coreMultiEngineTypingsPath = join(coreMultiTypingsPath, 'engine.d.ts');
const coreMultiLdsTypingsPath = join(coreMultiTypingsPath, 'lds.d.ts');

const coreMultiEngineContent = "declare module '@salesforce/engine' { /* Engine types */ }";
const coreMultiLdsContent = "declare module '@salesforce/lds' { /* LDS types */ }";

// Create directory
coreMultiFileSystemProvider.updateFileStat(coreMultiTypingsPath, {
  type: 'directory',
  exists: true,
  ctime: 0,
  mtime: 0,
  size: 0
});

// Create engine.d.ts
coreMultiFileSystemProvider.updateFileStat(coreMultiEngineTypingsPath, {
  type: 'file',
  exists: true,
  ctime: 0,
  mtime: 0,
  size: coreMultiEngineContent.length
});
coreMultiFileSystemProvider.updateFileContent(coreMultiEngineTypingsPath, coreMultiEngineContent);

// Create lds.d.ts
coreMultiFileSystemProvider.updateFileStat(coreMultiLdsTypingsPath, {
  type: 'file',
  exists: true,
  ctime: 0,
  mtime: 0,
  size: coreMultiLdsContent.length
});
coreMultiFileSystemProvider.updateFileContent(coreMultiLdsTypingsPath, coreMultiLdsContent);
