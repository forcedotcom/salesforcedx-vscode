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
 * A def for an override.
 *
 * This is rather painful, and would like to be refactored, but until we can do that, this will have to do.
 * Ideally, we would be passed an 'instance' and a 'names', along with 'bound aliases' where instance[name] would
 * give the original function and we could simply assign, meaning that replace and restore would not be supplied
 * as functions.
 *
 * @param instance the instance, if any, otherwise null.
 * @param orig the original function.
 * @param proto true if the original is on a prototype.
 * @param replace a function to replace
 * @param restore a function to restore
 * @constructor
 */
Aura.Utils.Override = function Override(instance, orig, proto, replace, restore) {
    $A.assert($A.util.isObject(instance)||(instance === null), "Override: instance must be an object or null");
    $A.assert($A.util.isFunction(orig), "Override: orig argument must be a function");
    $A.assert(proto === true || proto === false, "Override: Proto argument must be supplied");
    $A.assert($A.util.isFunction(replace), "Override: replace must be a function");
    $A.assert($A.util.isFunction(restore), "Override: restore must be a function");

    $A.assert((!instance) === proto, "OverrideMapDef: instance argument must match !proto");

    this.instance = instance;
    this.orig = orig;
    this.proto = proto;
    this.replace = replace;
    this.restore = restore;
    this.chain = [];

    this.currentInstance = instance;
};


/**
 * Install an override.
 *
 * This installs a function on an override.
 *
 * The function supplied should have the following code in it:
 * ------
 *  var config = Array.prototype.shift.apply(arguments);
 *  var ret = config["fn"].apply(config["scope"], arguments);
 *  return ret
 * ------
 * 
 * That stanza executes down the chain of overrides. It is not required, but if it is not executed,
 * the following overrides in the chain, and the original function, will not be executed.
 *
 * FIXME: we need a priority here to ensure that we install in a sortof-order.
 *
 * @param {Function} fn the function to install.
 * @param {Object} scope the scope of the function.
 * @param {number} priority
 */
Aura.Utils.Override.prototype.install = function(fn, scope, priority) {
    var obj = {};
    var i, posn;
    obj.scope = scope;
    obj.fn = fn;
    obj.priority = priority;
    if (this.chain.length === 0) {
        var bound;
        if (this.proto) {
            var that = this;
            bound = function() {
                var config = { "self" : this};
                config.that = that;
                config.walkIndex = 0;
                that.continuation.apply(config, arguments);
            };
        } else {
            bound = this.start.bind(this);
        }
        this.replace(bound);
    }
    for (i = 0; i < this.chain.length; i++) {
        if (this.chain.priority > priority) {
            posn = i;
            break;
        }
    }
    if (posn !== undefined) {
        this.chain.splice(posn, 0, obj);
    } else {
        this.chain.push(obj);
    }
};

/**
 * Uninstall a previously installed function.
 *
 * This simply removes the override. If it is the last override, the original function is
 * restored.
 *
 * @param fn the function to remove.
 */
Aura.Utils.Override.prototype.uninstall = function(fn) {
    var i;

    for (i = 0; i < this.chain.length; i++) {
        if (this.chain[i].fn === fn) {
            this.chain.splice(i, 1);
            break;
        }
    }
    if (this.chain.length === 0) {
        var bound;
        if (this.instance) {
            bound = this.orig.bind(this.instance);
        }
        this.restore(this.orig, bound);
        return true;
    }
    return false;
};

/**
 * Internal function to start off override processing.
 *
 * This function is the entry point that overrides the function.
 */
Aura.Utils.Override.prototype.start = function() {
    var config = { "self" : this.instance };
    config.that = this;
    config.walkIndex = 0;
    return this.continuation.apply(config, arguments);
};

/**
 * Internal function to continue an override chain.
 *
 * HACK ALERT! this is not this.
 */
Aura.Utils.Override.prototype.continuation = function() {
    var next;
    var keepGoing = true;
    var config = this;
    var that = config.that;

    if (config.walkIndex < that.chain.length) {
        next = that.chain[config.walkIndex++];
        keepGoing = ((config.walkIndex < that.chain.length) || that.last);
    } else {
        next = that.last;
        keepGoing = false;
    }
    if (keepGoing) {
        config["scope"] = config;
        config["fn"] = that.continuation;
    } else {
        config["scope"] = config["self"];
        config["fn"] = that.orig;
    }
    Array.prototype.unshift.call(arguments, config);
    return next.fn.apply(next.scope, arguments);
};

