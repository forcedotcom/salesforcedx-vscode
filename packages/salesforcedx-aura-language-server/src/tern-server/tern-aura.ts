/* eslint-disable @typescript-eslint/no-unused-vars */
import * as infer from '../tern/lib/infer';
import * as tern from '../tern/lib/tern';
import * as walk from 'acorn-walk';
import * as fs from 'fs';
import defs from './aura_types.json';

const WG_DEFAULT_EXPORT = 95;
let server: any = {};

let shouldFilter = false;
/* this is necessary to inform the parameter types of the controller when
    the helper method is deleted */
const ForAllProps_Purgeable = infer.constraint({
    construct: function (c) {
        this.c = c;
    },
    addType: function (type) {
        if (!(type instanceof infer.Obj)) {
            return;
        }
        type.forAllProps(this.c);
    },
    purge: function (test) {
        if (this.sources) {
            for (let i = 0; i < this.sources.length; i++) {
                this.sources[i].purge(test);
            }
        }
    },
    addSource: function (source) {
        if (!this.sources) {
            this.sources = [];
        }
        this.sources.push(source);
    },
});

const getFilename = (filename): string => {
    if (server.options.projectDir.endsWith('/')) {
        return server.options.projectDir + filename;
    }
    return server.options.projectDir + '/' + filename;
};

const isBlocklisted = (filename): any => {
    let ret = filename.endsWith('/scrollerLib/bootstrap.js');
    ret = ret || filename.endsWith('ExportSymbolsHelper.js');
    return ret;
};

const readFile = async (filename): Promise<string> => {
    let normalized = filename;
    if (!normalized.startsWith('/')) {
        normalized = getFilename(normalized);
    }

    if (isBlocklisted(normalized)) {
        return '';
    }

    try {
        return fs.readFileSync(normalized, 'utf-8');
    } catch (e) {
        if (e.code === 'ENOENT') {
            return '';
        }
        throw e;
    }
};

const baseName = (path): any => {
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) {
        return path;
    } else {
        return path.slice(lastSlash + 1);
    }
};

const trimExt = (path): any => {
    const lastDot = path.lastIndexOf('.');
    if (lastDot === -1) {
        return path;
    } else {
        return path.slice(0, lastDot);
    }
};

const initScope = (scope): void => {
    const module = new infer.Obj();
    module.propagate(scope.defProp('module'));
    const exports = new infer.Obj(true);
    module.origin = exports.origin = scope.origin;
    module.originNode = exports.originNode = scope.originNode;
    exports.propagate(scope.defProp('exports'));
    const moduleExports = (scope.exports = module.defProp('exports'));
    exports.propagate(moduleExports, WG_DEFAULT_EXPORT);
};

const getName = (name, type): string => {
    const newname = name.replace(/Controller.js$|Helper.js$|Renderer.js$|Test.js$/, '') + type;
    return newname;
};

const getController = (name): string => getName(name, 'Controller.js');

const getHelper = (name): string => getName(name, 'Helper.js');

const getRenderer = (name): string => getName(name, 'Renderer.js');

const resolver = (file, parent): any => file;

const unloadDefs = (): void => {
    server.deleteDefs('Aura');
};

const readFileAsync = (filename, c): void => {
    readFile(filename).then(function (contents) {
        c(null, contents);
    });
};

const findAndBindComponent = (type, server, cx, infer): void => {
    const evs = cx.props['Component'];
    if (!evs) {
        return;
    }
    for (let z = 0; z < evs.length; z++) {
        const y = evs[z];
        if (y.name === 'Aura.Component') {
            const obj = y.props['Component'].types[0].props['prototype'].getObjType();
            const int = infer.getInstance(obj);
            int.propagate(type);
        }
    }
};

