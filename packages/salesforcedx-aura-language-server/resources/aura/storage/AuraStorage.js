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
 * @description The storage service implementation.
 * @constructor
 * @param {Object} config The configuration describing the characteristics of the storage to be created.
 * @export
 */
var AuraStorage = function AuraStorage(config) {
    // first generate key prefix so it may be passed to the adapter constructor
    this.version = "" + config["version"];
    this.keyPrefix = this.generateKeyPrefix(config["isolationKey"], this.version);
    config["keyPrefix"] = this.keyPrefix;

    // requests are queued until adapter indicates it is ready
    this.ready = undefined;
    this.queue = [];

    // if the primary adapter fails to init then fallback to a secondary adapter (memory)
    this.fallbackMode = false;

    // freeze to prevent mutation (config is reused if adapter fails initialization)
    this.config = Object.freeze(config);

    // create the adapter (init is done below)
    var AdapterCtr = config["adapterClass"];
    this.adapter = new AdapterCtr(this.config);
    this.adapterAntiObfuscation(this.adapter);

    // extract values this class uses
    this.name = config["name"];
    this.cacheStats = $A.metricsService.registerCacheStats('AuraStorage_' + this.name);
    
    this.maxSize = config["maxSize"];
    this.expiration = config["expiration"] * 1000;
    this.autoRefreshInterval = config["autoRefreshInterval"] * 1000;
    this.debugLogging = config["debugLogging"];

    // telemetry
    this.operationsInFlight = 0;

    // runtime stats
    this.stats = {
        size: -1 // unknown, populated on first call to getSize()
    };

    // frequency guard for sweeping
    this.sweepInterval = Math.min(Math.max(this.expiration*0.5, AuraStorage["SWEEP_INTERVAL"]["MIN"]), AuraStorage["SWEEP_INTERVAL"]["MAX"]);
    this.lastSweepTime = new Date().getTime();
    this.sweepingSuspended = false;

    this.sweepPromise = undefined;

    this.log(this.LOG_LEVEL.INFO, $A.util.format("initializing storage adapter using { maxSize: {0} KB, expiration: {1} sec, autoRefreshInterval: {2} sec, clearStorageOnInit: {3}, isolationKey: {4} }",
            (this.maxSize/1024).toFixed(1),
            (this.expiration/1000).toFixed(0),
            (this.autoRefreshInterval/1000).toFixed(0),
            config["clearOnInit"],
            this.keyPrefix
        ));

    // initialize the adapter
    this.adapter.initialize()["then"](this.adapterInitialize.bind(this, true), this.adapterInitialize.bind(this, false));
};

/** Log levels */
AuraStorage.prototype.LOG_LEVEL = {
    INFO:    { id: 0, fn: "log" },
    WARNING: { id: 1, fn: "warning" }
};

/**
 * Anti-obfuscate to support adapters provided by non-framework.
 */
AuraStorage.prototype.adapterAntiObfuscation = function(adapter) {
    // functions not guarded by this.ready
    adapter.initialize = adapter.initialize || adapter["initialize"];
    adapter.getName = adapter.getName || adapter["getName"];
    adapter.isSecure = adapter.isSecure || adapter["isSecure"];
    adapter.isPersistent = adapter.isPersistent || adapter["isPersistent"];
    adapter.suspendSweeping = adapter.suspendSweeping || adapter["suspendSweeping"];
    adapter.resumeSweeping = adapter.resumeSweeping || adapter["resumeSweeping"];

    // functions guarded by this.ready
    adapter.setItems = adapter.setItems || adapter["setItems"];
    adapter.getItems = adapter.getItems || adapter["getItems"];
    adapter.removeItems = adapter.removeItems || adapter["removeItems"];
    adapter.clear = adapter.clear || adapter["clear"];
    adapter.sweep = adapter.sweep || adapter["sweep"];
    adapter.getSize = adapter.getSize || adapter["getSize"];
    adapter.deleteStorage = adapter.deleteStorage || adapter["deleteStorage"];

    //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    // for storage adapter testing
    this["adapter"] = adapter;
    adapter["getItems"] = adapter.getItems;
    adapter["getMRU"] = adapter.getMRU;
    adapter["getSize"] = adapter.getSize;
    adapter["sweep"] = adapter.sweep;
    //#end
};

