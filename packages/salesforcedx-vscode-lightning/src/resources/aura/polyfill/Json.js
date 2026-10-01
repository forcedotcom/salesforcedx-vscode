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
 * @description A base class to enable JSON manipulation
 * @constructor
 */
function Json() {
}

Json.ApplicationKey={
    //#json.applicationKeys
};

/**
 * Decode a JSON string into an object, optionally using ref support to resolve
 * duplicate object references.
 *
 * IMPORTANT: this function should NEVER be exported, as the eval()
 * implementation provides a public API for executing arbitrary code inside our
 * domain security context. If we decide we need to supply a JSON utility
 * function to consumers in the future, it should use the new window.JSON
 * support provided by newer browsers.
 *
 * @param {String} json
 * @param {Object} refSupport
 */
Json.prototype.decode = function(json, refSupport) {
    var obj;
    if (aura.util.isUndefinedOrNull(json)) {
        return null;
    }
    try {
        obj = JSON.parse(json);
    } catch (e) {
        $A.reportError("Unable to parse JSON response: "+json, e);
        return null;
    }
    return refSupport ? this.resolveRefsObject(obj) : obj;
};

/**
 * After the JSON data is decoded by Browser native JSON object, the resulted
 * object (or sub-object) property's value could be a function/array/object/ and
 * so on in string format. We need to convert them to the desired type.
 *
 * @param {String} value The string to be decoded
 * @returns {Function|Array|Object} The converted value
 */
Json.prototype.decodeString = function(value) {
    var valueType = typeof value;
    if (valueType === "function") {
        return value;
    } else if (valueType === "string") {
        return aura.util.globalEval(value);
    }
    return value;
};

/**
 * Convert a serialized state blob, which is returned from a server action, which
 * contains internal serId and serRefId markers, into a new data structure that
 * has internal JavaScript pointers to the same object. Component definitions are
 * extracted and placed into <code>context.componentDefs</code>.
 *
 * @param {Object} obj The object to resolve. It is modified in-place.
 */
Json.prototype.resolveRefsObject = function(obj) {
    var cmpDefCollector = [];
    $A.util.apply(obj, { "context" : { "componentDefs" : [], "libraryDefs" : [], "eventDefs" : [] } }, false, true);

    this._resolveRefs(obj, {}, null, null, cmpDefCollector);
    if (cmpDefCollector.length > 0) {
        var componentDefs = obj["context"]["componentDefs"];
        var lookup = {};
        var i;
        for (i = 0; i < cmpDefCollector.length; i++) {
            lookup[cmpDefCollector[i]["descriptor"]] = true;
        }

        for (i = 0; i < componentDefs.length; i++) {
            if (!lookup[componentDefs[i]["descriptor"]]) {
                cmpDefCollector.push(componentDefs[i]);
            }
        }
        obj["context"]["componentDefs"] = cmpDefCollector;
    }

    return obj;
};

/**
 * Convert a serialized state blob, with its internal serId and serRefId
 * markers, into a new data structure that has internal JavaScript pointers
 * to the same object. Component definitions are extracted and placed at
 * the front of the array.
 *
 * @param {Array} arr The array to resolve. It is modified in-place.
 */
Json.prototype.resolveRefsArray = function(arr) {
    $A.assert($A.util.isArray(arr), "arr needs to be an array");
    var cmpDefCollector = [];
    this._resolveRefs(arr, {}, null, null, cmpDefCollector);
    arr.unshift.apply(arr, cmpDefCollector);
    return arr;
};

Json.prototype._resolveRefs = function(config, cache, parent, property, collector) {
    if (typeof config === "object" && config !== null) {
        var value;
        var key;
        var v;
        var superCollector;

        if (aura.util.isArray(config)) {
            for ( var i = 0; i < config.length; i++) {
                value = config[i];
                if (typeof value === "object" && value !== null) {
                    this._resolveRefs(value, cache, config, i, collector);
                }
            }

        } else {
            var serRefId = config[Json.ApplicationKey.SERIAL_REFID];
            if (serRefId !== undefined) {
                // TODO: @dval @kvenkiteswaran find a better way to allowlist componentDefs
                if (cache[serRefId]["descriptor"] &&
                    !cache[serRefId]["members"] && // models
                    !cache[serRefId]["actionDefs"] && // actions
                    !cache[serRefId]["type"] && // cmpEvent
                    !cache[serRefId]["actionType"] ) // apex actions and others?
                {
                    // replace the comp def with a descriptor
                    parent[property] = { "descriptor" : cache[serRefId]["descriptor"] };
                } else {
                    // replace the ref (r) with its definition (s)
                    parent[property] = cache[serRefId];
                }

            } else {
                var serId = config[Json.ApplicationKey.SERIAL_ID];
                if (serId !== undefined  && config.hasOwnProperty(Json.ApplicationKey.VALUE)) {
                    value = config[Json.ApplicationKey.VALUE];

                    if (typeof value === "object" && value !== null && (value[Json.ApplicationKey.SERIAL_ID] || value[Json.ApplicationKey.SERIAL_REFID])) {
                        this._resolveRefs(value, cache, parent, property, collector);
                        value = parent[property];
                    } else {
                        // Pull up the values into the config itself
                        if (value["descriptor"] && (value["componentClass"] || value["attributeDefs"])) {
                            var newValueDef = { "descriptor" : value["descriptor"] };
                            cache[serId] = newValueDef;

                            for (key in value) {
                                v = value[key];
                                if (typeof v === "object" && v !== null) {
                                    superCollector = [];
                                    this._resolveRefs(v, cache, value, key, superCollector);
                                    collector.push.apply(collector, superCollector);
                                }
                            }
                            collector.push(value);
                            value = newValueDef;
                        }

                        parent[property] = value;
                    }

                    cache[serId] = value;

                } else {
                    value = config;
                }

                // Recurse into the value's properties
                for (key in value) {
                    v = value[key];
                    if (typeof v === "object" && v !== null) {
                        this._resolveRefs(v, cache, value, key, collector);
                    }
                }
            }
        }
    }
};

