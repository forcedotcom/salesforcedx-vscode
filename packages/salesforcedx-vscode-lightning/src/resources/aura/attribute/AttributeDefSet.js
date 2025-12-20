/*
 * Copyright (C) 2013 salesforce.com, inc.
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
 * @description Creates a new AttributeDefSet instance.
 * @param {Object} configs For each configs object provided, a new AttributeDef instance is added
 * @constructor
 * @protected
 * @export
 */
function AttributeDefSet(configs,defaultNamespace) {
    this.values = {};
    // maintain attribute order
    this.valuesOrder = [];

    if (configs) {
        for (var i = 0; i < configs.length; i++) {
            var attributeDef = new AttributeDef(configs[i],defaultNamespace);
            var descriptor=attributeDef.getDescriptor();
            if(!descriptor.namespace){
                descriptor.namespace=defaultNamespace;
            }
            var name = descriptor.getName();
            this.values[name] = attributeDef;
            this.valuesOrder.push(name);
        }
    }
}

/**
 * For each AttributeDef value, pass it into the given function.
 * @param {Function} f The function to pass the values into.
 * @export
 */
AttributeDefSet.prototype.each = function(f) {
    var values = this.values;
    var valuesOrder = this.valuesOrder;
    if (values) {
        for (var i = 0; i < valuesOrder.length; i++) {
            f(values[valuesOrder[i]],i);
        }
    }
};

/**
 * Does this attribute exist in the set?
 * @param {String} name Complete attribute name. Does not split on .
 */
AttributeDefSet.prototype.hasAttribute = function(name) {
    return this.values.hasOwnProperty(name);
};

/**
 * Returns the AttributeDef object.
 * @param {String} name The name of the AttributeDef instance, which matches the qualified name of the attributeDef descriptor.
 * @returns {AttributeDef} An AttributeDef object is stored in a parent definition, such as a ComponentDef object.
 * @export
 */
AttributeDefSet.prototype.getDef = function(name) {
    return (this.values&&this.values[name.split('.')[0]])||null;
};

/**
 * Get the set of names in the attribute def set.
 *
 * This provides access to an array, instead of having to walk the map.
 *
 * @export
 * @return {Array} the array of names.
 */
AttributeDefSet.prototype.getNames = function() {
    return this.valuesOrder;
};

/**
 * Returns map of AttributeDefs
 * @export
 * @returns {Object} values
 */
AttributeDefSet.prototype.getValues = function() {
    return this.values;
};

Aura.Attribute.AttributeDefSet = AttributeDefSet;