/**
 * Returns the name of the storage adapter. For example, "indexeddb" or "memory".
 * @returns {String} The storage adapter's name.
 * @export
 */
AuraStorage.prototype.getName = function() {
    return this.adapter.getName();
};

/**
 * Gets the current storage size in KB.
 * @returns {Promise} A promise that resolves to the current storage size in KB.
 * @export
 */
AuraStorage.prototype.getSize = function() {
    return this.enqueue(this.getSizeInternal.bind(this));
};

AuraStorage.prototype.getSizeInternal = function(resolve, reject) {
    var that = this;
    this.adapter.getSize()
        ["then"](
            function(size) {
                that.stats.size = parseInt(size/1024.0, 10);
                return size / 1024.0;
            }
        )
        ["then"](resolve, reject);
};


/**
 * Returns the maximum storage size in KB.
 * @returns {number} The maximum storage size in KB.
 * @export
 */
AuraStorage.prototype.getMaxSize = function() {
    return this.maxSize / 1024.0;
};

/**
 * Enqueues a function to execute when the adapter is ready.
 * @param {Function} execute the function to execute.
 * @returns {Promise} a promise that resolves when the function is executed.
 * @private
 */
AuraStorage.prototype.enqueue = function(execute) {
    var that = this;

    // adapter is ready so execute immediately
    if (this.ready === true) {
        return new Promise(function(resolve, reject) { execute(resolve, reject); });
    }
    // adapter is in permanent error state
    else if (this.ready === false) {
        // already logged when permanent error state entered so do not re-log each operation
        return Promise["reject"](new Error(this.getInitializationError()));
    }

    // adapter not yet initialized
    return new Promise(function(resolve, reject) {
        that.queue.push({ "execute":execute, "resolve":resolve, "reject":reject});
        if (that.ready !== undefined) {
            // rare race condition. intentionally do not pass a new ready state.
            that.executeQueue();
        }
    });
};

/**
 * Callback function provided to adapters to indicate initialization is complete.
 * @param {Boolean} readyState true if the adapter successfully completed initialization, false if initialization failed.
 * @param {Error} error details if initialization failed, undefined otherwise.
 * @private
 */
AuraStorage.prototype.adapterInitialize = function(readyState, error) {
    if (this.ready !== undefined) {
        return;
    }

    // if primary adapter failed then fallback to memory
    if (!readyState && !this.fallbackMode) {
        this.log(this.LOG_LEVEL.WARNING, $A.util.format("adapterReady(): {0} adapter failed initialization, falling back to memory adapter", this.adapter.getName()));
        this.logError({ "operation":"adapterReady", "error":error });

        this.fallbackMode = true;
        var adapterClass = $A.storageService.getAdapterConfig(Aura.Storage.MemoryAdapter.NAME)["adapterClass"];
        this.adapter = new adapterClass(this.config);
        this.adapterAntiObfuscation(this.adapter);
        this.adapter.initialize()["then"](this.adapterInitialize.bind(this, true), this.adapterInitialize.bind(this, false));
        return;
    }

    // adapter is ready (either success or permanent error state)
    var that = this;
    var promise;
    // clear adapter prior to processing the queue
    if (readyState && this.config["clearOnInit"]) {
        promise = new Promise(function(resolve, reject) {
            that.clearInternal(resolve, reject);
        })
        ["then"](undefined, function() {
            // no-op to move promise to resolve state
        });
    } else {
        promise = Promise["resolve"]();
    }

    promise["then"](function() {
        // flip the switch so subsequent requests are immediately processed
        that.ready = !!readyState;
        that.executeQueue();
    });
};


