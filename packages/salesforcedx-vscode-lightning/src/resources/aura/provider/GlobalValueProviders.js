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
 * @description Global Value Provider. Holds global values: $Label, $Browser, $Locale, etc
 *
 * The interface required of a global value provider is:
 * <ul>
 *   <li>merge: merge a set of values from the server (if values come from the server)
 *   <li>get: get a single value from the GVP
 *   <li>getStorableValues[optional] get a storable version of the GVP values
 *   <li>getValues: get a set of values that can be exposed.
 *   <li>set[optional]: set a value on the provider
 *   <li>isStorable[optional]: should values be saved to storage
 * </ul>
 *
 * @param {Object} gvp an optional serialized GVP to load.
 * @param {Function} initCallback an optional callback invoked after the GVP has finished its
 *  asynchronous initialization.
 * @constructor
 * @export
 */
function GlobalValueProviders(gvp, initCallback) {
    this.valueProviders = {
        "$Browser" : new Aura.Provider.ObjectValueProvider(gvp["$Browser"]),
        "$Label": new Aura.Provider.LabelValueProvider(gvp["$Label"]),
        "$Locale": new Aura.Provider.ObjectValueProvider(gvp["$Locale"]),
        "$Global": new Aura.Provider.ContextValueProvider(gvp["$Global"])
    };

    // work around the obfuscation logic to allow external GVPs
    for(var type in $A.globalValueProviders) {
        var valueProvider = $A.globalValueProviders[type];
        valueProvider.getValues = valueProvider.getValues || valueProvider["getValues"];
        valueProvider.get = valueProvider.get || valueProvider["get"];
        valueProvider.merge = valueProvider.merge || valueProvider["merge"];
    }

    // Append external GVP providers.
    $A.util.applyNotFromPrototype(this.valueProviders, $A.globalValueProviders);

    var bootstrapGVPData = [];
    for(type in gvp){
        if (["$Browser", "$Label", "$Locale", "$Global"].indexOf(type) >= 0) {
            continue;
        }

        bootstrapGVPData.push({"type": type, "values": gvp[type]});
    }

    this.load(bootstrapGVPData);

    if (initCallback) {
        initCallback(this);
    }
}

/**
 * Persistent storage key for GVPs.
 */
GlobalValueProviders.prototype.STORAGE_KEY = "globalValueProviders";


/**
 * Key to use of the MutexLocker to guarantee atomic execution across tabs.
 */
GlobalValueProviders.prototype.MUTEX_KEY = "GlobalValueProviders";

/**
 * Function to release the mutex, set while the mutex is held.
 */
GlobalValueProviders.prototype.mutexUnlock = undefined;

/**
 * Set to true while GVP persistence is async acquiring the lock, enabling
 * concurrent GVP updates to skip their own persistence calls.
 */
GlobalValueProviders.prototype.persistenceQueued = false;

/**
 * True if GVPs were loaded from persistent storage. */
GlobalValueProviders.prototype.LOADED_FROM_PERSISTENT_STORAGE = false;

/**
 * Cookie used to track when persistent storage is known to be missing GVP values.
 */
GlobalValueProviders.prototype.ABSENT_GVP_VALUES_COOKIE = "auraGvpValuesAbsence";


/**
 * Merges new GVPs with existing and saves to storage
 *
 * @param {Array} gvps The new GVPs to merge. Provided as an array of objects,
 *  where each object has two keys: "type" and "values".
 * @param {Boolean} doNotPersist
 * @protected
 */
