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

var util = require('../lib/util.js');
var intrinsics = require('../lib/3rdparty/ses/whitelist').whitelist;
var anonIntrinsics = intrinsics.cajaVM.anonIntrinsics;

module.exports = function(context) {
    var globalScope;

    return {

        "Program": function() {
            globalScope = context.getScope();
        },

        MemberExpression: function(node) {
            if (node.parent.type === "MemberExpression") {
                // ignoring intermediate member expressions
                return;
            }
            var currentScope = context.getScope();
            var ns = util.buildMemberExpressionNamespace(currentScope, globalScope, node);
            if (ns.length > 0) {
                var rootIdentifier = ns[0];
                if (rootIdentifier.type !== "Identifier" || util.isShadowed(currentScope, globalScope, rootIdentifier)) {
                    return;
                }
                var api;
                if (intrinsics.hasOwnProperty(rootIdentifier.name)) {
                    api = intrinsics;
                } else if (anonIntrinsics.hasOwnProperty(rootIdentifier.name)) {
                    api = anonIntrinsics;
                } else {
                    return; // nothing to do here, it is not intrinsic
                }
                for (var i = 0; i < ns.length; i++) {
                    var identifier = ns[i];
                    if (identifier.type !== 'Identifier') {
                        context.report(node, "Invalid Intrinsic API, use dot notation instead");
                        return;
                    }
                    var token = identifier.name;
                    var nextIdentifier = ns[i + 1];
                    if (typeof api !== "object") {
                        context.report(node, "Invalid Intrinsic API");
                        return;
                    }
                    if (!api || !Object.hasOwnProperty.call(api, token)) {
                        context.report(node, "Invalid Intrinsic API");
                        return;
                    }
                    if (api[token] === '*') {
                        // anything from this point on is good
                        return;
                    }
                    if (typeof (api[token]) === 'object' && Object.keys(api[token]).length === 0) {
                        // nothing else to inspect
                        return;
                    }
                    if (api[token] === true && !nextIdentifier) {
                        // function call
                        return;
                    }
                    if (api[token] === true && nextIdentifier && nextIdentifier.type === 'Identifier' && (nextIdentifier.name === 'apply' || nextIdentifier.name === 'call')) {
                        // function call with .apply() or .call() are still valid
                        return;
                    }
                    if (api[token] === false && nextIdentifier === undefined) {
                        return;
                    }
                    api = api[token];
                }
            }
        }
    };

};

module.exports.schema = [];