/**
 * Runs the pending queue of requests.
 * @private
 */
AuraStorage.prototype.executeQueue = function() {
    var queue = this.queue;
    this.queue = [];

    if (this.ready) {
        this.log(this.LOG_LEVEL.INFO, "executeQueue(): adapter completed initialization. Processing " + queue.length + " operations.");
    } else {
        var message = "executeQueue(): adapter failed initialization, entering permanent error state. All future operations will fail. Failing " + queue.length + " enqueued operations.";
        this.log(this.LOG_LEVEL.WARNING, message);
        this.logError({"operation":"initialize", "error":message});
    }


    for (var i = 0; i < queue.length; i++) {
        if (!this.ready) {
            // adapter is in permanent error state, reject all queued promises
            queue[i]["reject"](new Error(this.getInitializationError()));
        } else {
            try {
                // run the queued logic, which will resolve the promises
                queue[i]["execute"](queue[i]["resolve"], queue[i]["reject"]);
            } catch (e) {
                queue[i]["reject"](e);
            }
        }
    }
};


/**
 * Gets the error message when the adapter fails to initialize.
 * @private
 */
AuraStorage.prototype.getInitializationError = function() {
    // should use same format as log()
    return "AuraStorage[" + this.name + "] adapter failed to initialize";
};


/**
 * Returns a promise that clears the storage.
 * @returns {Promise} A promise that will clear storage.
 * @export
 */
AuraStorage.prototype.clear = function() {
    return this.enqueue(this.clearInternal.bind(this));
};

AuraStorage.prototype.clearInternal = function(resolve, reject) {
    var that = this;
    this.operationsInFlight += 1;
    this.adapter.clear()
        ["then"](
            function() {
                that.operationsInFlight -= 1;
                that.fireModified();
            },
            function(e) {
                that.operationsInFlight -= 1;
                that.logError({ "operation":"clear", "error":e });
                throw e;
            }
        )
        ["then"](resolve, reject);
};


/**
 * Asynchronously gets an item from storage corresponding to the specified key.
 * @param {String} key The key of the item to retrieve.
 * @param {Boolean=} includeExpired True to return expired items, false to not return expired items.
 * @returns {Promise} A promise that resolves to the stored item or undefined if the key is not found.
 * @export
 */
AuraStorage.prototype.get = function(key, includeExpired) {
    $A.assert($A.util.isString(key), "AuraStorage.get(): 'key' must be a String.");
    $A.assert(!includeExpired || $A.util.isBoolean(includeExpired), "AuraStorage.get(): 'includeExpired' must be a Boolean.");

    return this.getAll([key], includeExpired)
        ["then"](
            function(items) {
                if (items) {
                    return items[key];
                }
                return undefined;
            }
        );
};

/**
 * Gets the count of in-flight operations. Note that it's possible the underlying
 * adapter is performing operations that are not triggered from this API.
 * @returns {Number} Number of operations currently waiting on being resolved.
 * @export
 */
AuraStorage.prototype.inFlightOperations = function() {
    return this.operationsInFlight + this.queue.length;
};


/**
 * Asynchronously gets multiple items from storage.
 * @param {String[]} [keys] The set of keys to retrieve. Empty array or falsey to retrieve all items.
 * @param {Boolean} [includeExpired] True to return expired items, falsey to not return expired items.
 * @returns {Promise} A promise that resolves to an object that contains key-value pairs. {key: storedItem}
 * @export
 */
AuraStorage.prototype.getAll = function(keys, includeExpired) {
    $A.assert(!keys || Array.isArray(keys), "AuraStorage.getAll(): 'keys' must be an Array.");
    $A.assert(!includeExpired || $A.util.isBoolean(includeExpired), "AuraStorage.getAll(): 'includeExpired' must be a Boolean.");

    return this.enqueue(this.getAllInternal.bind(this, keys, includeExpired));
};

