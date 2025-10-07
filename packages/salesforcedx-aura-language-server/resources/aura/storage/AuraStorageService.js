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
 * @description The Aura Storage Service, accessible using <code>$A.storageService</code>.
 * @constructor
 * @export
 */
function AuraStorageService() {
    this.storages = {};
    this.adapters = {};
    this.version = "";
    this.isolationKey = "";
    this.partitionName = "";
}

/**
 * Returns an existing storage using the specified name.
 * For example, <code>$A.storageService.getStorage("MyStorage").getSize()</code> returns the size of MyStorage.
 * <p>See Also: <a href="#reference?topic=api:AuraStorage">AuraStorage</a></p>
 * @param {String} name The name of the requested storage.
 * @memberOf AuraStorageService
 * @returns {AuraStorage} Returns an AuraStorage object corresponding to an existing storage.
 * @export
 */
AuraStorageService.prototype.getStorage = function(name) {
    $A.assert($A.util.isString(name), "AuraStorageService.getStorage(): 'name' must be a String.");
    return this.storages[name];
};


/**
 * Returns all existing storages.
 * <p>See Also: <a href="#reference?topic=api:AuraStorage">AuraStorage</a></p>
 * @memberOf AuraStorageService
 * @returns {Object} Returns a map of storage names to AuraStorage objects.
 * @export
 */
AuraStorageService.prototype.getStorages = function() {
    return $A.util.apply({}, this.storages);
};


/**
 * Initializes and returns a new storage.
 *
 * @example
 * var storage = $A.storageService.initStorage({
 *     "name":                "MyStorage",
 *     "persistent":          true,
 *     "secure":              true,
 *     "maxSize":             524288, // (bytes) (512 * 1024)
 *     "expiration":          600,    // (seconds)
 *     "autoRefreshInterval": 600,    // (seconds)
 *     "debugLogging":        true,
 *     "clearOnInit":         false
 * });
 *
 * @param {Object} config The configuration for the new storage. The name property is required. All other properties are optional.
 * @param {String} config.name Required. The unique name of the storage to be initialized.
 * @param {Boolean=} config.persistent Set to true if storage can be persistent. Default is false.
 * @param {Boolean=} config.secure Set to true if storage must be secure. Default is false.
 * @param {Number=} config.maxSize Specifies the maximum storage size (bytes). Default is 1000KB.
 * @param {Number=} config.expiration Specifies the time (seconds) after which an item expires. When an item is requested that has gone past the expiration time, it will not be used. Default is 10s.
 * @param {Boolean=} config.debugLogging Set to true to enable debug logging in the JavaScript console. Default is false.
 * @param {Boolean=} config.clearOnInit Set to true to clear storage when storage is initialized. Default is true.
 * @param {String=} config.version The version of the storage. Only items matching the version are returned. This is useful to avoid retrieving items for an older version of your application. Default is "".
 * @param {Number=} config.autoRefreshInterval Specifies the interval (seconds) after which an item is to be refreshed. The caller must track and perform the refresh itself. Default is 30s.
 * @memberOf AuraStorageService
 * @returns {AuraStorage} Returns an AuraStorage object for the new storage.
 * @export
 */
AuraStorageService.prototype.initStorage = function(config) {
    $A.assert($A.util.isObject(config), "config must be an object");
    $A.assert($A.util.isString(config["name"]) && config["name"], "name must be a non-empty string");
    $A.assert(!this.storages[config["name"]], "Storage named '" + config["name"] + "' already exists");

    
    // There's a boundary condition where expiration could be between Number.MAX_VALUE/1000 and Number.MAX_VALUE.
    // AuraStorage.js config takes the expiration and multiplies by 1000.
    // See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_VALUE
    var expiration = 10, MAX_EXPIRATOIN = Number.MAX_VALUE / 1000;
    if ($A.util.isFiniteNumber(config["expiration"]) && config["expiration"] > 0) {
        expiration = config["expiration"];

        // if it's an extremely large number, divide by 1000 to represent as seconds instead of ms.
        if (expiration > MAX_EXPIRATOIN) {
            expiration = MAX_EXPIRATOIN;
        }
    }

    // default values come from <auraStorage:init/>
    var validatedConfig = {
        "name": config["name"],
        "persistent": !!config["persistent"],
        "secure": !!config["secure"],
        "maxSize": $A.util.isFiniteNumber(config["maxSize"]) && config["maxSize"] > 0 ? config["maxSize"] : 1000 * 1024,
        "expiration": expiration,
        "debugLogging": !!config["debugLogging"],
        "clearOnInit": $A.util.isBoolean(config["clearOnInit"]) ? config["clearOnInit"] : true,
        // falsey values, like <auraStorage:init/>'s default empty string, are treated as not specified
        "version": config["version"] ? "" + config["version"] : this.version,
        "isolationKey": this.isolationKey,
        "autoRefreshInterval": $A.util.isFiniteNumber(config["autoRefreshInterval"]) && config["autoRefreshInterval"] >= 0 ? config["autoRefreshInterval"] : 30,
        "partitionName": this.partitionName
    };

    var adapterName = this.selectAdapter(validatedConfig["persistent"], validatedConfig["secure"]);
    validatedConfig["adapterClass"] = this.adapters[adapterName]["adapterClass"];

    var storage = new AuraStorage(validatedConfig);
    this.storages[validatedConfig["name"]] = storage;
    return storage;
};


