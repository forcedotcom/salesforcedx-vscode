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
 * @description Context's Global ValueProvider.
 * @constructor
 */
function ContextValueProvider(values) {
    this.values = values || {};
}

/**
 * returns $Global values
 *
 * @protected
 * @return {Object} a copy of the internal store.
 */
ContextValueProvider.prototype.getValues = function() {
    var result = {};
    for (var key in this.values)  {
        if (this.values.hasOwnProperty(key)) {
            result[key] = this.extract(this.values[key]);
        }
    }
    return result;
};

/**
 * Returns a storable set of values.
 *
 * @private
 * @return {Object} a reference to the internal store.
 */
ContextValueProvider.prototype.getStorableValues = function() {
    return this.values;
};

ContextValueProvider.prototype.serializeForServer = function () {
    var serverValues = {};

    for (var key in this.values)  {
        if (this.values.hasOwnProperty(key)) {
            var current = this.values[key];

            if (current.hasOwnProperty("value")) {
                serverValues[key] = current["value"];
            }
        }
    }
    return serverValues;
};

/**
 * Merges $Global values.
 *
 * The incoming values must be from the server. We have special handling here to ensure that the
 * server does not overwrite values that are on the client.
 *
 * @private
 * @param {Object} values the new set of values to merge
 */
ContextValueProvider.prototype.merge = function(values) {
    for (var key in values) {
        if (values.hasOwnProperty(key)) {
            var value = values[key];
            // var old = undefined;
            // if (this.values.hasOwnProperty(key)) {
            //     old = this.values[key];
            // }
            
            if (!value || !(value.hasOwnProperty("value") || value.hasOwnProperty("defaultValue"))) {
                throw new Error("Invalid merge value at key '"+key+"' with value '"+value+"'");
            }

            // So if they set a value on the client for a $Global property
            // Setting it on the server will never take effect. 
            // Even if we do a setGlobalValue()
            // It feels like we'd want to set the value to the clientValue, but 
            // I feel we need a test to validate that first.
            // 
            // Kris: Testing now 
            // if (value["writable"] && old && old.hasOwnProperty("value")) {
            //     value["value"] = old["value"]; 
            // }
            if(value.hasOwnProperty("value")) {
                if(!this.values.hasOwnProperty(key)) {
                    if(value.hasOwnProperty("originalValue")) {
                        delete value["originalValue"];
                    }
                    this.values[key] = value;
                } else if(value["originalValue"] === this.values[key].value) {
                    delete value["originalValue"];
                    this.values[key] = value;
                }
            } else {
                delete value["originalValue"];
                this.values[key] = value;
            }
        }
    }
};

/**
 * Find value. If no value found, throw
 *
 * @public
 * @param {string} key - the key to retrieve
 * @return {Object} - the assigned of (if not assigned) default value
 */
ContextValueProvider.prototype.get = function(key) {
    if (this.values.hasOwnProperty(key) === false) {
        throw new Error("Attempting to retrieve an unknown global item '" + key + "'. Global items must be pre-registered and have a default value");
    }
    return this.extract(this.values[key]);
};

/**
 * set value by name. If no value item found, throw.  If not writable, throw
 *
 * @public
 * @param {string} key - the name of the key (must exist and be writable)
 * @param {Object} value - the value to set
 * @return {Object} the value that was set.
 */
ContextValueProvider.prototype.set = function(key, value) {
    $A.assert(key.indexOf('.') === -1, "Unable to set value for key '" + key + "', did you add an extra '.'?");
    if ($A.util.isExpression(value)) {
        throw new Error("Unable to set global value '"+key+"' to the expression '"+value+"'. Global items must be constants");
    }
    if (this.values.hasOwnProperty(key) === false) {
        throw new Error("Attempting to set an unknown global item '" + key  + "'. Global items must be pre-registered and have a default value");
    }
    var gv = this.values[key];
    //var oldValue = this.extract(gv);
    if (gv && gv["writable"]) {
        gv["value"] = value === null ? undefined : value;
    } else {
        throw new Error("Attempting to set a read only global item '" + key + "'");
    }
    // change event.
    return value;
};

/**
 * Extract the current value from the global value.
 *
 * @private
 * @param {Object} the global value (keys = [ "value", "defaultValue", "writable" ]
 * @return {Object} the value
 */
ContextValueProvider.prototype.extract = function(gv) {
    return gv && (gv.hasOwnProperty("value") ? gv["value"] : gv["defaultValue"]);
};

Aura.Provider.ContextValueProvider = ContextValueProvider;