AuraStorage.prototype.getAllInternal = function(keys, includeExpired, resolve, reject) {
    var that = this;

    // helper function to log cache hits & misses
    function logHitsAndMisses(storageResults, hitsCount) {
        that.cacheStats["logHits"](hitsCount);
        that.cacheStats["logMisses"](keys.length - hitsCount);

        if (that.debugLogging){
            var hit = [], miss = [];
            var key;
            for (var j = 0; j < keys.length; j++) {
                key = keys[j];
                if (storageResults.hasOwnProperty(key)) {
                    hit.push(key);
                } else {
                    miss.push(key);
                }
            }
            if (hit.length > 0) {
                that.log(that.LOG_LEVEL.INFO, "getAll() - HIT on key(s): " + hit.join(", "));
            }
            if (miss.length > 0) {
                that.log(that.LOG_LEVEL.INFO, "getAll() - MISS on key(s): " + miss.join(", "));
            }
        }
    }

    var prefixedKeys;
    var isKeysPresent = Array.isArray(keys) && keys.length > 0;
    if (isKeysPresent) {
        prefixedKeys = [];
        for (var i = 0; i < keys.length; i++) {
            prefixedKeys.push(this.keyPrefix + keys[i]);
        }
    }

    this.operationsInFlight += 1;
    this.adapter.getItems(prefixedKeys, includeExpired)
        ["then"](
            function(items) {
                that.operationsInFlight -= 1;
                var now = new Date().getTime();
                var results = {};
                var item;
                var key;
                var hitsCount = 0;
                for (var k in items) {
                    item = items[k];
                    if (k.indexOf(that.keyPrefix) === 0 && (includeExpired || now < item["expires"])) {
                        hitsCount++;
                        key = k.substring(that.keyPrefix.length);
                        results[key] = item["value"];
                    }
                    // wrong isolationKey/version or item is expired so ignore the entry
                    // TODO - capture entries to be removed async
                }
                
                // explicit logging check because this is costly
                if (isKeysPresent) {
                    logHitsAndMisses(results, hitsCount);
                }

                return results;
            }
        )
        ["then"](
            undefined,
            function(e) {
                that.operationsInFlight -= 1;
                that.logError({ "operation":"getAll", "error":e });
                throw e;
            }
        )
        ["then"](resolve, reject);
};

/**
 * Builds the payload to store in the adapter.
 * @param {String} key The key of the item to store.
 * @param {*} value The value of the item to store.
 * @param {Number} now The current time (milliseconds).
 * @returns {Array} A key-value-size tuple to pass to the adapter's setItems.
 * @private
 */
AuraStorage.prototype.buildPayload = function(key, value, now) {
    var encoded = false;
    // For the size calculation, consider only the inputs to the storage layer: key and value.
    var size = $A.util.estimateSize("" + key);
    if (this.adapter.encodeValue) {
        try {
            value = this.adapter.encodeValue(value);
            encoded = true;
            size += value.length;
        } catch (e) {
            // if encoding is required in the store, it will reject later on when attempting to encode again
            // because encoded will be false
        }
    }
    if (!encoded) {
        size += $A.util.estimateSize(value);
    }
    if (size > this.maxSize) {
        throw new Error("AuraStorage.set() cannot store " + key + " of size " + size + "b because it's over the max size of " + this.maxSize + "b");
    }

    return [
        this.keyPrefix + key,
        {
            "value": value,
            "created": now,
            "expires": now + this.expiration,
            "valueEncoded": encoded
        },
        size
    ];
};

/**
 * Asynchronously stores the value in storage using the specified key.
 * @param {String} key The key of the item to store.
 * @param {*} value The value of the item to store.
 * @returns {Promise} A promise that resolves when are stored.
 * @export
 */
AuraStorage.prototype.set = function(key, value) {
    $A.assert($A.util.isString(key), "AuraStorage.set(): 'key' must be a String.");

    var values = {};
    values[key] = value;
    return this.setAll(values);
};