/**
 * Registers a new Aura Storage Service adapter.
 *
 * @param {Object} config Adapter configuration object.
 * @param {String} config.name Name of the adapter. Must be unique among adapters.
 * @param {AuraStorageAdapter} config.adapterClass Constructor function of the adapter.
 * @param {Boolean} config.persistent True if the adapter is persistent.
 * @param {Boolean} config.secure True if the adapter is secure.
 * @memberOf AuraStorageService
 * @export
 */
AuraStorageService.prototype.registerAdapter = function(config) {
    $A.assert($A.util.isString(config["name"]) && config["name"], "config.name must be a non-empty string");
    $A.assert($A.util.isFunction(config["adapterClass"]), "config.adapterClass must be a function");
    $A.assert(!this.adapters[config["name"]], "Adapter '" + config["name"] + "' already registered");

    var validatedConfig = {
        "name": config["name"],
        "adapterClass": config["adapterClass"],
        "persistent": !!config["persistent"],
        "secure": !!config["secure"]
    };

    this.adapters[validatedConfig["name"]] = validatedConfig;
};

/**
 * Whether an adapter is registered
 *
 * @param {String} name The adapter's name.
 * @returns {Boolean} Whether adapter is registered.
 * @memberOf AuraStorageService
 * @export
 */
AuraStorageService.prototype.isRegisteredAdapter = function(name) {
    $A.assert($A.util.isString(name), "AuraStorageService.isRegisteredAdapter(): 'name' must be a String.");
    return this.adapters[name] !== undefined;
};

/**
 * Returns an adapter's configuration.
 *
 * @param {String} adapter Name of the adapter.
 * @memberOf AuraStorageService
 * @export
 */
AuraStorageService.prototype.getAdapterConfig = function(adapter) {
    return this.adapters[adapter];
};

/**
 * Selects an adapter based on the given configuration. Some configuration is a hard requirement;
 * other is best effort.
 * @param {Boolean} persistent Set to true if the adapter should be persistent.
 * @param {Boolean} secure Set to true if the adapter must be secure.
 * @return {String} The name of the selected adapter.
 * @memberOf AuraStorageService
 //#if {"excludeModes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
	@export
 //#end
 */
AuraStorageService.prototype.selectAdapter = function(persistent, secure) {
    // Find the best match for the specific implementation based on the requested configuration
    var candidates = [];
    for (var name in this.adapters) {
        var adapter = this.adapters[name];

        // If secure is required then find all secure adapters otherwise use any adapter
        if (!secure || adapter["secure"] === true) {
            candidates.push(adapter);
        }
    }

    // failure case that should never be possible: fallback to memory
    if (candidates.length === 0) {
        $A.assert(this.adapters[Aura.Storage.MemoryAdapter.NAME], "Memory Aura Storage Adapter was not registered");
        return Aura.Storage.MemoryAdapter.NAME;
    }

    // Now take the set of candidates and weed out any non-persistent if persistence is requested (not required)
    var match;
    for (var n = 0; !match && n < candidates.length; n++) {
        var candidate = candidates[n];
        var candidateIsPersistent = candidate["persistent"];
        if ((persistent && candidateIsPersistent === true) || (!persistent && !candidateIsPersistent)) {
            match = candidate;
        }
    }

    if (!match) {
        match = candidates[0];
    }

    return match["name"];
};

/**
 * Deletes a storage.
 * @param {String} name name of storage to delete.
 * @return {Promise} a promise that resolves when the specified storage is deleted.
 * @export
 */
AuraStorageService.prototype.deleteStorage = function(name) {
    $A.assert($A.util.isString(name), "AuraStorageService.deleteStorage(): 'name' must be a String.");

    var storage = this.getStorage(name);
    if (!storage) {
        return Promise["resolve"]();
    }

    delete this.storages[name];
    return storage.deleteStorage();
};

/**
 * Sets the default version for all storages.
 * @param {String} version default version for storages.
 * @export
 */
AuraStorageService.prototype.setVersion = function(version) {
    // ensure string
    this.version = (version || "") + "";
};

/**
 * Gets the default version for all storages.
 * @return {String} the default version for storages.
 * @export
 */
AuraStorageService.prototype.getVersion = function() {
    return this.version;
};

/**
 * Sets a key from which isolation in the storage system is enforced.
 *
 * This mechanism is typically used to isolate multiple users' data by setting
 * the isolation key to the user id.
 *
 * It should only be called once during the application life cycle, since it
 * will be deleted after invocation in production mode.
 *
 *
 * @param {String} isolationKey the key defining isolation.
 * @export
 */
AuraStorageService.prototype.setIsolation = function(isolationKey) {
    // ensure string
    this.isolationKey = "" + (isolationKey || "");

    //#if {"modes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    delete AuraStorageService.prototype.setIsolation;
    delete AuraStorageService.prototype["setIsolation"];
    //#end

};

/**
 * Sets a name for the table within the storage system.
 *
 * This mechanism is typically used to distinguish storage tables from one another
 * when no context has been set.
 *
 * It should only be called once during the application life cycle, since it
 * will be deleted after invocation in production mode.
 *
 * @param {String} partitionName the name to define a table.
 * @export
 */
AuraStorageService.prototype.setPartition = function(partitionName) {
    // ensure string
    this.partitionName = "" + (partitionName || "");

    //#if {"modes" : ["PRODUCTION", "PRODUCTIONDEBUG", "PERFORMANCEDEBUG"]}
    delete AuraStorageService.prototype.setPartitionName;
    delete AuraStorageService.prototype["setPartitionName"];
    //#end
};

Aura.Services.AuraStorageService = AuraStorageService;
