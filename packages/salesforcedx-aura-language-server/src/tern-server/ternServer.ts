/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { memoize } from '@salesforce/salesforcedx-lightning-lsp-common';
import { FileSystemDataProvider } from '@salesforce/salesforcedx-lightning-lsp-common/src/providers/fileSystemDataProvider';
import LineColumnFinder from 'line-column';
import path from 'node:path';
import * as util from 'node:util';
import {
    TextDocumentPositionParams,
    CompletionList,
    CompletionItem,
    Hover,
    Location,
    TextDocumentChangeEvent,
    CompletionParams,
    Position,
    Range,
    ReferenceParams,
    SignatureHelp,
    SignatureInformation,
    Definition,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import URI from 'vscode-uri';
import browser from '../tern/defs/browser.json';
import ecmascript from '../tern/defs/ecmascript.json';
import * as infer from '../tern/lib/infer';
import * as tern from '../tern/lib/tern';
import { findPreviousWord, findPreviousLeftParan, countPreviousCommas } from './stringUtil';

interface TernServer extends tern.Server {
    files: TernFile[];
    cx: any;
    normalizeFilename(file: string): string;
    /**
     * Register a file with the server. Note that files can also be included in requests. When using this
     * to automatically load a dependency, specify the name of the file (as Tern knows it) as the third
     * argument. That way, the file is counted towards the dependency budget of the root of its dependency graph.
     */
    addFile(name: string, text?: string, parent?: string): void;
    /** Unregister a file. */
    delFile(name: string): void;
    /** Forces all files to be fetched an analyzed, and then calls the callback function. */
    flush(callback: () => void): void;
    /**
     * Perform a request. `doc` is a (parsed) JSON document as described in the protocol documentation.
     * The `callback` function will be called when the request completes. If an `error` occurred,
     * it will be passed as a first argument. Otherwise, the `response` (parsed) JSON object will be passed as second argument.
     *
     * When the server hasn't been configured to be asynchronous, the callback will be called before request returns.
     */
    request(doc: any, callback: any): void;
}
interface TernFile {
    name: string;
    text: string;
}

let theRootPath: string;
let ternServer: TernServer;
let asyncTernRequest;
let asyncFlush;

const defaultConfig = {
    ecmaVersion: 6,
    stripCRs: false,
    disableLoadingLocal: true,
    verbose: true,
    debug: true,
    async: true,
    dependencyBudget: 20000,
};

const auraInstanceLastSort = (a: string, b: string): number =>
    a.endsWith('AuraInstance.js') === b.endsWith('AuraInstance.js') ? 0 : a.endsWith('AuraInstance.js') ? 1 : -1;

/** Recursively get all .js files from a directory using VS Code APIs */
const getJsFilesRecursively = async (dirPath: string, fileSystemProvider: FileSystemDataProvider): Promise<string[]> => {
    const files: string[] = [];

    const processDirectory = async (currentPath: string): Promise<void> => {
        try {
            const entries = fileSystemProvider.getDirectoryListing(currentPath);

            for (const entry of entries ?? []) {
                if (entry.type === 'directory') {
                    await processDirectory(path.join(currentPath, entry.name));
                } else if (entry.type === 'file' && entry.name.endsWith('.js')) {
                    files.push(path.join(currentPath, entry.name));
                }
            }
        } catch (error) {
            console.error('Error reading directory:', currentPath, error);
        }
    };

    await processDirectory(dirPath);
    return files;
};

const loadPlugins = async (): Promise<{ aura: true; modules: true; doc_comment: true }> => {
    await import('./ternAura');
    await import('../tern/plugin/modules');
    await import('../tern/plugin/doc_comment');

    return {
        aura: true,
        modules: true,
        doc_comment: true,
    };
};

/** recursively search upward from the starting directory. Handling the is it a monorepo vs. packaged vs. bundled code */
const searchAuraResourcesPath = async (dir: string, fileSystemProvider: FileSystemDataProvider): Promise<string> => {
    console.log(`aura-language-server: searching for resources/aura in ${dir}`);
    try {
        const resourcesPath = path.join(dir, 'resources', 'aura');
        const fileStat = fileSystemProvider.getFileStat(resourcesPath);
        if (!fileStat) {
            throw new Error('No resources/aura directory found');
        }
        console.log('found resources/aura in', dir);
        return resourcesPath;
    } catch {
        // Directory doesn't exist, continue searching
    }
    if (path.dirname(dir) === dir) {
        throw new Error('No resources/aura directory found');
    }
    return searchAuraResourcesPath(path.dirname(dir), fileSystemProvider);
};

const ternInit = async (fileSystemProvider: FileSystemDataProvider): Promise<void> => {
    await asyncTernRequest({
        query: {
            type: 'ideInit',
            unloadDefs: true,
            // shouldFilter: true,
        },
    });
    const resources = await searchAuraResourcesPath(__dirname, fileSystemProvider);
    const files = await getJsFilesRecursively(resources, fileSystemProvider);

    // special handling for hacking one snowflake file that needs to go last
    files.sort(auraInstanceLastSort);

    for (const file of files) {
        const content = fileSystemProvider.getFileContent(file);
        if (!content) {
            throw new Error('File not found');
        }

        const contents = file.endsWith('AuraInstance.js')
            ? // and the snowflake needs to be modified
              content.concat("\nwindow['$A'] = new AuraInstance();\n")
            : content;

        ternServer.addFile(file, contents);
    }
};

const init = (fileSystemProvider: FileSystemDataProvider) => memoize(() => ternInit(fileSystemProvider));

export { init };

export const startServer = async (rootPath: string, wsroot: string, fileSystemProvider: FileSystemDataProvider): Promise<tern.Server> => {
    const defs = [browser, ecmascript];
    const plugins = await loadPlugins();
    const config: tern.ConstructorOptions = {
        ...defaultConfig,
        defs,
        plugins,
        projectDir: rootPath,
        getFile: (filename: string, callback: (error: Error | undefined, content?: string) => void): void => {
            // note: this isn't invoked
            try {
                const content = fileSystemProvider.getFileContent(path.resolve(rootPath, filename));
                callback(undefined, content);
            } catch (error) {
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                callback(error as Error);
            }
        },
    };
    theRootPath = wsroot;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ternServer = new tern.Server(config) as TernServer;
    asyncTernRequest = util.promisify(ternServer.request.bind(ternServer));
    asyncFlush = util.promisify(ternServer.flush.bind(ternServer));

    // Don't initialize tern here - wait until fileSystemProvider is reconstructed
    // await init(fileSystemProvider)();

    return ternServer;
};

const lsp2ternPos = ({ line, character }: { line: number; character: number }): tern.Position => ({ line, ch: character });

const tern2lspPos = ({ line, ch }: { line: number; ch: number }): Position => ({ line, character: ch });

const fileToUri = (file: string): string => {
    if (path.isAbsolute(file)) {
        return URI.file(file).toString();
    } else {
        return URI.file(path.join(theRootPath, file)).toString();
    }
};

const uriToFile = (uri: string): string => {
    const parsedUri = URI.parse(uri);
    // paths from tests can be relative or absolute
    return parsedUri.scheme ? parsedUri.fsPath : uri;
};

const tern2lspRange = ({ start, end }: { start: tern.Position; end: tern.Position }): Range => ({
    start: tern2lspPos(start),
    end: tern2lspPos(end),
});

const tern2lspLocation = ({ file, start, end }: { file: string; start: tern.Position; end: tern.Position }): Location => ({
    uri: fileToUri(file),
    range: tern2lspRange({ start, end }),
});

const ternRequest = async (event: TextDocumentPositionParams, type: string, options: any = {}): Promise<any> =>
    await asyncTernRequest({
        query: {
            type,
            file: uriToFile(event.textDocument.uri),
            end: lsp2ternPos(event.position),
            lineCharPositions: true,
            ...options,
        },
    });

export const addFile = (event: TextDocumentChangeEvent<TextDocument>): void => {
    const { document } = event;
    ternServer.addFile(uriToFile(document.uri), document.getText());
};

export const delFile = (close: TextDocumentChangeEvent<TextDocument>): void => {
    const { document } = close;
    ternServer.delFile(uriToFile(document.uri));
};

export const onCompletion = async (completionParams: CompletionParams, fileSystemProvider: FileSystemDataProvider): Promise<CompletionList> => {
    try {
        await init(fileSystemProvider);
        await asyncFlush();

        const { completions } = await ternRequest(completionParams, 'completions', {
            types: true,
            docs: true,
            depths: true,
            guess: true,
            origins: true,
            urls: true,
            expandWordForward: true,
            caseInsensitive: true,
        });
        const items: CompletionItem[] = completions.map((completion) => {
            let kind = 18;
            if (completion.type?.startsWith('fn')) {
                kind = 3;
            }
            return {
                documentation: completion.doc,
                detail: completion.type,
                label: completion.name,
                kind,
            };
        });
        return {
            isIncomplete: true,
            items,
        };
    } catch (e: any) {
        if (e.message?.startsWith('No type found')) {
            return {
                isIncomplete: true,
                items: [],
            };
        }
        return {
            isIncomplete: true,
            items: [],
        };
    }
};

export const onHover = async (textDocumentPosition: TextDocumentPositionParams, fileSystemProvider: FileSystemDataProvider): Promise<Hover> => {
    try {
        await init(fileSystemProvider);
        await asyncFlush();
        const info = await ternRequest(textDocumentPosition, 'type');

        const out: string[] = [];
        out.push(`${info.exprName ?? info.name}: ${info.type}`);
        if (info.doc) {
            out.push(info.doc);
        }
        if (info.url) {
            out.push(info.url);
        }

        return { contents: out };
    } catch (e: any) {
        if (e.message?.startsWith('No type found')) {
            return { contents: [] };
        }
        return { contents: [] };
    }
};

export const onTypeDefinition = async (
    textDocumentPosition: TextDocumentPositionParams,
    fileSystemProvider: FileSystemDataProvider,
): Promise<Definition | undefined> => {
    const info = await ternRequest(textDocumentPosition, 'type');
    if (info?.origin) {
        try {
            const content = fileSystemProvider.getFileContent(info.origin);
            if (!content) {
                throw new Error('File not found');
            }
            const endCol = new LineColumnFinder(content, { origin: 0 }).fromIndex(content.length - 1);
            return {
                uri: fileToUri(info.origin),
                range: {
                    start: {
                        line: 0,
                        character: 0,
                    },
                    end: {
                        line: endCol?.line ?? 0,
                        character: endCol?.col ?? 0,
                    },
                },
            };
        } catch (error) {
            // Handle file read error
            console.error('Error reading file:', info.origin, error);
        }
    }
    return undefined;
};

export const onDefinition = async (
    textDocumentPosition: TextDocumentPositionParams,
    fileSystemProvider: FileSystemDataProvider,
): Promise<Location | undefined> => {
    try {
        await init(fileSystemProvider);
        await asyncFlush();
        const { file, start, end } = await ternRequest(textDocumentPosition, 'definition', { preferFunction: false, doc: false });
        if (file) {
            const responseURI = fileToUri(file);
            // check to see if the request position is inside the response object
            const requestURI = textDocumentPosition.textDocument.uri;
            if (
                responseURI === requestURI &&
                start?.line === textDocumentPosition.position.line &&
                textDocumentPosition.position.character >= start?.ch &&
                textDocumentPosition.position.character <= end?.ch
            ) {
                const typeDef = await onTypeDefinition(textDocumentPosition, fileSystemProvider);
                if (typeDef && 'uri' in typeDef && 'range' in typeDef) {
                    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                    return typeDef as Location;
                }
                return undefined;
            }
            if (file === 'Aura') {
                return undefined;
            } else if (file.includes('/resources/aura/')) {
                const slice = file.slice(file.indexOf('/resources/aura/'));
                const real = path.join(__dirname, '..', '..', slice);
                return {
                    uri: URI.file(real).toString(),
                    range: tern2lspRange({ start, end }),
                };
            }
            return tern2lspLocation({ file, start, end });
        }
    } catch (e: any) {
        if (e.message?.startsWith('No type found')) {
            return undefined;
        }
    }
    return undefined;
};

export const onReferences = async (reference: ReferenceParams, fileSystemProvider: FileSystemDataProvider): Promise<Location[] | undefined> => {
    await init(fileSystemProvider);
    await asyncFlush();
    const { refs } = await ternRequest(reference, 'refs');
    if (refs && refs.length > 0) {
        return refs.map((ref: any) => tern2lspLocation(ref));
    }
    return undefined;
};

export const onSignatureHelp = async (
    signatureParams: TextDocumentPositionParams,
    fileSystemProvider: FileSystemDataProvider,
): Promise<SignatureHelp | undefined> => {
    const {
        position,
        textDocument: { uri },
    } = signatureParams;
    try {
        await init(fileSystemProvider);
        await asyncFlush();
        const files = ternServer.files;
        const fileName = ternServer.normalizeFilename(uriToFile(uri));
        const file = files.find((f) => f.name === fileName);

        if (!file) {
            return undefined;
        }

        const contents = file.text;
        const offset = new LineColumnFinder(contents, { origin: 0 }).toIndex(position.line, position.character);
        const left = findPreviousLeftParan(contents, offset - 1);
        const word = findPreviousWord(contents, left);

        if (!word) {
            return undefined;
        }

        const info = await asyncTernRequest({
            query: {
                type: 'type',
                file: file.name,
                end: word.start,
                docs: true,
            },
        });

        const commas = countPreviousCommas(contents, offset - 1);
        const cx = ternServer.cx;
        let parsed: any;
        infer.withContext(cx, () => {
            const parser = new infer.def.TypeParser(info.type);
            parsed = parser.parseType(true);
        });

        const params = parsed.args.map((arg: any, index: number) => {
            const type = arg.getType();
            return {
                label: parsed.argNames[index],
                documentation: `${type.toString()}\n${type.doc ?? ''}`,
            };
        });

        const sig: SignatureInformation = {
            label: parsed.argNames[commas] ?? 'unknown param',
            documentation: `${info.exprName ?? info.name}: ${info.doc}`,
            parameters: params,
        };
        const sigs: SignatureHelp = {
            signatures: [sig],
            activeSignature: 0,
            activeParameter: commas,
        };
        return sigs;
    } catch {
        return undefined;
    }
};