/**
 * Asynchronously stores multiple values in storage. All or none of the values are stored.
 * @param {Object} values The key-values to store. Eg <code>{key1: value1, key2: value2}</code>.
 * @returns {Promise} A promise that resolves when all of the key-values are stored.
 * @export
 */
AuraStorage.prototype.setAll = function(values) {
    $A.assert($A.util.isObject(values), "AuraStorage.setAll(): 'values' must be an Object.");

    return this.enqueue(this.setAllInternal.bind(this, values));
};

AuraStorage.prototype.setAllInternal = function(values, resolve, reject) {
    var now = new Date().getTime();
    var storablesSize = 0;
    var storables = [];
    var storable;
    try {
        for (var key in values) {
            storable = this.buildPayload(key, values[key], now);
            storables.push(storable);
            storablesSize += storable[2];
        }
    } catch (e) {
        this.logError({ "operation":"setAll", "error":e });
        reject(e);
        return;
    }

    if (storablesSize > this.maxSize) {
        var e2 = new Error("AuraStorage.set() cannot store " + Object.keys(values).length + " items of total size " + storablesSize + "b because it's over the max size of " + this.maxSize + "b");
        this.logError({ "operation":"setAll", "error":e2 });
        reject(e2);
        return;
    }

    var that = this;
    this.operationsInFlight += 1;
    this.adapter.setItems(storables)
        ["then"](
            function() {
                that.operationsInFlight -= 1;
                var keys = Object.keys(values);
                that.log(that.LOG_LEVEL.INFO, "setAll() - " + keys.length + " key(s): " + keys.join(", "));
                that.fireModified();
            },
            function(e) {
                that.operationsInFlight -= 1;
                that.logError({ "operation":"setAll", "error":e });
                throw e;
            }
        )
        ["then"](resolve, reject);

    this.sweep();
};


/**
 * Asynchronously removes the value from storage corresponding to the specified key.
 * @param {String} key The key of the value to remove.
 * @param {Boolean} doNotFireModified Whether to fire the modified event on item removal.
 * @returns {Promise} A promise that will remove the value from storage.
 * @export
 */
AuraStorage.prototype.remove = function(key, doNotFireModified) {
    $A.assert($A.util.isString(key), "AuraStorage.remove(): 'key' must be a String.");
    $A.assert(!doNotFireModified || $A.util.isBoolean(doNotFireModified), "AuraStorage.remove(): 'doNotFireModified' must be a Boolean.");

    return this.removeAll([key], doNotFireModified);
};

/**
 * Asynchronously removes multiple values from storage. All or none of the values are removed.
 * @param {String[]} keys The keys of the values to remove.
 * @param {Boolean=} doNotFireModified Whether to fire the modified event on item removal.
 * @returns {Promise} A promise that resolves when all of the values are removed.
 * @export
 */
AuraStorage.prototype.removeAll = function(keys, doNotFireModified) {
    $A.assert($A.util.isArray(keys), "AuraStorage.removeAll(): 'keys' must be an Array.");
    $A.assert(doNotFireModified === undefined || $A.util.isBoolean(doNotFireModified), "AuraStorage.removeAll(): 'doNotFireModified' must be undefined or a Boolean.");

    return this.enqueue(this.removeAllInternal.bind(this, keys, doNotFireModified));
};

AuraStorage.prototype.removeAllInternal = function(keys, doNotFireModified, resolve, reject) {
    var prefixedKeys = [];
    for (var i = 0; i < keys.length; i++) {
        prefixedKeys.push(this.keyPrefix + keys[i]);
    }

    var that = this;
    this.operationsInFlight += 1;
    this.adapter.removeItems(prefixedKeys)
        ["then"](
            function() {
                that.operationsInFlight -= 1;
                if (that.debugLogging) {
                    for (i = 0; i < prefixedKeys.length; i++) {
                        that.log(that.LOG_LEVEL.INFO, "removeAll() - key " + prefixedKeys[i]);
                    }
                }

                if (!doNotFireModified) {
                    that.fireModified();
                }
            },
            function(e) {
                that.operationsInFlight -= 1;
                that.logError({ "operation":"removeAll", "error":e });
                throw e;
            }
        )
        ["then"](resolve, reject);
};