GlobalValueProviders.prototype.merge = function(gvps, doNotPersist) {
    if (!gvps) {
        return;
    }
    var valueProvider, i, type, newGvp, values;

    for (i = 0; i < gvps.length; i++) {
        try {
            newGvp = gvps[i];
            type = newGvp["type"];
            if (!this.valueProviders[type]) {
                this.valueProviders[type] = new Aura.Provider.ObjectValueProvider();
            }
            valueProvider = this.valueProviders[type];
            if (valueProvider.merge) {
                // set values into its value provider
                valueProvider.merge(newGvp["values"]);
            } else {
                $A.util.applyNotFromPrototype(valueProvider,newGvp["values"],true);
            }
            $A.expressionService.updateGlobalReferences(type,newGvp["values"]);
        } catch(e) {
            var auraError = new $A.auraError("Merging GVP '" + type + "' failed", e);
            auraError.setComponent(type);
            throw auraError;
        }
    }

    if (doNotPersist) {
        return;
    }

    var storage = this.getStorage();
    if (!storage) {
        return;
    }

    // if another task is already queued to persist then rely on it to
    // include values just merged.
    if (this.persistenceQueued) {
        return;
    }

    this.persistenceQueued = true;

    // for multi-tab support a single persistent store is shared so it's possible other tabs have updated
    // the persisted GVP value. therefore lock, load, merge, save, and unlock.
    var that = this;
    $A.util.Mutex.lock(that.MUTEX_KEY, function (unlock) {
        that.mutexUnlock = unlock;

        var errors = [];
        storage.get(that.STORAGE_KEY, true)
            ["then"](
                undefined,
                function(e) {
                    var message = "GlobalValueProviders.merge(): failed to load GVP values from storage, will overwrite storage with in-memory values.";
                    $A.warning(message, e);

                    errors.push({
                        "action": "load",
                        "message": message,
                        "error": e
                    });
                    // do not rethrow
                }
            )
            ["then"](function(value) {
                // collect GVP values to persist. this includes updates to the GVPs
                // incurred while waiting for the mutex, etc.
                that.persistenceQueued = false;
                var toStore = [];
                for (type in that.valueProviders) {
                    if (that.valueProviders.hasOwnProperty(type)) {
                        valueProvider = that.valueProviders[type];
                        // GVP values saved to storage be default. isStorable allows it to not be stored
                        var storable = typeof valueProvider["isStorable"] === "function" ? valueProvider["isStorable"]() : true;
                        if (storable) {
                            values = valueProvider.getStorableValues ? valueProvider.getStorableValues() : (valueProvider.getValues ? valueProvider.getValues() : valueProvider);
                            toStore.push({"type": type, "values": values});
                        }
                    }
                }

                if (value) {
                    // NOTE: we merge into the value from storage to avoid modifying toStore, which may hold
                    // references to mutable objects from the live GVPs (due to getValues() etc above). this means
                    // the live GVPs don't see the additional values from storage.
                    try {
                        var j;
                        var map = {};
                        for (j in value) {
                            map[value[j]["type"]] = value[j]["values"];
                        }

                        for (j in toStore) {
                            type = toStore[j]["type"];
                            if (!map[type]) {
                                map[type] = {};
                                value.push({"type":type, "values":map[type]});
                            }
                            $A.util.applyNotFromPrototype(map[type], toStore[j]["values"], true, true);
                        }

                        toStore = value;
                    } catch (e) {
                        var message = "GlobalValueProviders.merge(): merging from storage failed, overwriting with in-memory values.";
                        $A.warning(message, e);
                        errors.push({
                            "action": "merge",
                            "message": message,
                            "error": e
                        });
                    }
                }
                return storage.set(that.STORAGE_KEY, toStore);
            })
            ["then"](
                function() {
                    if (that.getAbsentGvpValuesCookie()) {
                        // clear the cookie if persistence succeeds
                        that.clearAbsentGvpValuesCookie();
                    }

                    if (errors.length > 0) {
                        var message = "GlobalValueProviders.merge(): GVP values in storage have been overwritten with in-memory values.";
                        $A.warning(message);

                        // GVPs in current tab are persisted, but b/c errors in step 1 or 2, GVPs for other tabs could be dropped.
                        $A.metricsService.transaction("aura", "performance:gvpStorageFailure", {
                            "context": {
                                "attributes" : {
                                    "message": message,
                                    "errors": JSON.stringify(errors)
                                }
                            }
                        });
                    }

                    that.mutexUnlock();
                },
                function(e) {
                    that.setAbsentGvpValuesCookie();

                    var message = "GlobalValueProviders.merge(): failed to store merged GVP values to storage.";
                    $A.warning(message, e);

                    var labels = [];
                    for (i = 0; i < gvps.length; i++) {
                        // For now, only cares about labels. To minimize the payload, only sending the sections.
                        if (gvps[i]["type"] === "$Label") {
                            labels = Object.keys(gvps[i]["values"]);
                            break;
                        }
                    }

                    errors.push({
                        "action": "save",
                        "message": message,
                        "error": e,
                        "dropped-labels": labels
                    });

                    // new coming GVPs fail to be saved into storage
                    $A.metricsService.transaction("aura", "performance:gvpStorageFailure", {
                        "context": {
                            "attributes" : {
                                "message": message,
                                "errors": JSON.stringify(errors)
                            }
                        }
                    });

                    that.mutexUnlock();
                }
            );
    });
};


