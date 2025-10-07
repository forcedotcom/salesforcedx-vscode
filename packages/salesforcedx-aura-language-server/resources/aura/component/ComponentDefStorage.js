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
 * @description Storage for component, library, and event definitions. If persistent storage
 * is not available then most operations are noops.
 * @constructor
 * @protected
 */
function ComponentDefStorage() {}

ComponentDefStorage.prototype.STORAGE_NAME = "ComponentDefStorage";

/**
 * Target size, as a percent of max size, for component def storage during eviction.
 */
ComponentDefStorage.prototype.EVICTION_TARGET_LOAD = 0.75;

/**
 * Minimum head room, as a percent of max size, to allocate after eviction and adding new definitions.
 */
ComponentDefStorage.prototype.EVICTION_HEADROOM = 0.1;

/**
 * Cookie used to track when persistent def storage is known to contain a broken graph.
 */
ComponentDefStorage.prototype.BROKEN_GRAPH_COOKIE = "auraBrokenDefGraph";

/**
 * Key to use of the MutexLocker to guarantee atomic execution across tabs.
 */
ComponentDefStorage.prototype.MUTEX_KEY = ComponentDefStorage.prototype.STORAGE_NAME;

/**
 * Function to release the mutex, set while the mutex is held.
 */
ComponentDefStorage.prototype.mutexUnlock = undefined;

/**
 * Queue of operations on the def store. Used to prevent concurrent DML on the underlying AuraStorage, or analysis
 * of the AuraStorage contents during DML, which often results in a broken def graph. This is set to an array
 * when an operation is in-flight.
 */
ComponentDefStorage.prototype.queue = undefined;

/**
 * Map of defs to store. To improve performance defs are batched while the mutex around def AuraStorage is acquired.
 */
ComponentDefStorage.prototype.defsToStore = undefined;

/**
 * Whether defs are backed up to persistent storage. Evaluated to a boolean
 * on first request to operate on defs (get, put, or remove).
 */
ComponentDefStorage.prototype.useDefStore = undefined;

/**
 * The AuraStorage instance.
 */
ComponentDefStorage.prototype.storage = undefined;


/**
 * Whether to use storage for component definitions.
 * @returns {Boolean} Whether to use storage for component definitions.
 */
ComponentDefStorage.prototype.useDefinitionStorage = function() {
    if (this.useDefStore === undefined) {
        this.setupDefinitionStorage();
    }
    return this.useDefStore;
};

/**
 * Sets up persistent storage for definitions if the necessary prerequisites are satisfied.
 * If they are not then storage is not setup and definitions are not backed up.
 */
ComponentDefStorage.prototype.setupDefinitionStorage = function() {
    if (this.useDefStore === undefined) {
        this.useDefStore = false;

        // only persistently cache defs if actions is persistently cached. this is because
        // labels are stored in the GVP mechanism which is stored in actions. if labels
        // aren't persisted and defs are then components get rendered without labels (or with
        // the label placeholder in non-prod mode).

        var actionStorage = $A.clientService.getActionStorage();
        if (actionStorage.isStoragePersistent()) {

            var storage = $A.storageService.getStorage(this.STORAGE_NAME);
            var removeStorage = false;
            if (!storage) {
                // only create (and then remove) if the app hasn't defined one
                removeStorage = true;
                storage = $A.storageService.initStorage({
                    "name":         this.STORAGE_NAME,
                    "persistent":   true,
                    "secure":       false,
                    "maxSize":      4096000, // 4MB
                    "expiration":   10886400, // 1/2 year because we handle eviction ourselves
                    "debugLogging": true,
                    "clearOnInit":  false
                });
            }

            // def storage only enabled with persistent storage
            if (storage.isPersistent()) {
                this.storage = storage;
                // explicitly disable sweeping b/c AuraComponentService handles eviction
                this.storage.suspendSweeping();
                this.useDefStore = true;
            } else if (removeStorage) {
                $A.storageService.deleteStorage(this.STORAGE_NAME);
            }
        }
    }
};

/**
 * Gets the storage for component definitions.
 * @return {AuraStorage|null} The component def storage or null if it's disabled.
 */
ComponentDefStorage.prototype.getStorage = function () {
    if (this.useDefinitionStorage()) {
        return this.storage;
    }
};

/**
 * Stores component and library definitions into storage.
 * @param {Array} cmpConfigs The component definitions to store.
 * @param {Array} libConfigs The library definitions to store.
 * @param {Array} evtConfigs The event definitions to store.
 * @param {Array} moduleConfigs The module definitions to store.
 * @param {AuraContext} context The Aura context.
 * @return {Promise} Promise that resolves when storing is complete.
 */