/**
 * Asynchronously sweeps the store to remove expired items.
 * @param {Boolean} ignoreInterval True to ignore minimum sweep intervals.
 * @return {Promise} A promise that resolves when sweeping is completed.
 * @private
 */
AuraStorage.prototype.sweep = function(ignoreInterval) {
    $A.assert(ignoreInterval === undefined || $A.util.isBoolean(ignoreInterval), "AuraStorage.sweep(): 'ignoreInterval' must be undefined or a Boolean.");

    // sweeping guards:
    // 1. sweeping is in progress
    if (this.sweepPromise) {
        return this.sweepPromise;
    }
    // 2. adapter isn't ready
    if (!this.ready) {
        return Promise["resolve"]();
    }
    // 3. framework hasn't finished init'ing
    if (!$A["finishedInit"]) {
        return Promise["resolve"]();
    }
    // 4. frequency (yet respect ignoreInterval)
    var sweepInterval = new Date().getTime() - this.lastSweepTime;
    if (!ignoreInterval && sweepInterval < this.sweepInterval) {
        return Promise["resolve"]();
    }

    // 5. sweeping has been suspended. often set when the client goes offline or the store's size is being manually managed.
    if (this.sweepingSuspended) {
        // though sweeping is suspended we still want to track stats
        this.logStats();
        return Promise["resolve"]();
    }

    // Final thenable on sweep() promise chain.
    // @param {Boolean} doNotFireModified true if no items were evicted.
    // @param {Error} e the error if the promise was rejected
    function doneSweeping(doNotFireModified, e) {
        this.operationsInFlight -= 1;

        this.log(this.LOG_LEVEL.INFO, "sweep() - complete" + (e ? " (with errors)" : ""));
        this.logStats();

        this.sweepPromise = undefined;
        this.lastSweepTime = new Date().getTime();
        if (!doNotFireModified) {
            this.fireModified();
        }
        // do not re-throw any error
    }

    // start the sweep + prevent concurrent sweeps
    this.operationsInFlight += 1;
    this.sweepPromise = this.adapter.sweep()["then"](
            undefined, // noop
            function(e) {
                this.logError({ "operation":"sweep", "error":e });
                throw e;
            }.bind(this)
        )
        ["then"](doneSweeping.bind(this), doneSweeping.bind(this,true));

    return this.sweepPromise;
};


/**
 * Suspends sweeping.
 *
 * Expired storage entries are proactively removed by sweeping. Sweeping is often suspended
 * when the connection goes offline so expired items remain accessible.
 * @export
 */
AuraStorage.prototype.suspendSweeping = function() {
    this.log(this.LOG_LEVEL.INFO, "suspendSweeping()");

    this.sweepingSuspended = true;

    if (this.adapter.suspendSweeping) {
        this.adapter.suspendSweeping();
    }
};


/**
 * Resumes sweeping to remove expired storage entries.
 * @export
 */
AuraStorage.prototype.resumeSweeping = function() {
    this.log(this.LOG_LEVEL.INFO, "resumeSweeping()");

    this.sweepingSuspended = false;

    if (this.adapter.resumeSweeping) {
        this.adapter.resumeSweeping();
    }

    this.sweep();
};


/**
 * Log a message.
 * @param {LOG_LEVEL} level The log level.
 * @param {String} msg The msg to log.
 * @param {Object} [obj] Optional object to log.
 * @private
 */
