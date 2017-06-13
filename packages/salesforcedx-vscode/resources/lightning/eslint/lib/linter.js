/*
 * Copyright (C) 2016 salesforce.com, inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

var glob = require('glob');
var path = require('path');
var fs = require('fs');
var cli = require('heroku-cli-util');
var linter = require('eslint').linter;
var defaultConfig = require('./config');
var defaultStyle = require('./code-style-rules');
var objectAssign = require('object-assign');
var formatter = require('eslint-friendly-formatter');

var SINGLETON_FILE_REGEXP = /(Controller|Renderer|Helper|Provider|Test|Model)\.js$/;

function noop() {}

// this computes the first position after all the comments (multi-line and single-line)
// from the top of the code
function afterCommentsPosition(code) {
    var position = 0;
    var match;
    do {
        // /\*.*?\*/
        match = code.match(/^(\s*(\/\*([\s\S]*?)\*\/)?\s*)/);
        if (!match || !match[1]) {
            match = code.match(/^(\s*\/\/.*\s*)/);
        }
        if (match && match[1]) {
            position += match[1].length;
            code = code.slice(match[1].length);
        }
    } while (match);
    return position;
}

function processSingletonCode(code) {
    // transform `({...})` into `"use strict"; exports = ({...});`
    var pos = afterCommentsPosition(code);
    if (code.charAt(pos) === '(') {
        code = code.slice(0, pos) + '"use strict"; exports = ' + code.slice(pos);
        pos = code.lastIndexOf(')') + 1;
        if (code.charAt(pos) !== ';') {
            code = code.slice(0, pos) + ';' + code.slice(pos);
        }
    }
    return code;
}

function processFunctionCode(code) {
    // transform `function () {}` into `"use strict"; exports = function () {};`
    var pos = afterCommentsPosition(code);
    if (code.indexOf('function', pos) === pos) {
        code = code.slice(0, pos) + '"use strict"; exports = ' + code.slice(pos);
        pos = code.lastIndexOf('}') + 1;
        if (code.charAt(pos) !== ';') {
            code = code.slice(0, pos) + ';' + code.slice(pos);
        }
    }
    return code;
}

function process(src, config, options) {
    var messages = linter.verify(src, config, {
        allowInlineConfig: true, // TODO: internal code should be linted with this set to false
        quiet: true
    });

    if (!options.verbose) {
        messages = messages.filter(function (msg) {
            return msg.severity > 1;
        });
    }

    return messages;
}

module.exports = function (cwd, opts, context) {
    // No log, debug or warn functions if --json option is passed
    var log = opts.json ? noop : cli.log;
    var debug = opts.json ? noop : cli.debug;
    var warn = opts.json ? noop : cli.warn;

    var ignore = [
        // these are the things that we know for sure we never want to inspect
        '**/node_modules/**',
        '**/jsdoc/**',
        '**/htdocs/**',
        '**/invalidTest/**',
        '**/purposelyInvalid/**',
        '**/invalidTestData/**',
        '**/validationTest/**',
        '**/lintTest/**',
        '**/target/**',
        '**/parseError/**',
        '**/*.junk.js',
        '**/*_mock?.js'
    ].concat(opts.ignore ? [opts.ignore] : []);

    var globOptions = {
        silent: true,
        cwd: cwd,
        nodir: true,
        realpath: true,
        ignore: ignore
    };

    var patterns = [opts.files || '**/*.js'];

    var config = {};
    objectAssign(config, defaultConfig);
    config.rules = objectAssign({}, defaultConfig.rules);

    if (opts.config) {
        log('Applying custom rules from ' + opts.config);
        var customStyle = require(path.join(context.cwd, opts.config));
        if (customStyle && customStyle.rules) {
            Object.keys(customStyle.rules).forEach(function (name) {
                if (defaultStyle.rules.hasOwnProperty(name)) {
                    config.rules[name] = customStyle.rules[name];
                    debug(' -> Rule: ' + name + ' is now set to ' + JSON.stringify(config.rules[name]));
                } else {
                    debug(' -> Ignoring non-style rule: ' + name);
                }
            });
        }
    }

    // Using local debug function for non-json text
    debug('Search for "' + patterns.join('" or "') + '" in folder "' + cwd + '"');
    debug(' -> Ignoring: ' + ignore.join(','));

    var files = [];
    // for blt-like structures we look for aura structures
    // and we search from there to narrow down the search.
    var folders = glob.sync('**/*.{app,cmp,lib}', globOptions);
    folders = folders.map(function (v) {
        return path.dirname(v);
    });
    folders = folders.filter(function (v, i) {
        return folders.indexOf(v) === i;
    });

    folders.forEach(function (folder) {
        globOptions.cwd = folder;
        patterns.forEach(function (pattern) {
            files = files.concat(glob.sync(pattern, globOptions));
        });
    });

    // deduping...
    files = files.filter(function (v, i) {
        return files.indexOf(v) === i;
    });

    if (files.length) {
        log('Found ' + files.length + ' matching files.\n----------------');

        var output = [];
        files.forEach(function (file) {
            var source = fs.readFileSync(file, 'utf8');

            // in some cases, we need to massage the source before linting it
            if (SINGLETON_FILE_REGEXP.test(file)) {
                source = processSingletonCode(source);
            } else {
                source = processFunctionCode(source);
            }

            var messages = process(source, config, opts);
            if (messages) {
                if (opts.json) {
                    output.push({
                        file: file,
                        result: messages
                    })
                } else {
                    log('FILE: ' + file + ':');
                    log(formatter([{
                        messages: messages,
                        filePath: '<input>'
                    }]).replace(/<input>/g, 'Line'));
                }
            }
        });

        // printout JSON string to STDOUT
        if (opts.json) {
            cli.log(JSON.stringify(output, null, 4));
        }
    } else {
        warn('Did not find matching files.');
    }

}