ComponentDefStorage.prototype.storeDefs = function(cmpConfigs, libConfigs, evtConfigs, moduleConfigs, context) {
    if (!this.useDefinitionStorage() || (!cmpConfigs.length && !libConfigs.length && !evtConfigs.length && !moduleConfigs.length)) {
        return Promise["resolve"]();
    }

    // build the payload to store
    var toStore = {};
    var descriptor;
    var encodedConfig;
    var i;

    for (i = 0; i < cmpConfigs.length; i++) {
        descriptor = cmpConfigs[i]["descriptor"];
        cmpConfigs[i]["uuid"] = context.findLoaded(descriptor);
        encodedConfig = $A.util.json.encode(cmpConfigs[i]);
        toStore[descriptor] = encodedConfig;
    }

    for (i = 0; i < libConfigs.length; i++) {
        descriptor = libConfigs[i]["descriptor"];
        encodedConfig = $A.util.json.encode(libConfigs[i]);
        toStore[descriptor] = encodedConfig;
    }

    for (i = 0; i < evtConfigs.length; i++) {
        descriptor = evtConfigs[i]["descriptor"];
        encodedConfig = $A.util.json.encode(evtConfigs[i]);
        toStore[descriptor] = encodedConfig;
    }

    for (i = 0; i < moduleConfigs.length; i++) {
        descriptor = moduleConfigs[i]["descriptor"];
        encodedConfig = $A.util.json.encode(moduleConfigs[i]);
        toStore[descriptor] = encodedConfig;
    }

    // if there's already a queue of defs to store then push this set
    // onto it and rely on the previous thread to do the persistence.
    if (this.defsToStore) {
        $A.util.apply(this.defsToStore, toStore, false, false);
        return Promise["resolve"]();
    }

    // this task is responsible to store the defs so acquire the mutex then persist
    this.defsToStore = toStore;
    var that = this;
    return this.enqueue(function(resolve, reject) {
        // store this task's defs + any that came in since acquiring the mutex
        var values = that.defsToStore;
        that.defsToStore = undefined;
        return that.storage.setAll(values)
            ["then"](
                function resolve() {
                    $A.log("ComponentDefStorage: successfully stored " + Object.keys(toStore).length + " defs");
                },
                function reject(e) {
                    $A.warning("ComponentDefStorage: error storing " + Object.keys(toStore).length + " defs", e);
                    // error storing defs so the persisted def graph doesn't match what's in aura.context.loaded.
                    // when the server subsequently returns defs it will prune those in aura.context.loaded so
                    // the persistent def graph becomes broken.
                    // 1. set the cookie indicating the persistent graph is broken.
                    // 2. reject this promise so the caller, AuraComponentService.saveDefsToStorage(), will
                    //    clear the def + action stores which removes the sentinel cookie.
                    // 3. if the page reloads before the stores are cleared the sentinel cookie prevents getAll()
                    //    from restoring any defs.
                    that.setBrokenGraphCookie();
                    throw e;
                }
            )
            ["then"](resolve, reject);
        });
};

/**
 * Removes definitions from storage.
 *
 * Must be called from within ComponentDefStorage.enqueue() for mutex. The mutex
 * is not acquired within this function because the entire selective eviction flow
 * (load, analyze, evict, repeat) must be atomic.
 *
 * @param {String[]} descriptors The descriptors identifying the definitions to remove.
 * @return {Promise} A promise that resolves when the definitions are removed.
 */
ComponentDefStorage.prototype.removeDefs = function(descriptors) {
    if (!this.useDefinitionStorage() || !descriptors.length) {
        return Promise["resolve"]();
    }

    var that = this;
    return this.storage.removeAll(descriptors)
        ["then"](
            function () {
                $A.log("ComponentDefStorage: Successfully removed " + descriptors.length + " descriptors");
                // TODO W-3375904 need to prune removed defs aura.context.loaded in a way that's safe with
                // in-flight XHRs that are returning pruned def graphs.
            },
            function (e) {
                $A.log("ComponentDefStorage: Error removing  " + descriptors.length + " descriptors", e);
                // error removing defs so the persisted def graph doesn't match what's in aura.context.loaded.
                // when the server subsequently returns defs it will prune those in aura.context.loaded so
                // the persistent def graph becomes broken.
                // 1. set the cookie indicating the persistent graph is broken.
                // 2. reject this promise so the caller, AuraComponentService.saveDefsToStorage(), will
                //    clear the def + action stores which removes the sentinel cookie.
                // 3. if the page reloads before the stores are cleared the sentinel cookie prevents getAll()
                //    from restoring any defs.
                that.setBrokenGraphCookie();
                throw e;
            }
        );
};


