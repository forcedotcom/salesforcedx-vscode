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

// to guarantee that all custom rules are loaded before creating the config
require('./load-rules.js');

var ERROR = 2;
var WARNING = 1;
var IGNORE = 0;

// eslint config
module.exports = {
    version: false,
    eslintrc: false,
    env: {
        browser: true
    },
    parserOptions: {
        ecmaVersion: 5
    },
    globals: {
        "$A": true,
        "AuraContext": true,
        "AuraSerializationService": true,
        "AuraExpressionService": true,
        "AuraEventService": true,
        "AuraLocalizationService": true,
        "AuraStorageService": true,
        "AuraStyleService": true,
        "MetricsService": true,
        "AuraDevToolService": true,
        "Component": true,
        "CKEDITOR": true,
        "FORCE": true,
        "moment": true,
        "exports": true,
        "iScroll": true,
        "unescape": true,
        "Promise": true
    },
    rules: {
        // custom rules
        "ecma-intrinsics": ERROR,
        "new-rule-template": IGNORE,
        "secure-document": ERROR,
        "aura-api": ERROR,
        "secure-window": ERROR,

        // platform rules that as immutable
        "no-alert": ERROR,
        "no-array-constructor": ERROR, // help with instanceof
        "no-bitwise": WARNING, // usually a typo | -> ||
        "no-caller": ERROR, // strict mode compliance
        "no-catch-shadow": ERROR,
        "no-cond-assign": ERROR,
        "no-console": ERROR,
        "no-constant-condition": ERROR,
        "no-control-regex": WARNING,
        "no-debugger": ERROR,
        "no-delete-var": WARNING, // for perf reasons, we might want to set this to 2
        "no-div-regex": WARNING,
        "no-dupe-keys": ERROR,
        "no-dupe-args": ERROR,
        "no-duplicate-case": ERROR,
        "no-else-return": IGNORE,
        "no-empty-character-class": ERROR,
        "no-eq-null": WARNING,
        "no-eval": ERROR,
        "no-ex-assign": ERROR,
        "no-extend-native": ERROR,
        "no-extra-bind": ERROR,
        "no-extra-boolean-cast": ERROR,
        "no-fallthrough": ERROR, // switch fallthrough
        "no-floating-decimal": WARNING, // var num = .5;
        "no-func-assign": ERROR,
        "no-implied-eval": ERROR,
        "no-inner-declarations": [ERROR, "functions"],
        "no-invalid-regexp": ERROR,
        "no-irregular-whitespace": ERROR,
        "no-iterator": ERROR,
        "no-label-var": ERROR,
        "no-labels": ERROR,
        "no-loop-func": ERROR,
        "no-multi-str": ERROR,
        "no-native-reassign": ERROR,
        "no-negated-in-lhs": ERROR,
        "no-nested-ternary": WARNING,
        "no-new": ERROR,
        "no-new-func": ERROR,
        "no-new-object": ERROR,
        "no-new-wrappers": ERROR,
        "no-obj-calls": ERROR,
        "no-octal": ERROR,
        "no-octal-escape": ERROR,
        "no-param-reassign": WARNING,
        "no-plusplus": WARNING,
        "no-proto": ERROR,
        "no-redeclare": ERROR,
        "no-regex-spaces": ERROR,
        "no-return-assign": ERROR,
        "no-script-url": ERROR,
        "no-self-compare": ERROR,
        "no-sequences": ERROR, // var a = (3, 5);
        "no-shadow": ERROR,
        "no-shadow-restricted-names": ERROR,
        "no-sparse-arrays": ERROR,
        "no-ternary": IGNORE,
        "no-throw-literal": WARNING,
        "no-undef": WARNING,
        "no-undef-init": WARNING,
        "no-undefined": IGNORE,
        "no-underscore-dangle": IGNORE,
        "no-unreachable": ERROR,
        "no-unused-expressions": WARNING,
        "no-unused-vars": [WARNING, {"vars": "all", "args": "after-used"}],
        "no-use-before-define": [ERROR, { "functions": false }],
        "no-void": ERROR,
        "no-var": IGNORE,
        "no-with": ERROR,
        "consistent-return": WARNING,
        "default-case": ERROR,
        "dot-notation": [WARNING, { "allowKeywords": true }],
        "eqeqeq": ["error", "smart"],
        "guard-for-in": WARNING,
        "handle-callback-err": WARNING,
        "new-parens": ERROR,
        "radix": ERROR,
        "strict": [ERROR, "global"],
        "use-isnan": ERROR,
        "valid-typeof": ERROR,
        "wrap-iife": [WARNING, "any"]

        // aside from this list, ./code-style-rules.js will have the rules that are not
        // important for the code to function, but just stylish.
    }
};
