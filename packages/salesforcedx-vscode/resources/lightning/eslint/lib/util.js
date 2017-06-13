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

/**
 * Returns the property name of a MemberExpression.
 * @param {ASTNode} memberExpressionNode The MemberExpression node.
 * @returns {string|null} Returns the property name if available, null else.
 */
function getPropertyName(memberExpressionNode) {
    if (memberExpressionNode.computed) {
        if (memberExpressionNode.property.type === "Literal") {
            return memberExpressionNode.property.value;
        }
    } else {
        return memberExpressionNode.property.name;
    }
    return null;
}

/**
 * Finds the escope reference in the given scope.
 * @param {Object} scope The scope to search.
 * @param {ASTNode} node The identifier node.
 * @returns {Reference|null} Returns the found reference or null if none were found.
 */
function findReference(scope, node) {
    var references = scope.references.filter(function(reference) {
        return reference.identifier.range[0] === node.range[0] &&
            reference.identifier.range[1] === node.range[1];
    });

    if (references.length === 1) {
        return references[0];
    }
    return null;
}

/**
 * Checks if the given identifier node is shadowed in the given scope.
 * @param {Object} scope The current scope.
 * @param {Object} globalScope The global scope.
 * @param {string} node The identifier node to check
 * @returns {boolean} Whether or not the name is shadowed.
 */
function isShadowed(scope, globalScope, node) {
    var reference = findReference(scope, node);
    return reference && reference.resolved && reference.resolved.defs.length > 0;
}

/**
 * Finds all the nodes used by a composed member expression.
 * E.g.: Array.prototype.slice should produce
 * [{type: "Identifier", name: "Array"}, {type: "Identifier", name: "prototype"}, {type: "Identifier", name: "slice"}]
 * @param {ASTNode} node The MemberExpression node.
 * @returns {Array} Returns a list of nodes that represent the namespace.
 */
function buildMemberExpressionNamespace(currentScope, globalScope, node) {
    var ns = [];
    do {
        ns.unshift(node.property);
        if (node.object.type === "MemberExpression") {
            node = node.object;
        } else if (!isGlobalThisReferenceOrGlobalWindow(currentScope, globalScope, node.object)) {
            ns.unshift(node.object);
            node = undefined;
        } else {
            node = undefined;
        }
    } while (node);
    return ns;
}

/**
 * Checks if the given identifier node is a ThisExpression in the global scope or the global window property.
 * @param {Object} scope The current scope.
 * @param {Object} globalScope The global scope.
 * @param {string} node The identifier node to check
 * @returns {boolean} Whether or not the node is a reference to the global object.
 */
function isGlobalThisReferenceOrGlobalWindow(scope, globalScope, node) {
    if (scope.type === "global" && node.type === "ThisExpression") {
        return true;
    } else if (node.name === "window") {
        return !isShadowed(scope, globalScope, node);
    }

    return false;
}

module.exports = {
    getPropertyName,
    findReference,
    isShadowed,
    isGlobalThisReferenceOrGlobalWindow,
    buildMemberExpressionNamespace
};