AuraStorage.prototype.log = function(level, msg, obj) {
    if (this.debugLogging || level.id >= this.LOG_LEVEL.WARNING.id) {
        $A[level.fn]("AuraStorage['" + this.name + "'] " + msg, obj);
    }
};


/**
 * Logs an error to the server.
 * @param {Object} payload The error payload object.
 * @param {String} payload.operation The operation which errored (eg get, set).
 * @param {Error=} payload.error Optional error object.
 * @private
 */
AuraStorage.prototype.logError = function(payload) {
    $A.metricsService.transaction("aura", "error:storage", { "context": {
        "attributes" : {
            "name"      : this.name,
            "adapter"   : this.getName(),
            "operation" : payload["operation"],
            "error"     : payload["error"] && payload["error"].toString()
        }
    }});
};


/**
 * Logs runtime statistics to the server.
 * @private
 */
AuraStorage.prototype.logStats = function() {
    // only stores with successfully init'ed adapters have meaningful runtime stats
    if (this.ready !== true) {
        return;
    }

    $A.metricsService.transaction("aura", "performance:storage-stats", { "context": {
        "attributes" : {
            "name"      : this.name,
            "adapter"   : this.getName(),
            "sizeKB"      : this.stats.size,
            "maxSizeKB"   : parseInt(this.getMaxSize(), 10)
        }
    }});
};


/**
 * Whether the storage implementation is persistent.
 * @returns {boolean} True if persistent.
 * @export
 */
AuraStorage.prototype.isPersistent = function() {
    return this.adapter.isPersistent();
};


/**
 * Whether the storage implementation is secure.
 * @returns {boolean} True if secure.
 * @export
 */
AuraStorage.prototype.isSecure = function() {
    return this.adapter.isSecure();
};


/**
 * Returns the storage version.
 * @returns {String} The storage version.
 * @export
 */
AuraStorage.prototype.getVersion  = function() {
    return this.version;
};


/**
 * Returns the expiration in seconds.
 * @returns {Number} The expiration in seconds.
 * @export
 */
AuraStorage.prototype.getExpiration = function() {
    return this.expiration / 1000;
};


/**
 * Returns the auto-refresh interval in seconds.
 * @returns {Number} The auto-refresh interval in seconds.
 */
AuraStorage.prototype.getDefaultAutoRefreshInterval = function() {
    return this.autoRefreshInterval;
};


/**
 * Asynchronously deletes this storage.
 * @private
 */
AuraStorage.prototype.deleteStorage = function() {
    return this.enqueue(this.deleteStorageInternal.bind(this));
};

AuraStorage.prototype.deleteStorageInternal = function(resolve, reject) {
    this.cacheStats["unRegister"]();

    if (!this.adapter.deleteStorage) {
        resolve();
        return;
    }

    var that = this;
    this.adapter.deleteStorage()
        ["then"](
            undefined,
            function(e) {
                that.logError({ "operation":"deleteStorage", "error":e });
                throw e;
            }
        )
        ["then"](resolve, reject);
};

/**
 * Generates the key prefix for storage.
 * @param {String} isolationKey The isolation key.
 * @param {String} version The version.
 * @private
 */
AuraStorage.prototype.generateKeyPrefix = function(isolationKey, version) {
    return "" + isolationKey + version + AuraStorage.KEY_DELIMITER;
};

/**
 * Fires an auraStorage:modified event for this storage.
 * @private
 */
AuraStorage.prototype.fireModified = function() {
    var e = $A.eventService.getNewEvent("markup://auraStorage:modified");
    if (e) {
        e.fire({"name": this.name});
    }
};


/**
 * Storage key delimiter, separating isolation and version key from
 * the user-provided key.
 * @private
 */
AuraStorage.KEY_DELIMITER = ":";

/**
 * Sweep intervals (milliseconds).
 */
AuraStorage["SWEEP_INTERVAL"] = {
        "MIN": 60000, // 1 min
        "MAX": 300000 // 5 min
};


Aura.Storage.AuraStorage = AuraStorage;
