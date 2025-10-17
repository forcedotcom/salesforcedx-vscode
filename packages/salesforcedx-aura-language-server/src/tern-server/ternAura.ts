/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as walk from 'acorn-walk';
import * as vscode from 'vscode';
import * as infer from '../tern/lib/infer';
import * as tern from '../tern/lib/tern';
import defs from './aura_types.json';

const WG_DEFAULT_EXPORT = 95;
let server: any = {};

let shouldFilter = false;
/* this is necessary to inform the parameter types of the controller when
    the helper method is deleted */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
const ForAllProps_Purgeable = infer.constraint({
    construct(c) {
        this.c = c;
    },
    addType(type) {
        if (!(type instanceof infer.Obj)) {
            return;
        }
        type.forAllProps(this.c);
    },
    purge(test) {
        if (this.sources) {
            for (const source of this.sources) {
                source.purge(test);
            }
        }
    },
    addSource(source) {
        this.sources ??= [];
        this.sources.push(source);
    },
});

const getFilename = (filename: string): string => {
    if (server.options.projectDir.endsWith('/')) {
        return server.options.projectDir + filename;
    }
    return `${server.options.projectDir}/${filename}`;
};

const isBlocklisted = (filename: string): boolean => {
    let ret = filename.endsWith('/scrollerLib/bootstrap.js');
    ret = ret ?? filename.endsWith('ExportSymbolsHelper.js');
    return ret;
};

const readFile = async (filename: string): Promise<string> => {
    let normalized = filename;
    if (!normalized.startsWith('/')) {
        normalized = getFilename(normalized);
    }

    if (isBlocklisted(normalized)) {
        return '';
    }

    try {
        const uri = vscode.Uri.file(normalized);
        const content = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder().decode(content);
    } catch {
        // Handle file not found or other errors
        return '';
    }
};

const baseName = (path: string): string => {
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) {
        return path;
    } else {
        return path.slice(lastSlash + 1);
    }
};

const trimExt = (path: string): string => {
    const lastDot = path.lastIndexOf('.');
    if (lastDot === -1) {
        return path;
    } else {
        return path.slice(0, lastDot);
    }
};

const initScope = (scope: any): void => {
    const module = new infer.Obj();
    module.propagate(scope.defProp('module'));
    const exports = new infer.Obj(true);
    module.origin = exports.origin = scope.origin;
    module.originNode = exports.originNode = scope.originNode;
    exports.propagate(scope.defProp('exports'));
    const moduleExports = (scope.exports = module.defProp('exports'));
    exports.propagate(moduleExports, WG_DEFAULT_EXPORT);
};

const getName = (name: string, type: string): string => {
    const newname = name.replace(/Controller.js$|Helper.js$|Renderer.js$|Test.js$/, '') + type;
    return newname;
};

const getController = (name: string): string => getName(name, 'Controller.js');

const getHelper = (name: string): string => getName(name, 'Helper.js');

const getRenderer = (name: string): string => getName(name, 'Renderer.js');

const resolver = (file: any): any => file;

const unloadDefs = (): void => {
    server.deleteDefs('Aura');
};

const readFileAsync = async (filename: string, c: (err: any, contents: string) => void): Promise<void> => {
    await readFile(filename).then((contents) => {
        c(null, contents);
    });
};

const findAndBindComponent = (type: any, _server: any, cx: any, infr: any): void => {
    const evs = cx.props['Component'];
    if (!evs) {
        return;
    }
    for (const y of evs) {
        if (y.name === 'Aura.Component') {
            const obj = y.props['Component'].types[0].props['prototype'].getObjType();
            const int = infr.getInstance(obj);
            int.propagate(type);
        }
    }
};

const findAndBindHelper = (type: any, servr: any, modules: any, file: any): void => {
    const helperFile = getHelper(file.name);

    const bn = trimExt(baseName(helperFile));
    const r = servr.findFile(helperFile);
    if (!r) {
        servr.addFile(helperFile);
    }
    const helper = modules.resolveModule(helperFile);
    //  console.log("Resolved module" + helperFile);
    //  console.dir(helper);
    const hp = helper.getProp(bn);
    if (!hp.getType()) {
        // this handles new props added to the helper...
        helper.on('addType', (helperType, _val) => {
            const p = new ForAllProps_Purgeable((prop, val, _local) => {
                if (bn === prop) {
                    val.propagate(type);
                }
            });
            p.addSource(type);
            helperType.propagate(p);
        });
    } else {
        // now we need to handle there were changes to the .cmp,
        // but not the helper,
        const p = new ForAllProps_Purgeable((prop, val, _local) => {
            if (bn === prop) {
                val.propagate(type);
            }
        });
        p.addSource(type);
        helper.propagate(p);
    }
};

