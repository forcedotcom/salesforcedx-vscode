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
 * @description The Javascript memory adapter for Aura Storage Service.
 * This adapter must always be registered to ensure at least one adapter is available.
 *
 * @constructor
 */
var MemoryAdapter = function MemoryAdapter(config) {
    this.reset();
    this.maxSize = config["maxSize"];
    this.instanceName = config["name"];
    this.debugLogging = config["debugLogging"];
};

MemoryAdapter.NAME = "memory";

/** Log levels */
MemoryAdapter.LOG_LEVEL = {
    INFO:    { id: 0, fn: "log" },
    WARNING: { id: 1, fn: "warning" }
};

/**
 * Resets memory objects.
 */
MemoryAdapter.prototype.reset = function() {
    this.backingStore = {};
    this.mru = [];
    this.cachedSize = 0; // bytes
};

/**
 * Gets the name of the adapter.
 * @returns {String} Name of adapter
 */
MemoryAdapter.prototype.getName = function() {
    return MemoryAdapter.NAME;
};

/**
 * Starts the initialization process.
 * @return {Promise} a promise that resolves when initialization has completed, or rejects if initialization has failed.
 */
MemoryAdapter.prototype.initialize = function() {
    return Promise["resolve"]();
};

/**
 * Gets the adapter's size.
 * @returns {Promise} A promise that resolves with the size in bytes.
 */
MemoryAdapter.prototype.getSize = function() {
    return Promise["resolve"](this.cachedSize);
};

/**
 * Retrieves items from storage.
 * @param {String[]} [keys] The set of keys to retrieve. Undefined to retrieve all items.
 * @param {Boolean} [includeExpired] True to return expired items, false to not return expired items.
 * @returns {Promise} A promise that resolves with an object that contains key-value pairs.
 */
MemoryAdapter.prototype.getItems = function(keys /* , includeExpired*/) {
    // TODO - optimize by respecting includeExpired
    var that = this;
    return new Promise(function(resolve) {
        var store = that.backingStore;
        var updateMru = true;

        // if keys not specified return all items and do not update mru
        if (!Array.isArray(keys) || keys.length === 0) {
            keys = Object.keys(store);
            updateMru = false;
        }


        var results = {};
        var key, value, innerItem;

        for (var i = 0; i < keys.length; i++) {
            key = keys[i];
            value = store[key];
            if (value) {
                innerItem = value.getItem();

                // deep-copy to avoid handing out a pointer to the internal version
                try {
                    // note that json.encode() will throw on cyclic graphs so caller must handle it.
                    innerItem = JSON.parse($A.util.json.encode(innerItem));
                } catch (ignore) {
                    // should never happen: creation of MemoryAdapter.Item does a deep copy
                }

                results[key] = innerItem;

                if (updateMru) {
                    that.updateMRU(key);
                }
            }
        }
        resolve(results);
    });
};

/**
 * Updates a key in the most recently used list.
 * @param {String} key the key to update
 */
MemoryAdapter.prototype.updateMRU = function(key) {
    var index = this.mru.indexOf(key);
    if (index > -1) {
        this.mru.splice(index, 1);
        this.mru.push(key);
    }
};

/**
 * Stores items in storage.
 * @param {Array} tuples An array of key-value-size pairs. Eg <code>[ [key1, value1, size1], [key2, value2, size2] ]</code>.
 * @returns {Promise} A promise that resolves when the items are stored.
 */
MemoryAdapter.prototype.setItems = function(tuples) {
    var that = this;

    return new Promise(function(resolve) {
        var key, item, size;
        var existingItem, mruIndex;
        var sizeDelta = 0;

        for (var i = 0; i < tuples.length; i++) {
            key = tuples[i][0];
            item = tuples[i][1];
            size = tuples[i][2];

            existingItem = that.backingStore[key];
            sizeDelta += size - (existingItem ? existingItem.getSize() : 0);

            that.backingStore[key] = new MemoryAdapter.Entry(item, size);

            // update the MRU
            mruIndex = that.mru.indexOf(key);
            if (mruIndex > -1) {
                that.mru.splice(mruIndex, 1);
            }
            that.mru.push(key);
        }

        that.cachedSize += sizeDelta;
        var spaceNeeded = that.cachedSize - that.maxSize;

        // async evict
        if (spaceNeeded > 0) {
            that.expireCache(spaceNeeded)
                ["then"](
                    undefined,
                    function(e) {
                        that.log(MemoryAdapter.LOG_LEVEL.WARNING, "setItems(): error during eviction", e);
                    }
                );
        }

        resolve();
    });
};

/**
 * Removes items from storage.
 * @param {String[]} keys Keys of the values to remove.
 * @returns {Promise} A promise that resolves when the values are moved.
 */
