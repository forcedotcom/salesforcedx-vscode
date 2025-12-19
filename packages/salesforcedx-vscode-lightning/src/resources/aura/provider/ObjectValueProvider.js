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
 * @description Simple Value Provider. Holds generic map of Key/Value Pairs
 * @constructor
 */
function ObjectValueProvider(values) {
    this.values = values || {};
}

/**
 * returns $GVP values
 */
ObjectValueProvider.prototype.getValues = function() {
    return this.values;
};

/**
 * Merges all values into the existing ones.
 *
 * @param values
 */
ObjectValueProvider.prototype.merge = function(values) {
    $A.util.applyNotFromPrototype(this.values, values, true, true);
};

/**
 * Gets value and creates new simple value that references specified component.
 *
 * @param {String} expression used to compute the new values.
 * @param {Function} callback called after creating the new values
 * @return {Object} The value referenced by the expression.
 */
ObjectValueProvider.prototype.get = function(expression, callback) {
    var value = this.values[expression]||$A.expressionService.resolve(expression,this.values);
    if( $A.util.isFunction(callback) ) {
        callback(value);
    }
    return value;
};

Aura.Provider.ObjectValueProvider = ObjectValueProvider;