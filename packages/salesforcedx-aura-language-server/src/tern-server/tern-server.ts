import fs, { readFileSync } from 'fs';
import * as tern from '../tern/lib/tern';
import path from 'path';
import * as util from 'util';
import * as infer from '../tern/lib/infer';
import LineColumnFinder from 'line-column';
import { findPreviousWord, findPreviousLeftParan, countPreviousCommas } from './string-util';
import URI from 'vscode-uri';
import browser from '../tern/defs/browser.json';
import ecmascript from '../tern/defs/ecmascript.json';

import { memoize } from '@salesforce/salesforcedx-lightning-lsp-common';
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

const loadPlugins = async (): Promise<{ aura: true; modules: true; doc_comment: true }> => {
    await import('./tern-aura');
    await import('../tern/plugin/modules');
    await import('../tern/plugin/doc_comment');

    return {
        aura: true,
        modules: true,
        doc_comment: true,
    };
};

/** recursively search upward from the starting diretory.  Handling the is it a monorepo vs. packaged vs. bundled code  */
const searchAuraResourcesPath = (dir: string): string => {
    console.log(`aura-language-server: searching for resources/aura in ${dir}`);
    if (fs.existsSync(path.join(dir, 'resources', 'aura'))) {
        console.log('found resources/aura in', dir);
        return path.join(dir, 'resources', 'aura');
    }
    if (path.dirname(dir) === dir) {
        throw new Error('No resources/aura directory found');
    }
    return searchAuraResourcesPath(path.dirname(dir));
};

const ternInit = async (): Promise<void> => {
    await asyncTernRequest({
        query: {
            type: 'ideInit',
            unloadDefs: true,
            // shouldFilter: true,
        },
    });
    const resources = searchAuraResourcesPath(__dirname);
    (await fs.promises.readdir(resources, { withFileTypes: true, recursive: true }))
        .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.js'))
        .map((dirent) => path.join(dirent.parentPath, dirent.name))
        // special handling for hacking one snowflake file that needs to go last
        .sort(auraInstanceLastSort)
        .map((file) => ({
            file,
            contents: file.endsWith('AuraInstance.js')
                ? // and the snowflake needs to me modified
                  readFileSync(file, 'utf-8').concat(`\nwindow['$A'] = new AuraInstance();\n`)
                : readFileSync(file, 'utf-8'),
        }))
        .map(({ file, contents }) => ternServer.addFile(file, contents));
};

const init = memoize(ternInit);