const findAndBindEvent = (type: any, _server: any, cx: any, infr: any): void => {
    // this is slightly hacky, but have no idea how to get the event Otherwise
    const evs = cx.props['Event'];
    if (!evs) {
        return;
    }
    for (const y of evs) {
        if (y.name === 'Aura.Event') {
            const obj = y.props['Event'].types[0].props['prototype'].getObjType();
            const int = infr.getInstance(obj);
            int.propagate(type);
        }
    }
};

const ternError = (msg: string): Error => {
    const err = new Error(msg);
    err.name = 'TernError';
    return err;
};

const connectModule = async (file: any, out: any): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (isBlocklisted(file.name)) {
        return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    server.startAsyncAction();
    const modules = infer.cx().parent.mod.modules;
    const cx = infer.cx();
    console.log(`Starting... ${file.name}`);
    if (/Helper.js$/.test(file.name)) {
        // need to reestablish server context after awaits
        infer.withContext(server.cx, () => {
            console.log(`Process helper exports ${file.name}`);
            let outObj;
            if (!out.getType()) {
                const type = baseName(file.name).replace(/.js$/, '');
                outObj = new infer.Obj(true);
                outObj.origin = file.name;
                outObj.originNode = file.ast;
                outObj.name = type;
                out.addType(outObj);
            } else {
                outObj = out.getType();
            }
            try {
                walk.simple(
                    file.ast,
                    {
                        ObjectExpression: (node, _state) => {
                            const parent = infer.parentNode(node, file.ast);
                            const grand = infer.parentNode(parent, file.ast);
                            if (grand.type === 'Program') {
                                // add some jsdoc
                                // @ts-ignore - objType is a custom tern property
                                if (node.objType) {
                                    // @ts-ignore - objType is a custom tern property
                                    node.objType.doc =
                                        'A helper resource contains functions that can be reused by your JavaScript code in the component bundle. ';
                                }
                                //  node.objType.forAllProps( function(prop, val, local) {
                                //    val.propagate(outObj.defProp(prop));
                                //    });
                                // -- would have worked, but didnt'
                                // delete all types, and re-add...
                                const target = outObj.defProp(baseName(file.name).replace(/.js$/, ''));
                                const types = target.types;
                                types.length = 0;
                                //note: propogate calls addType on the target
                                // todo: this could be made more efficient with a custom propogation strategy
                                // similar to ForAllProps_Purgeable
                                // @ts-ignore - objType is a custom tern property
                                if (node.objType) {
                                    try {
                                        // @ts-ignore - objType is a custom tern property
                                        node.objType.propagate(target);
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }
                                //outObj.defProp(baseName(file.name).replace(/.js$/, ''))
                                // eslint-disable-next-line no-throw-literal
                                throw 'stop';
                            }
                        },
                    },
                    infer.searchVisitor,
                );
            } catch (stop) {
                if (stop !== 'stop') {
                    console.error(stop);
                    throw stop;
                }
            }
        });
        // We should also make sure that the controller is all up to date too...
        const controller = getController(file.name);
        try {
            const text = await readFile(controller);
            const sfile = server.findFile(controller);
            if (!sfile || sfile.text !== text) {
                server.addFile(controller, text);
            }
        } catch {}
        const renderer = getRenderer(file.name);
        try {
            const text = await readFile(renderer);
            const sfile = server.findFile(renderer);
            if (!sfile || sfile.text !== text) {
                server.addFile(renderer, text);
            }
        } catch {}
    }
    // reestablish scope after awaits
    infer.withContext(server.cx, () => {
        console.log(`Fixing scopes...${file.name}`);
        walk.simple(file.ast, {
            ObjectExpression: (node, _state) => {
                const parent = infer.parentNode(node, file.ast);
                const grand = infer.parentNode(parent, file.ast);
                if (grand.type === 'Program') {
                    for (const property of node.properties) {
                        // @ts-ignore - Property type narrowing
                        if (property.value.type === 'FunctionExpression') {
                            // @ts-ignore - Property type narrowing
                            const val = property.value;
                            const fn = val?.scope?.fnType;
                            if (!fn?.name) {
                                continue;
                            }

                            if (/Renderer.js$/.test(file.name)) {
                                //step 2, assign exported type to params
                                const cmp = fn.args[0];
                                const hlp = fn.args[1];
                                if (cmp) {
                                    findAndBindComponent(cmp, server, cx, infer);
                                }
                                if (hlp) {
                                    findAndBindHelper(hlp, server, modules, file);
                                }
                            } else if (/Helper.js$/.test(file.name)) {
                                //step 2, assign exported type to params
                                const cmp = fn.args[0];
                                if (cmp) {
                                    findAndBindComponent(cmp, server, cx, infer);
                                }
                            } else if (/Controller.js$/.test(file.name)) {
                                //step 2, assign exported type to params
                                const cmp = fn.args[0];
                                const evt = fn.args[1];
                                const hlp = fn.args[2];
                                if (evt) {
                                    findAndBindEvent(evt, server, cx, infer);
                                }
                                if (cmp) {
                                    findAndBindComponent(cmp, server, cx, infer);
                                }
                                if (hlp) {
                                    findAndBindHelper(hlp, server, modules, file);
                                }
                            }
                        }
                    }
                }
            },
        });
        console.log(`All done ${file.name}`);
    });

    server.finishAsyncAction();
};

tern.registerPlugin('aura', (s, _options) => {
    server = s;
    if (!server.options.async) {
        throw Error('Server must be async');
    }
    server.options.getFile = readFileAsync;
    server.loadPlugin('modules');
    server.mod.modules.on('wrapScope', initScope);
    server.mod.modules.on('getExports', connectModule);
    server.mod.modules.resolvers.push(resolver);
    let currentQuery;

    server.on('completion', (file, query) => {
        // don't hijack the request to retrieve the standard completions
        if (currentQuery === query) {
            return;
        }
        currentQuery = query;
        // request the standard completions
        let filteredResult;
        query.docFormat = 'full';
        server.request(
            {
                query,
            },
            (err: any, result: any) => {
                if (err) {
                    console.log(err);
                }
                if (shouldFilter) {
                    result.completions = result.completions.filter((completion, _index, _array) => {
                        const accepted = (completion.doc?.includes('@platform') && completion.origin === 'Aura') ?? completion.origin !== 'Aura';
                        if (accepted && completion.doc) {
                            completion.doc = completion.doc.split('\n@')[0];
                            completion.doc = completion.doc.replace('@description', '');
                        }
                        return accepted;
                    });
                }
                filteredResult = result;
                // reset for future queries
                currentQuery = undefined;
            },
        );
        return filteredResult;
    });

    console.log('IDE mode');
    server.addDefs(defs);

    console.log(`${new Date().toISOString()} Done loading!`);
});

tern.defineQueryType('ideInit', {
    run: (_server: any, query: any) => {
        if (query.unloadDefs) {
            unloadDefs();
            console.log('Unloaded default Aura defs');
        }

        if (query.shouldFilter === true || query.shouldFilter === false) {
            shouldFilter = query.shouldFilter;
        }
        return 'OK';
    },
});

tern.defineQueryType('cleanup-file', {
    run: (_server: any, query: any) => {
        const files = query.files;
        files.forEach((f) => {
            let ff = f;
            if (ff.startsWith('/')) {
                ff = ff.slice(1);
            }
            const m = server.mod.modules.modules[ff];
            if (m) {
                m.purge((type) => {
                    if (type instanceof ForAllProps_Purgeable) {
                        return false;
                    } else {
                        if (type.origin && type.origin === ff) {
                            return true;
                        }
                    }
                    return false;
                });
                delete server.mod.modules.modules[ff];
            }
        });
        return 'OK';
    },
});

tern.defineQueryType('guess-types', {
    takesFile: true,
    run: (_server: any, query: any, file: any) => {
        if (!query.end) {
            throw ternError('missing .query.end field');
        }

        if (!query.property) {
            throw ternError('missing .query.property field');
        }

        const start = tern.resolvePos(file, query.end);
        const types: { property: string; type: string; depth: number }[] = [];

        const gather = (prop: string, obj: any, depth: number): void => {
            const val = obj.props[prop];
            const type = infer.toString(val.getType()) ?? 'unknown';
            types.push({
                property: prop,
                type,
                // The following causes J2V8 to crash
                //parent: obj.getType(),
                depth,
            });
        };

        infer.forAllLocalsAt(file.ast, start, file.scope, gather);
        return {
            locals: types,
        };
    },
});

tern.defineQueryType('reset', {
    takesFile: false,
    run: (servr: any, _query: any, _file: any) => {
        servr.reset();
        return 'OK';
    },
});