/**
 * Wrapper to get storage.
 *
 * @return {Object} storage - undefined if no storage exists
 * @private
 */
GlobalValueProviders.prototype.getStorage = function () {
    var storage = $A.storageService.getStorage($A.clientService.getActionStorageName());
    return storage && storage.isPersistent() ? storage : undefined;
};

/**
 * load GVPs from storage if available
 * @return {Promise} a promise that resolves when GVPs are loaded.
 * @private
 */
GlobalValueProviders.prototype.loadFromStorage = function() {
    // If persistent storage is active then write through for disconnected support
    var storage = this.getStorage();
    // If GVP values absence is known, avoid loading from storage
    if (!storage || this.getAbsentGvpValuesCookie()) {
        return Promise["resolve"]();
    }

    var that = this;
    return storage.get(this.STORAGE_KEY, true)
        ["then"](function (value) {
                $A.run(function() {
                    if (value) {
                        that.merge(value, true);

                        // some GVP values were loaded from storage
                        that.LOADED_FROM_PERSISTENT_STORAGE = true;
                    }
                });
        })
        ["then"](
            undefined,
            function() {
                $A.run(function() {
                    // error retrieving from storage, do not rethrow
                });
            }
        );
};

/**
 * Loads GVP config when from context
 *
 * @param {Array} gvps an optional serialized GVP to load.
 * @private
 */
GlobalValueProviders.prototype.load = function(gvps) {
    if(gvps && gvps.length) {
        Aura["afterBootstrapReady"].push(function () {
            try {
                this.merge(gvps, true);
            } catch (e) {
                $A.warning("GlobalValueProviders merge failed.");
            }
        }.bind(this));
    }
};


/**
 * Adds a new global value provider.
 * @param type The key to identify the valueProvider.
 * @param valueProvider The valueProvider to add.
 * @private
 */
GlobalValueProviders.prototype.addValueProvider = function(type, valueProvider) {
    if(!this.valueProviders.hasOwnProperty(type)) {
        // work around the obfuscation logic to allow external GVPs
        valueProvider.getValues = valueProvider.getValues || valueProvider["getValues"];
        valueProvider.get       = valueProvider.get       || valueProvider["get"];
        valueProvider.merge     = valueProvider.merge     || valueProvider["merge"];
        this.valueProviders[type] = valueProvider;
    }
};

/**
 * Returns value provider or empty ObjectValueProvider
 *
 * @param {String} type the key to identify the valueProvider
 * @return {Object} ValueProvider
 * @private
 */
GlobalValueProviders.prototype.getValueProvider = function(type) {
    return this.valueProviders[type];
};

/**
 * Calls getValue for Value Object. Unwraps and calls callback if provided.
 *
 * @param {String} expression
 * @param {Component} component
 * @return {String} The value of expression
 * @export
 */
GlobalValueProviders.prototype.get = function(expression, callback) {
    expression=$A.expressionService.normalize(expression).split('.');
    var type=expression.shift();
    var valueProvider=this.valueProviders[type];
    $A.assert(valueProvider,"Unknown value provider: '"+type+"'.");
    return (valueProvider.get ? valueProvider.get(expression, callback) : $A.expressionService.resolve(expression, valueProvider));
};


GlobalValueProviders.prototype.getAbsentGvpValuesCookie = function() {
    var cookie = $A.util.getCookie(this.ABSENT_GVP_VALUES_COOKIE);
    return cookie === "true";
};

GlobalValueProviders.prototype.setAbsentGvpValuesCookie = function() {
    var duration = 1000*60*60*24*7; // 1 week
    $A.util.setCookie(this.ABSENT_GVP_VALUES_COOKIE, "true", duration);
};

GlobalValueProviders.prototype.clearAbsentGvpValuesCookie = function() {
    $A.util.clearCookie(this.ABSENT_GVP_VALUES_COOKIE);
};

Aura.Provider.GlobalValueProviders = GlobalValueProviders;