const findAndBindHelper = (type, server, modules, file): void => {
    const helperFile = getHelper(file.name);

    const bn = trimExt(baseName(helperFile));
    const r = server.findFile(helperFile);
    if (!r) {
        server.addFile(helperFile);
    }
    const helper = modules.resolveModule(helperFile);
    //  console.log("Resolved module" + helperFile);
    //  console.dir(helper);
    const hp = helper.getProp(bn);
    if (!hp.getType()) {
        // this handles new props added to the helper...
        helper.on('addType', function (helperType, val) {
            const p = new ForAllProps_Purgeable(function (prop, val, local) {
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
        const p = new ForAllProps_Purgeable(function (prop, val, local) {
            if (bn === prop) {
                val.propagate(type);
            }
        });
        p.addSource(type);
        helper.propagate(p);
    }
};

const findAndBindEvent = (type, server, cx, infer): void => {
    // this is slightly hacky, but have no idea how to get the event Otherwise
    const evs = cx.props['Event'];
    if (!evs) {
        return;
    }
    for (let z = 0; z < evs.length; z++) {
        const y = evs[z];
        if (y.name === 'Aura.Event') {
            const obj = y.props['Event'].types[0].props['prototype'].getObjType();
            const int = infer.getInstance(obj);
            int.propagate(type);
        }
    }
};

const ternError = (msg): Error => {
    const err = new Error(msg);
    err.name = 'TernError';
    return err;
};

const connectModule = async (file, out): Promise<void> => {
    if (isBlocklisted(file.name)) {
        return;
    }

    server.startAsyncAction();
    const modules = infer.cx().parent.mod.modules;
    const cx = infer.cx();
    console.log('Starting... ' + file.name);
    if (/Helper.js$/.test(file.name)) {
        // need to reestablish server context after awaits
        infer.withContext(server.cx, function () {
            console.log('Process helper exports ' + file.name);
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
                        ObjectExpression: function (node, state) {
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
                                while (types.length) {
                                    types.pop();
                                }
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
        } catch (ignore) {}
        const renderer = getRenderer(file.name);
        try {
            const text = await readFile(renderer);
            const sfile = server.findFile(renderer);
            if (!sfile || sfile.text !== text) {
                server.addFile(renderer, text);
            }
        } catch (ignore) {}
    }
    // reestablish scope after awaits
    infer.withContext(server.cx, function () {
        console.log('Fixing scopes...' + file.name);
        walk.simple(file.ast, {
            ObjectExpression: function (node, state) {
                const parent = infer.parentNode(node, file.ast);
                const grand = infer.parentNode(parent, file.ast);
                if (grand.type === 'Program') {
                    for (let i = 0; i < node.properties.length; ++i) {
                        // @ts-ignore - Property type narrowing
                        if (node.properties[i].value.type === 'FunctionExpression') {
                            // @ts-ignore - Property type narrowing
                            const val = node.properties[i].value;
                            const fn = val && val.scope && val.scope.fnType;
                            if (!fn || !fn.name) {
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
        console.log('All done ' + file.name);
    });

    server.finishAsyncAction();
};

tern.registerPlugin('aura', function (s, options) {
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

    server.on('completion', function (file, query) {
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
                query: query,
            },
            function (err, result) {
                if (err) {
                    console.log(err);
                }
                if (shouldFilter) {
                    result.completions = result.completions.filter(function (completion, index, array) {
                        const accepted =
                            (completion.doc && completion.doc.indexOf('@platform') !== -1 && completion.origin === 'Aura') || completion.origin !== 'Aura';
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

    console.log(new Date().toISOString() + ' Done loading!');
});

tern.defineQueryType('ideInit', {
    run: function (server, query) {
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
    run: function (server, query) {
        const files = query.files;
        files.forEach(function (f) {
            let ff = f;
            if (ff.startsWith('/')) {
                ff = ff.slice(1);
            }
            const m = server.mod.modules.modules[ff];
            if (m) {
                m.purge(function (type) {
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
    run: function (server, query, file) {
        if (!query.end) {
            throw ternError('missing .query.end field');
        }

        if (!query.property) {
            throw ternError('missing .query.property field');
        }

        const start = tern.resolvePos(file, query.end);
        const types = [];

        const gather = (prop, obj, depth): void => {
            const val = obj.props[prop];
            const type = infer.toString(val.getType());
            types.push({
                property: prop,
                type: type,
                // The following causes J2V8 to crash
                //parent: obj.getType(),
                depth: depth,
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
    run: function (server, query, file) {
        server.reset();
        return 'OK';
    },
});