export const startServer = async (rootPath: string, wsroot: string): Promise<tern.Server> => {
    const defs = [browser, ecmascript];
    const plugins = await loadPlugins();
    const config: tern.ConstructorOptions = {
        ...defaultConfig,
        defs,
        plugins,
        projectDir: rootPath,
        getFile(filename: string, callback: (error: Error | undefined, content?: string) => void): void {
            // note: this isn't invoked
            fs.readFile(path.resolve(rootPath, filename), 'utf8', callback);
        },
    };
    theRootPath = wsroot;
    ternServer = new tern.Server(config) as TernServer;
    asyncTernRequest = util.promisify(ternServer.request.bind(ternServer));
    asyncFlush = util.promisify(ternServer.flush.bind(ternServer));

    init();

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

export const addFile = (event: TextDocumentChangeEvent): void => {
    const { document } = event;
    ternServer.addFile(uriToFile(document.uri), document.getText());
};

export const delFile = (close: TextDocumentChangeEvent): void => {
    const { document } = close;
    ternServer.delFile(uriToFile(document.uri));
};

export const onCompletion = async (completionParams: CompletionParams): Promise<CompletionList> => {
    try {
        await init();
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
            if (completion.type && completion.type.startsWith('fn')) {
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
    } catch (e) {
        if (e.message && e.message.startsWith('No type found')) {
            return;
        }
        return {
            isIncomplete: true,
            items: [],
        };
    }
};

export const onHover = async (textDocumentPosition: TextDocumentPositionParams): Promise<Hover> => {
    try {
        await init();
        await asyncFlush();
        const info = await ternRequest(textDocumentPosition, 'type');

        const out = [];
        out.push(`${info.exprName || info.name}: ${info.type}`);
        if (info.doc) {
            out.push(info.doc);
        }
        if (info.url) {
            out.push(info.url);
        }

        return { contents: out };
    } catch (e) {
        if (e.message && e.message.startsWith('No type found')) {
            return;
        }
    }
};

export const onTypeDefinition = async (textDocumentPosition: TextDocumentPositionParams): Promise<Definition> => {
    const info = await ternRequest(textDocumentPosition, 'type');
    if (info && info.origin) {
        const contents = fs.readFileSync(info.origin, 'utf-8');
        const endCol = new LineColumnFinder(contents, { origin: 0 }).fromIndex(contents.length - 1);
        return {
            uri: fileToUri(info.origin),
            range: {
                start: {
                    line: 0,
                    character: 0,
                },
                end: {
                    line: endCol.line,
                    character: endCol.col,
                },
            },
        };
    }
};

export const onDefinition = async (textDocumentPosition: TextDocumentPositionParams): Promise<Location> => {
    try {
        await init();
        await asyncFlush();
        const { file, start, end } = await ternRequest(textDocumentPosition, 'definition', { preferFunction: false, doc: false });
        if (file) {
            const responseURI = fileToUri(file);
            // check to see if the request position is inside the response object
            const requestURI = textDocumentPosition.textDocument.uri;
            if (
                responseURI === requestURI &&
                start.line === textDocumentPosition.position.line &&
                textDocumentPosition.position.character >= start.ch &&
                textDocumentPosition.position.character <= end.ch
            ) {
                return onTypeDefinition(textDocumentPosition) as any;
            }
            if (file === 'Aura') {
                return;
            } else if (file.indexOf('/resources/aura/') >= 0) {
                const slice = file.slice(file.indexOf('/resources/aura/'));
                const real = path.join(__dirname, '..', '..', slice);
                return {
                    uri: URI.file(real).toString(),
                    range: tern2lspRange({ start, end }),
                };
            }
            return tern2lspLocation({ file, start, end });
        }
    } catch (e) {
        if (e.message && e.message.startsWith('No type found')) {
            return;
        }
    }
};

export const onReferences = async (reference: ReferenceParams): Promise<Location[]> => {
    await init();
    await asyncFlush();
    const { refs } = await ternRequest(reference, 'refs');
    if (refs && refs.length > 0) {
        return refs.map((ref) => tern2lspLocation(ref));
    }
};

export const onSignatureHelp = async (signatureParams: TextDocumentPositionParams): Promise<SignatureHelp> => {
    const {
        position,
        textDocument: { uri },
    } = signatureParams;
    try {
        await init();
        await asyncFlush();
        const files = ternServer.files;
        const fileName = ternServer.normalizeFilename(uriToFile(uri));
        const file = files.find((f) => f.name === fileName);

        const contents = file.text;

        const offset = new LineColumnFinder(contents, { origin: 0 }).toIndex(position.line, position.character);

        const left = findPreviousLeftParan(contents, offset - 1);
        const word = findPreviousWord(contents, left);

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
        let parsed;
        infer.withContext(cx, () => {
            const parser = new infer.def.TypeParser(info.type);
            parsed = parser.parseType(true);
        });

        const params = parsed.args.map((arg, index) => {
            const type = arg.getType();
            return {
                label: parsed.argNames[index],
                documentation: type.toString() + '\n' + (type.doc || ''),
            };
        });

        const sig: SignatureInformation = {
            label: parsed.argNames[commas] || 'unknown param',
            documentation: `${info.exprName || info.name}: ${info.doc}`,
            parameters: params,
        };
        const sigs: SignatureHelp = {
            signatures: [sig],
            activeSignature: 0,
            activeParameter: commas,
        };
        return sigs;
    } catch (e) {
        // ignore
    }
};
