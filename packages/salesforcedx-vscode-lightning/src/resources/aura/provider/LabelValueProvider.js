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
 * @description Label Provider. Performs server action to retrieve label values
 * @constructor
 */
function LabelValueProvider(values) {
    this.values = values || {};
    this.queue = {};
}

/**
 * Performs LabelController.getLabel action to get specified section and name.
 * Sets up label queue so that server action for the same label is only requested once
 *
 * @param {String} section - label section
 * @param {String} name - label section
 * @param {Function} [callback] - callback
 * @return {String}
 * @private
 */
LabelValueProvider.prototype.requestServerLabel = function(section, name, callback) {
    var queue = this.getQueue(section, name);

    var placeholder = "";
    //#if {"excludeModes" : ["PRODUCTION"]}
    placeholder = "[" + section + "." + name + "]";
    //#end

    queue.addCallback(callback);

    if (!queue.requested) {
        var action = $A.get("c.aura://LabelController.getLabel");
        action.setParams({
            "name": name,
            "section": section
        });

        action.setCallback(this, function(result) {
            var returnValue = placeholder;
            if (result.getState() === "SUCCESS") {
                returnValue = result.getReturnValue();
                var labels = this.values[section];
                if (!labels) {
                    this.values[section] = labels = {};
                }
                labels[name] = returnValue;

                //JBUCH: HACK. FIX IN PRV REWRITE
                $A.expressionService.updateGlobalReference("$Label." + section + "." + name, null, returnValue);
            } else {
                $A.warning("Error getting label: $Label." + section + "." + name + ". Caused by: " + JSON.stringify(result.getError()));
            }

            var callbacks = queue.getCallbacks();
            for (var i = 0; i < callbacks.length; i++) {
                callbacks[i].call(null, returnValue);
            }

            this.removeQueue(section, name);
        });

        $A.enqueueAction(action);

        queue.requested = true;
    }

    return placeholder;
};

/**
 * Gets queue for specified label
 *
 * @param {String} section - label section
 * @param {String} name - label name
 * @return {LabelQueue} queue for given label
 */
LabelValueProvider.prototype.getQueue = function(section, name) {
    var exp = this.getQueueKey(section, name);
    if (!this.queue[exp]) {
        this.queue[exp] = new Aura.Provider.LabelQueue();
    }
    return this.queue[exp];
};

/**
 * Removes label queue
 * @param {String} section - label section
 * @param {String} name - label name
 */
LabelValueProvider.prototype.removeQueue = function(section, name) {
    var exp = this.getQueueKey(section, name);
    delete this.queue[exp];
};

/**
 * Gets label key in queue
 * @param {String} section - label section
 * @param {String} name - label name
 */
LabelValueProvider.prototype.getQueueKey = function(section, name) {
    return section + "." + name;
};

/**
 * returns $Label values
 */
LabelValueProvider.prototype.getValues = function() {
    return this.values;
};

/**
 * Merges $Label values
 */
LabelValueProvider.prototype.merge = function(values) {
    $A.util.applyNotFromPrototype(this.values, values, true, true);
};

/**
 * Loops through existing values to find value. If no value found, send request to server
 *
 * @param {String} expression - expression
 * @param {Component} [component] - component
 * @param {Function} [callback] - callback
 * @return {String}
 */
LabelValueProvider.prototype.get = function(expression, callback) {
    var path = expression.split('.');
    if (path.length !== 2) {
        $A.log("$Label requests must have both section and name");
        return null;
    }

    var section = path[0];
    var name = path[1];
    var value = this.values[section] && this.values[section][name];
    if (value === undefined) {
        // request from server if no value found in existing gvps
        value = this.requestServerLabel(section, name, callback);
    } else if ($A.util.isFunction(callback)) {
        callback.call(null, value);
    }

    return value;
};

Aura.Provider.LabelValueProvider = LabelValueProvider;
