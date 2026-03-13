/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { FileStat } from '../types/fileSystemTypes';
import * as fs from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { LspFileSystemAccessor } from '../providers/lspFileSystemAccessor';
import { normalizePath } from '../utils';

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

// Repo root test-workspaces (when LWC/Aura tests run with workspace at repo root)
// From source: 7 up from common/src/__tests__ = repo; from out: 5 up from common/out/src/__tests__ = repo
const REPO_SFDX_WORKSPACE_ROOT_7 = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'test-workspaces',
  'sfdx-workspace'
);
const REPO_SFDX_WORKSPACE_ROOT_5 = resolve(
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
const normalizedDirname = __dirname.replaceAll('\\', '/');
const isCommonPackage = __dirname.includes('salesforcedx-lightning-lsp-common') && !normalizedDirname.includes('/out/');

// Normalize workspace roots to ensure consistent path format (especially Windows drive letter casing)
// This ensures paths match how files are stored in LspFileSystemAccessor (which normalizes paths)
export const SFDX_WORKSPACE_ROOT = normalizePath(
  isCommonPackage ? COMMON_SFDX_WORKSPACE_ROOT : PACKAGE_SFDX_WORKSPACE_ROOT
);
export const FORCE_APP_ROOT = normalizePath(join(SFDX_WORKSPACE_ROOT, 'force-app', 'main', 'default'));
export const UTILS_ROOT = normalizePath(join(SFDX_WORKSPACE_ROOT, 'utils', 'meta'));
export const REGISTERED_EMPTY_FOLDER_ROOT = normalizePath(join(SFDX_WORKSPACE_ROOT, 'registered-empty-folder', 'meta'));
export const CORE_ALL_ROOT = normalizePath(isCommonPackage ? COMMON_CORE_ALL_ROOT : PACKAGE_CORE_ALL_ROOT);
export const CORE_PROJECT_ROOT = normalizePath(join(CORE_ALL_ROOT, 'ui-global-components'));
export const CORE_MULTI_ROOT = [
  normalizePath(join(CORE_ALL_ROOT, 'ui-force-components')),
  normalizePath(join(CORE_ALL_ROOT, 'ui-global-components'))
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
  // This ensures the LspFileSystemAccessor has all files that would be found by fast-glob
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
  return '';
};

export const readAsTextDocument = async (
  path: string,
  fileSystemAccessor: LspFileSystemAccessor
): Promise<TextDocument> => {
  // Normalize path for cross-platform compatibility
  const normalizedPath = normalizePath(path);
  // Create a proper file:// URI for the TextDocument
  const uri = URI.file(normalizedPath).toString();
  const content = (await fileSystemAccessor.getFileContent(normalizedPath)) ?? '';
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
  // LWC todo / lightning_tree_example for lwcServerNode tests (createDocument uses structure in beforeAll)
  'force-app/main/default/lwc/todo/todo.html': `<template>
    <div>
        <section class="todoapp">
            <header class="header">
                <h1>todos</h1>
                <input class="new-todo"
                    autofocus
                    autocomplete="off"
                    placeholder="What needs to be done?"
                    onkeydown={handleKeyDown}
                />
            </header>
            <section if:true={hasTodos} class="main">
                <input class="toggle-all" type="checkbox" checked={isAllTodosCompleted} onclick={handleToggleAll} />
                <div class="todo-list">
                <template for:each={filteredTodos} for:item="todo">
                    <c-todo_item
                        key={todo.key}
                        todo={todo}
                        onremove={handleTodoRemove}
                        onupdate={handleTodoUpdate}
                        class="li"></c-todo_item>
                </template>
                </div>
            </section>
            <footer if:true={hasTodos} class="footer">
                <span class="todo-count">
                    <strong>{countTodos}</strong> {remainingItemsLabel} left
                </span>
                <ul class="filters">
                    <li><a href="#/all" class={allFilterStyle}>All</a></li>
                    <li><a href="#/active" class={activeFilterStyle}>Active</a></li>
                    <li><a href="#/completed" class={completedFilterStyle}>Completed</a></li>
                </ul>
                <button if:true={completedTodos.length} class="clear-completed" onclick={handleClearCompleted}>
                    Clear completed
                </button>
            </footer>
        </section>
        <footer class="info">
            <p>Double-click to edit a todo</p>
            <p><s>Part of <a href="http://todomvc.com">TodoMVC</a></s></p>
        </footer>
    </div>
    <div if:true={$has5Todos_today}></div>
</template>`,
  'force-app/main/default/lwc/todo/todo.js': `import { LightningElement, track } from 'lwc';
import { ENTER_KEY, guid } from 'c-utils';

// todo list filters. keys match <a href="#/[key]"> in template.
const FILTERS = {
    all: 'all',
    active: 'active',
    completed: 'completed',
};

function getCurrentFilter() {
    const rawHash = document.location.hash;
    const location = rawHash.replace(/#\\//, '');
    return FILTERS[location] || FILTERS.all;
}

export default class Todo extends LightningElement {
    @track todos;
    @track filter;
    has5Todos_today;
    $has5Todos_today;

    constructor() {
        super();
        this.filter = getCurrentFilter();
        window.addEventListener('hashchange', () => (
            this.filter = getCurrentFilter()
        ));
    }
    get hasTodos() {
        return !!this.todos.length;
    }

    get filteredTodos() {
        return this.todos.filter(todo => {
            switch (this.filter) {
                case FILTERS.active:
                    return !todo.completed;
                case FILTERS.completed:
                    return todo.completed;
                default:
                    return true;
            }
        });
    }

    get completedTodos() {
        return this.todos.filter(todo => todo.completed);
    }

    get countTodos() {
        return this.activeTodos.length;
    }

    get activeTodos() {
        return this.todos.filter(todo => !todo.completed);
    }

    get isAllTodosCompleted() {
        return this.todos.length === this.completedTodos.length;
    }

    get remainingItemsLabel() {
        return this.countTodos === 1 ? 'item' : 'items';
    }

    get allFilterStyle() {
        return this.filter === FILTERS.all ? 'selected' : '';
    }

    get activeFilterStyle() {
        return this.filter === FILTERS.active ? 'selected' : '';
    }

    get completedFilterStyle() {
        return this.filter === FILTERS.completed ? 'selected' : '';
    }

    setTodos(todos) {
        this.todos = todos;
    }

    addNewTodo(title) {
        if (!title) {
            return;
        }
        const completed = false;
        const key = guid();
        this.setTodos([...this.todos, {
            key,
            title,
            completed,
        }]);
    }

    handleKeyDown(evt) {
        if (evt.keyCode !== ENTER_KEY) {
            return;
        }
        const title = (evt.target.value || '').trim();
        evt.target.value = '';
        evt.preventDefault();
        this.addNewTodo(title);
    }

    handleTodoRemove({ target }) {
        this.setTodos(this.todos.filter(todo => todo !== target.todo));
    }

    handleTodoUpdate(evt) {
        const key = evt.target.todo.key;
        const todos = this.todos.map(todo => {
            if (todo.key === key) {
                return Object.assign({}, todo, evt.detail);
            }
            return todo;
        });
        this.setTodos(todos);
    }

    handleToggleAll({ target }) {
        this.setTodos(this.todos.map(todo => (
            Object.assign({}, todo, { completed: target.checked })
        )));
    }

    handleClearCompleted() {
        this.setTodos(this.todos.filter(todo => !todo.completed));
    }
}`,
  'force-app/main/default/lwc/todo_item/todo_item.html': `<template>
    <div class="view">
        <input class="toggle" type="checkbox" checked={todo.completed} onchange={handleCompletedInput}>
        <label ondblclick={handleEditModeInput}>{todo.title}</label>
        <button class="destroy" onclick={handleRemoveInput}></button>
    </div>
    <input class="edit" type="text" value={todo.title}
        onblur={handleBlur}
        onchange={handleTitleInput}
        onkeydown={handleKeyDown} />
</template>`,
  'force-app/main/default/lwc/todo_item/todo_item.js': `import { LightningElement, api, track } from 'lwc';
import { ENTER_KEY, ESCAPE_KEY } from 'c-utils';

/**
 * TodoItem doc
 */
export default class TodoItem extends LightningElement {
    @track
    editing = false;

    @track
    _todo;

    /** todo jsdoc */
    @api
    get todo() {
        return this._todo;
    }


    set todo(newValue) {
        this.classList[newValue.completed ? "add" : "remove"]("completed");
        this._todo = newValue;
    }

    @api sameLine;

    @api
    nextLine;

    fireUpdate() {
        const title = this.root.querySelector('input.edit').value.trim();
        const completed = this.root.querySelector('input.toggle').checked;
        const detail = { title, completed };
        const event = new CustomEvent('update', { detail });
        this.dispatchEvent(event);
    }

    fireRemove() {
        const event = new CustomEvent('remove');
        this.dispatchEvent(event);
    }

    handleCompletedInput() {
        this.fireUpdate();
    }

    handleRemoveInput() {
        this.fireRemove();
    }

    handleEditModeInput() {
        this.editing = true;
        this.classList.add('editing');
    }

    handleBlur() {
        this.editing = false;
        this.classList.remove('editing');
    }

    handleTitleInput(evt) {
        const title = evt.target.value.trim();
        if (!title) {
            this.fireRemove();
            return;
        }
        this.fireUpdate();
    }

    handleKeyDown(evt) {
        const { keyCode } = evt;
        if (keyCode === ENTER_KEY || keyCode === ESCAPE_KEY) {
            const el = this.root.querySelector('input.edit');
            if (keyCode === ESCAPE_KEY) {
                el.value = this.todo.title;
            }
            el.blur();
        }
    }

    renderedCallback() {
        if (this.editing) {
            this.root.querySelector('input.edit').focus();
        }
    }
}`,
  'force-app/main/default/lwc/lightning_tree_example/lightning_tree_example.html': `<template>
        <lightning-tree
            items={items}
            header="Roles">
        </lightning-tree>
</template>`,
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

// Pre-configured file system providers for different workspace types (InMemory so tests can populate/read without LSP)
export const sfdxFileSystemAccessor = new LspFileSystemAccessor();
export const standardFileSystemAccessor = new LspFileSystemAccessor();
export const coreFileSystemAccessor = new LspFileSystemAccessor();
export const coreProjectFileSystemAccessor = new LspFileSystemAccessor();
export const coreMultiFileSystemAccessor = new LspFileSystemAccessor();

// Populate SFDX accessor so performDelayedInitialization finds sfdx-project.json and component indexer can read files.
// Use all possible workspace roots so tests pass whether run from common, other packages, or repo root.
const sfdxRootsToPopulate = [
  COMMON_SFDX_WORKSPACE_ROOT,
  PACKAGE_SFDX_WORKSPACE_ROOT,
  REPO_SFDX_WORKSPACE_ROOT_7,
  REPO_SFDX_WORKSPACE_ROOT_5
];
for (const root of sfdxRootsToPopulate) {
  for (const [relPath, content] of Object.entries(SFDX_WORKSPACE_STRUCTURE)) {
    const fullPath = normalizePath(join(root, relPath.replaceAll('\\', '/')));
    void sfdxFileSystemAccessor.updateFileContent(fullPath, content);
  }
}

// Create parent workspace-user.xml for CORE_PARTIAL detection
const coreMultiParentDir = dirname(CORE_MULTI_ROOT[0]);
const coreMultiParentWorkspaceUserFile = join(coreMultiParentDir, 'workspace-user.xml');

void coreMultiFileSystemAccessor.updateFileContent(
  coreMultiParentWorkspaceUserFile,
  '<?xml version="1.0" encoding="UTF-8"?><workspace></workspace>'
);

// Add typings files for Core Multi test
const coreMultiTypingsPath = join(coreMultiParentDir, '.vscode', 'typings', 'lwc');
const coreMultiEngineTypingsPath = join(coreMultiTypingsPath, 'engine.d.ts');
const coreMultiLdsTypingsPath = join(coreMultiTypingsPath, 'lds.d.ts');

const coreMultiEngineContent = "declare module '@salesforce/engine' { /* Engine types */ }";
const coreMultiLdsContent = "declare module '@salesforce/lds' { /* LDS types */ }";

void coreMultiFileSystemAccessor.updateFileContent(coreMultiEngineTypingsPath, coreMultiEngineContent);

void coreMultiFileSystemAccessor.updateFileContent(coreMultiLdsTypingsPath, coreMultiLdsContent);

/** Mock file stat for getFileStat mocks. Use with DIR_STAT for directory paths. */
export const FILE_STAT: FileStat = { type: 'file', exists: true, ctime: 0, mtime: 0, size: 0 };
/** Mock directory stat for getFileStat mocks. */
export const DIR_STAT: FileStat = { type: 'directory', exists: true, ctime: 0, mtime: 0, size: 0 };

/**
 * Build a Map of absolute path -> content from SFDX_WORKSPACE_STRUCTURE.
 * Use for mocking getFileContent/getFileStat in tests (e.g. tag, componentIndexer, lwcContext).
 */
export const buildSfdxContentMap = (): Map<string, string> => {
  const map = new Map<string, string>();
  const root = normalizePath(SFDX_WORKSPACE_ROOT);
  for (const [rel, content] of Object.entries(SFDX_WORKSPACE_STRUCTURE as Record<string, string>)) {
    map.set(normalizePath(join(root, rel.replaceAll('\\', '/'))), content);
  }
  return map;
};

/** Relative paths (forward slashes) for the SFDX test workspace. Use with createMockWorkspaceFindFilesConnection(..., { relativePaths: getSfdxWorkspaceRelativePaths() }) when disk read is unavailable in test env. */
export const getSfdxWorkspaceRelativePaths = (): string[] =>
  Object.keys(SFDX_WORKSPACE_STRUCTURE).map(p => p.replaceAll('\\', '/'));

export { createMockWorkspaceFindFilesConnection } from './mockWorkspaceFindFiles';