Json.prototype.stringifyReplacer = function(key, value) {
    // We have to do this as JSON.stringify removes the property from
    // the resulted JSON string if its value is a function
    if (typeof value === 'function') {
        return value + '';
    } 

    // Do not serialize components to the server
    if($A.util.isComponent(value)) {
        return null;
    }

    return value;
};

/**
 * Encodes an object into a JSON representation.
 *
 * @param {Object} obj The object to pass in the encoder.
 * @param {Object} replacer Optional function which passes key and value bound to the
 *            object, and returns a stringified value.
 * @param {String} whiteSpace Adds spaces or tabs to the resulting string. E.g. '\t'
 *            for tab
 */
Json.prototype.encode = function(obj, replacer, whiteSpace) {
    if (typeof JSON !== "undefined") {
        // Protect ourselves from the evils of libraries like Prototype.js that decorate Array with extra methods such as .toJSON() and do the wrong thing!
        var oldArrayToJSON = Array.prototype.toJSON;
        var oldComponentToJSON = Component.prototype.toJSON;
        try {
            delete Array.prototype.toJSON;
            delete Component.prototype.toJSON;

            if ($A.util.isUndefinedOrNull(replacer)) {
                return JSON.stringify(obj, Json.prototype.stringifyReplacer, whiteSpace);
            } else {
                return JSON.stringify(obj, replacer, whiteSpace);
            }
        } finally {
            if (oldArrayToJSON) {
                // assign property back to Array only if it exists so it doesn't add the addition toJSON property.
                Array.prototype.toJSON = oldArrayToJSON;
            }
            if(oldComponentToJSON) {
                Component.prototype.toJSON = oldComponentToJSON;
            }
        }
    }

    if (obj === undefined) {
        return 'null';
    }

    if (obj === null) {
        return 'null';
    }

    // Support the JSON.stringify() Object.toJSON() standard
    if (!$A.util.isUndefined(obj.toJSON)) {
        return arguments.callee(obj.toJSON());
    }

    switch (obj.constructor) {
        case String:
            return '"' + obj.replace(/\"/g, '\\"').replace(/\r|\n|\f/g, "\\n") + '"';

        case Array:
            var buf = [];
            for ( var i = 0; i < obj.length; i++) {
                buf.push(arguments.callee(obj[i]));
            }
            return '[' + buf.join(',') + ']';

        case Object:
            var buf2 = [];
            for ( var k in obj) {
                if (obj.hasOwnProperty(k)) {
                    // Recursively invoke encode() on both the property name and the
                    // value
                    buf2.push(arguments.callee(k) + ':' + arguments.callee(obj[k]));
                }
            }
            return '{' + buf2.join(',') + '}';

        default:
            return obj.toString();
    }
};

/**
 * Serializes object in alphabetical ascending order. Sorts object keys during serialization.
 * @param {Object} object to sort
 * @returns {String} serialized object
 */
Json.prototype.orderedEncode = (function() {
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON
    var toString = Object.prototype.toString;
    var isArray = Array.isArray || function (a) { return toString.call(a) === '[object Array]'; };
    var escMap = {'"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t'};
    var escFunc = function (m) { return escMap[m] || '\\u' + (m.charCodeAt(0) + 0x10000).toString(16).substr(1); };
    var escRE = /[\\"\u0000-\u001F\u2028\u2029]/g;
    return function stringify(value) {
        if (value == null) {
            return 'null';
        } else if (typeof value === 'number') {
            return isFinite(value) ? value.toString() : 'null';
        } else if (typeof value === 'boolean') {
            return value.toString();
        } else if (typeof value === 'object') {
            if (typeof value.toJSON === 'function') {
                return stringify(value.toJSON());
            } else if (isArray(value)) {
                var res = '[';
                for (var i = 0; i < value.length; i++) {
                    res += (i ? ', ' : '') + stringify(value[i]);
                }
                return res + ']';
            } else if (toString.call(value) === '[object Object]') {
                var tmp = [], sortedKeys = Object.keys(value).sort(), len = sortedKeys.length;
                // customized to sort keys during serialization
                for (var j = 0; j < len; j++) {
                    var key = sortedKeys[j];
                    if (value[key] !== undefined) {
                        tmp.push(stringify(key) + ':' + stringify(value[key]));
                    }
                }
                return '{' + tmp.join(',') + '}';
            }
        }
        return '"' + value.toString().replace(escRE, escFunc) + '"';
    };
})();

Json.prototype["encode"] = Json.prototype.encode;