MemoryAdapter.prototype.removeItems = function(keys) {
    var that = this;
    return new Promise(function(resolve) {
        for (var i = 0; i < keys.length; i++) {
            that.removeItemInternal(keys[i]);
        }
        resolve();
    });
};

/**
 * Removes an item from storage.
 * @param {String} key key for item to remove
 */
MemoryAdapter.prototype.removeItemInternal = function(key) {
    var item = this.backingStore[key];

    if (item) {
        var index = this.mru.indexOf(key);
        if (index > -1) {
            this.mru.splice(index, 1);
        }

        // adjust actual size
        this.cachedSize -= item.getSize();

        delete this.backingStore[key];
    }

    return item;
};

/**
 * Clears storage.
 * @returns {Promise} a promise that resolves when the store is cleared
 */
MemoryAdapter.prototype.clear = function() {
    var that = this;
    return new Promise(function(resolve) {
        that.reset();
        resolve();
    });
};

/**
 * Evicts items. Expired items are evicted first. If additional space is required then
 * items are evicted based on LRU.
 * @param {Number} spaceNeeded The amount of space to free. Specify 0 to remove only expired items.
 * @returns {Promise} a promise that resolves when the requested space is freed.
 */
MemoryAdapter.prototype.expireCache = function(spaceNeeded) {
    // no items to expire
    if (this.mru.length <= 0) {
        return Promise["resolve"]();
    }

    var that = this;
    return new Promise(function(resolve) {
        var spaceReclaimed = 0;
        var key, item;

        // first evict expired items
        var now = new Date().getTime();
        for (key in that.backingStore) {
            var expires = that.backingStore[key].getItem()["expires"];
            if (now > expires) {
                item = that.removeItemInternal(key);
                spaceReclaimed += item.getSize();
                that.log(MemoryAdapter.LOG_LEVEL.INFO, "evict(): evicted expired item with key " + key);
            }
        }

        // if more space is required then evict based on LRU
        while (spaceReclaimed < spaceNeeded && that.mru.length > 0) {
            key = that.mru[0];
            item = that.removeItemInternal(key);
            spaceReclaimed += item.getSize();
            that.log(MemoryAdapter.LOG_LEVEL.INFO, "evict(): evicted for size item with key " + key);
        }

        resolve();
    });
};

/**
 * Gets the most-recently-used list.
 * @returns {Promise} a promise that results with the an array of keys representing the MRU.
 */
MemoryAdapter.prototype.getMRU = function() {
    return Promise["resolve"](this.mru);
};

/**
 * Logs a message.
 * @param {MemoryAdapter.LOG_LEVEL} level log line level
 * @param {String} msg the log message.
 * @param {Object} [obj] optional log payload.
 * @private
 */
MemoryAdapter.prototype.log = function (level, msg, obj) {
    if (this.debugLogging || level.id >= MemoryAdapter.LOG_LEVEL.WARNING.id) {
        $A[level.fn]("MemoryAdapter['"+this.instanceName+"'] "+msg, obj);
    }
};


/**
 * Removes expired items
 * @returns {Promise} when sweep completes
 */
MemoryAdapter.prototype.sweep = function() {
    // evict expired items; 0 indicates min space to free
    return this.expireCache(0);
};

/**
 * Deletes this storage.
 * @returns {Promise} a promise that resolves when storage is deleted
 */
MemoryAdapter.prototype.deleteStorage = function() {
    this.reset();
    return Promise["resolve"]();
};

/**
 * @returns {Boolean} whether the adapter is secure.
 */
MemoryAdapter.prototype.isSecure = function() {
    return true;
};

/**
 * @returns {Boolean} whether the adapter is persistent.
 */
MemoryAdapter.prototype.isPersistent = function() {
    return false;
};


/**
 * @description A cache entry in the backing store of the MemoryAdapter.
 * Items which are not JSON serializable (eg cyclic graphs) will throw.
 * The caller must handle this.
 *
 * @constructor
 * @private
 */
MemoryAdapter.Entry = function Entry(item, size) {
    // force serialization to match behavior of other adapters.
    // note that json.encode() will throw on cyclic graphs so caller must handle it.
    this.item = JSON.parse($A.util.json.encode(item));
    this.size = size;
};

/**
 * @returns {Object} the stored item
 */
MemoryAdapter.Entry.prototype.getItem = function() {
    return this.item;
};

/**
 * @returns {Number} the size of the cache entry in bytes
 */
MemoryAdapter.Entry.prototype.getSize = function() {
    return this.size;
};


$A.storageService.registerAdapter({
    "name": MemoryAdapter.NAME,
    "adapterClass": MemoryAdapter,
    "secure": true
});

Aura.Storage.MemoryAdapter = MemoryAdapter;