/**
 * Gets all definitions from storage.
 * @return {Promise} A promise that resolves with a map of descriptor name to definitions. If
 *  the underlying storage fails or is disabled then the promise resolves to an empty map.
 */
ComponentDefStorage.prototype.getAll = function () {
    if (!this.useDefinitionStorage()) {
        return Promise["resolve"]({});
    }

    // if broken def graph cookie is present do not restore any defs. instead
    // clear the stores so subsequently retrieved defs can be persisted.
    if (this.getBrokenGraphCookie()) {
        var metricsPayload = {
            "cause": "getAll",
            "error" : "broken def graph cookie"
        };
        return this.clear(metricsPayload);
    }

    // note: def AuraStorage mutex is not acquired to improve performance. this does allow for
    // writes from another tab to overlap def loading, resulting in this tab dumping caches.
    return this.storage.getAll([], true)["then"](
        function(items) {
            var result = {};
            for (var key in items) {
                var config = $A.util.json.decode(items[key]);
                if (config === null) {
                    throw new $A.auraError("Error decoding definition from storage: " + key, null, $A.severity.QUIET);
                }
                result[key] = config;
            }
            return result;
        }
        // intentionally let the error propagate to the caller
    );
};

/**
 * Asynchronously retrieves all definitions from storage and adds to component service.
 * @return {Promise} A promise that resolves when definitions are restored.
 */
ComponentDefStorage.prototype.restoreAll = function(context) {
    return this.getAll()
        ["then"](
            function(items) {
                var libCount = 0;
                var cmpCount = 0;
                var evtCount = 0;

                var moduleDefs = [];

                // Decode all items
                // TODO W-3037639 the following type checking is REALLY loose and flaky.
                // it needs to be replaced with actual type declaration values.
                for (var key in items) {
                    var config = items[key];

                    if (config[Json.ApplicationKey.TYPE]) { // It's an event (although the signature is... interesting)
                        if (!$A.eventService.getEventDef(config)) {
                            $A.eventService.saveEventConfig(config);
                        }
                        evtCount++;
                    } else if (config["includes"]) { // it's a library
                        if (!$A.componentService.hasLibrary(config["descriptor"])) {
                            $A.componentService.saveLibraryConfig(config);
                        }
                        libCount++;
                    } else if (config[Json.ApplicationKey.NAME] && config[Json.ApplicationKey.CODE]) {
                        // module definition - only module def serialization has NAME and CODE
                        moduleDefs.push(config);
                    } else {
                        // Otherwise, it's a component
                        if (config["uuid"]) {
                            context.addLoaded(config["uuid"]);
                        }
                        if (!$A.componentService.getComponentDef(config)) {
                            $A.componentService.saveComponentConfig(config);
                        }
                        cmpCount++;
                    }
                }

                if (moduleDefs.length > 0) {
                    // stores module definitions in moduleDefRegistry and class constructor creation is lazy
                    $A.componentService.initModuleDefs(moduleDefs);
                }

                $A.log("ComponentDefStorage: restored " + cmpCount + " components, " + libCount + " libraries, "
                    + evtCount + " events, " + moduleDefs.length + " modules from storage into registry");
            }
        )
        ["then"](
            undefined, // noop
            function(e) {
                $A.warning("ComponentDefStorage: error during restore from storage, no component, library or event defs restored", e);
                throw e;
            }
        );
};


/**
 * Enqueues a function that requires isolated access (including across tabs) to the underlying AuraStorage.
 * @param {Function} execute The function to execute.
 * @return {Promise} A promise that resolves when the provided function executes.
 */
ComponentDefStorage.prototype.enqueue = function(execute) {
    var that = this;

    // run the next item on the queue
    function executeQueue() {
        // should never happen
        if (!that.queue) {
            return;
        }

        var next = that.queue.pop();
        if (next) {
            $A.log("ComponentDefStorage.enqueue: " + (that.queue.length+1) + " items in queue, running next");
            $A.util.Mutex.lock(that.MUTEX_KEY, function(unlock) {
                // next["execute"] is run within a promise so may do async things (eg return other promises,
                // use setTimeout) before calling resolve/reject. the mutex must be held until the promise
                // resolves/rejects.
                that.mutexUnlock = unlock;
                next["execute"](next["resolve"], next["reject"]);
            });
        } else {
            that.queue = undefined;
        }
    }

    var promise = new Promise(function(resolve, reject) {
        // if something is in-flight then just enqueue
        if (that.queue) {
            that.queue.push({ "execute":execute, "resolve":resolve, "reject":reject });
            return;
        }

        // else run it immediately
        that.queue = [{ "execute":execute, "resolve":resolve, "reject":reject }];
        executeQueue();
    });

    // when this promise resolves or rejects, unlock the mutex then run the next item in the queue
    promise["then"](
        function() {
            try { that.mutexUnlock(); } catch (ignore) { /* ignored */ }
            executeQueue();
        },
        function() {
            try { that.mutexUnlock(); } catch (ignore) { /* ignored */ }
            executeQueue();
        }
    );

    return promise;
};


/**
 * Clears persisted definitions and all dependent stores and context.
 * @param {Object=} metricsPayload An optional payload to send to metrics service.
 * @return {Promise} A promise that resolves when all stores are cleared.
 */
ComponentDefStorage.prototype.clear = function(metricsPayload) {
    // if def storage isn't in use then nothing to do
    if (!this.useDefinitionStorage()) {
        this.clearBrokenGraphCookie();
        return Promise["resolve"]();
    }

    var that = this;
    return new Promise(function(resolve, reject) {
        // aura has an optimization whereby the client reports (on every XHR) to the server the
        // dynamic defs it has and the server doesn't resend those defs. this is managed in
        // aura.context.loaded.
        //
        // by clearing the persisted defs this optimization needs to be reset: the server must
        // send all defs so the client rebuilds a complete def graph for persistence. (the in-memory
        // graph remains complete at all times but when the app is restarted memory is reset.)
        //
        // to avoid an in-flight XHR from having a stale context.loaded value, def clearing is
        // carefully orchestrated:
        // 1. wait until no XHRs are in flight
        // 2. synchronously clear aura.context.loaded
        // 3. async acquire the def AuraStorage mutex
        // 4. async clear the actions store
        // 5. async clear the def store
        //
        // 1 & 2 ensures all future XHRs have a context.loaded value that matches the cleared def store.
        // because 3-5 are async it's possible that XHRs may be sent and received after 2 but
        // before 3-5 completes; that's ok because ComponentDefStorage#enqueue provides mutual exclusion
        // to def AuraStorage.

        // log that we're starting the clear
        metricsPayload = $A.util.apply({}, metricsPayload);
        metricsPayload["evicted"] = "all";
        $A.metricsService.transactionStart("aura", "performance:evictedDefs", { "context": { "attributes" : metricsPayload } });

        $A.clientService.runWhenXHRIdle(function() {
            $A.warning("ComponentDefStorage.clear: clearing all defs and actions");

            // clear aura.context.loaded
            // TODO W-3375904 broadcast this to other tabs
            $A.context.resetLoaded();


            // mutex across tabs
            that.enqueue(function(enqueueResolve) {
                    var errorDuringClear = false;

                    var actionClear;
                    var actionStorage = $A.clientService.getActionStorage();
                    if (actionStorage.isStoragePersistent()) {
                        // TODO W-3375904 need to reset the persistent actions filter
                        actionClear = actionStorage.clear()["then"](
                            undefined, // noop on success
                            function(e) {
                                $A.warning("ComponentDefStorage.clear: failure clearing actions store", e);
                                metricsPayload["actionsError"] = true;
                                errorDuringClear = true;
                                // do not rethrow to return to resolve state
                            }
                        );
                    } else {
                        actionClear = Promise["resolve"]();
                    }

                    var defClear = that.storage.clear()["then"](
                        undefined, // noop on success
                        function(e) {
                            $A.warning("ComponentDefStorage.clear: failure clearing cmp def store", e);
                            metricsPayload["componentDefStorageError"] = true;
                            errorDuringClear = true;
                            // do not rethrow to return to resolve state
                        }
                    );

                    var promise = Promise["all"]([actionClear, defClear])["then"](
                        function() {
                            // done the clearing. metricsPayload is updated with any errors
                            $A.metricsService.transactionEnd("aura", "performance:evictedDefs");
                            // only clear the cookie if def + action stores were successfully cleared
                            if (!errorDuringClear) {
                                that.clearBrokenGraphCookie();
                            }
                        }
                    );
                    enqueueResolve(promise);
                })
            ["then"](resolve, reject);
        });
    });
};


ComponentDefStorage.prototype.getBrokenGraphCookie = function() {
    var cookie = $A.util.getCookie(this.BROKEN_GRAPH_COOKIE);
    return cookie === "true";
};

ComponentDefStorage.prototype.setBrokenGraphCookie = function() {
    var duration = 1000*60*60*24*7; // 1 week
    $A.util.setCookie(this.BROKEN_GRAPH_COOKIE, "true", duration);
};

ComponentDefStorage.prototype.clearBrokenGraphCookie = function() {
    $A.util.clearCookie(this.BROKEN_GRAPH_COOKIE);
};




Aura.Component.ComponentDefStorage = ComponentDefStorage;
