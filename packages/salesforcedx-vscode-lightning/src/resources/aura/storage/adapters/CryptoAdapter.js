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
 * @description The crypto adapter for Aura Storage Service.
 *
 * This adapter provides AES-CBC encryption, using the browser Web Cryptography API
 * (https://dvcs.w3.org/hg/webcrypto-api/raw-file/tip/spec/Overview.html#dfn-GlobalCrypto)
 * with a server-provided key, persisting into the IndexedDB adapter.
 *
 * Unlike other storage adapters this adapter does not automatically register itself. Use
 * &lt;auraStorage:crypto/&gt; in the &lt;auraPreInitBlock/&gt; section of the app's template
 * to register this adapter. Doing so guarantees that CryptoAdapter.setKey() will be invoked
 * with a server-provided cryptographic key.
 *
 * Please note:
 * 1. If the runtime environment doesn't support the Web Cryptography API the adapter is not
 *    registered.
 * 2. A cryptographic key must be provided by &lt;auraStorage:crypto/&gt;. Until a key is
 *    provided the adapter remains in an initialization state.
 * 3. If an invalid cryptographic key is provided, initialization completes in the error
 *    state, causing AuraStorage to fallback to the memory adapter.
 *
 * @constructor
 */
function CryptoAdapter(config) {
    this.instanceName = config["name"];
    this.debugLogging = config["debugLogging"];
    this.key = undefined;

    // utils to convert to/from ArrayBuffer and Object
    this.encoder = new window["TextEncoder"]();
    this.decoder = new window["TextDecoder"]();

    // promise tracking initialization state
    this.initializePromise = undefined;

    // underlying adapter: IndexedDB. must wait for it to be initialized before performing most operations on it.
    // TODO - this indirection is used by auraStorageTest:cryptoFailedAdapter. this needs to be improved.
    // this.adapter = new Aura.Storage.IndexedDBAdapter(config)
    var adapterClass = $A.storageService.getAdapterConfig(Aura.Storage.IndexedDBAdapter.NAME)["adapterClass"];
    this.adapter = new adapterClass(config);
    this.adapterAntiObfuscation(this.adapter);

    var that = this;
    this.adapterInitializePromise = this.adapter.initialize()
        ["then"](
            function() {
                that.log(CryptoAdapter.LOG_LEVEL.INFO, "adapter.initialize(): internal IndexedDB adapter initialization completed");
            },
            function(e) {
                that.log(CryptoAdapter.LOG_LEVEL.INFO, "adapter.initialize(): internal IndexedDB adapter initialization failed: " + e);
                throw e;
            }
        );
}


/** Name of adapter. */
CryptoAdapter.NAME = "crypto";

/** Log levels */
CryptoAdapter.LOG_LEVEL = {
    INFO:    { id: 0, fn: "log" },
    WARNING: { id: 1, fn: "warning" }
};

/** Encryption algorithm. */
CryptoAdapter.ALGO = "AES-CBC";

/** Initialization vector length (bytes). */
CryptoAdapter.IV_LENGTH = 16;

/** A sentinel value to verify the key against pre-existing data. */
CryptoAdapter.SENTINEL = "cryptoadapter";

/** Initializes he Web Cryptography API */
CryptoAdapter.initializeEngine = function() {
    /*
     * Replace window.crypto with the IE11 vendor prefixed window.msCrypto
     * See https://msdn.microsoft.com/en-us/library/dn302338(v=vs.85).aspx
     */
    if (window["msCrypto"] && !window["crypto"]) {
        window["crypto"] = {};
        window["crypto"]["subtle"] = {};

        /*
         * Wrap the window.crypto.subtle functions to make them return a Promise instead of a CryptoOperation
         * See https://msdn.microsoft.com/en-us/library/dn904640(v=vs.85).aspx
         */
        window["crypto"]["subtle"]["importKey"] = function(format, keyData, algorithm, extractable, keyUsages) {
            return new Promise(function(resolve, reject) {
                var op = window["msCrypto"]["subtle"]["importKey"](format, keyData, algorithm, extractable, keyUsages);
                op.onerror = function(/*evt*/) {
                    // there isn't useful error information in evt, so just indicate a generic error
                    reject(new Error('Failed to importKey'));
                };

                op.oncomplete = function(evt) {
                    resolve(evt.target.result);
                };
            });
        };

        window["crypto"]["subtle"]["encrypt"] = function(algorithm, key, buffer) {
            return new Promise(function(resolve, reject) {
                var op = window["msCrypto"]["subtle"]["encrypt"](algorithm, key, buffer);
                op.onerror = function(/*evt*/) {
                    // there isn't useful error information in evt, so just indicate a generic error
                    reject(new Error('Failed to encrypt'));
                };

                op.oncomplete = function(evt) {
                    resolve(evt.target.result);
                };

                /*
                 * If the initial buffer provided to the encrypt call is empty, the CryptoOperation waits for additional
                 * data to be provided in chunks via the CryptoOperation.process method. In the case where trying to
                 * encrypt an undefined value the buffer is empty so we have to manually tell the operation to finish.
                 * See https://msdn.microsoft.com/en-us/library/dn302329(v=vs.85).aspx
                 */
                if (!buffer || buffer.byteLength === 0) {
                    op.finish();
                }
            });
        };

        window["crypto"]["subtle"]["decrypt"] = function(algorithm, key, buffer) {
            return new Promise(function(resolve, reject) {
                var op = window["msCrypto"]["subtle"]["decrypt"](algorithm, key, buffer);
                op.onerror = function(/*evt*/) {
                    // there isn't useful error information in evt, so just indicate a generic error
                    reject(new Error('Failed to decrypt'));
                };

                op.oncomplete = function(evt) {
                    resolve(evt.target.result);
                };

                /*
                 * If the initial buffer provided to the decrypt call is empty, the CryptoOperation waits for additional
                 * data to be provided in chunks via the CryptoOperation.process method. I don't think there is a case
                 * where the buffer will be empty for a decrypt call, but just in case it is we tell the operation to
                 * finish without waiting for more data. See https://msdn.microsoft.com/en-us/library/dn302326(v=vs.85).aspx
                 */
                if (!buffer || buffer.byteLength === 0) {
                    op.finish();
                }
            });
        };

        window["crypto"]["getRandomValues"] = window["msCrypto"]["getRandomValues"].bind(window["msCrypto"]);
    }

    CryptoAdapter.engine = window["crypto"] && (window["crypto"]["subtle"] || window["crypto"]["webkitSubtle"]);
};

CryptoAdapter.initializeEngine();


/** Promise that resolves with the per-application encryption key. */
CryptoAdapter.key = new Promise(function(resolve, reject) {
    // exposing this resolve/reject isn't pretty but there were issues
    // with a nested non-prototype function (ie placing CryptoAdapter.setKey
    // in this function). so instead we expose these and delete them after
    // setKey() is called.
    CryptoAdapter._keyResolve = resolve;
    CryptoAdapter._keyReject = reject;
});


/**
 * Sets the per-application encryption key.
 * @param {ArrayBuffer} rawKey The raw bytes of the encryption key
 */
CryptoAdapter["setKey"] = function(rawKey) {
    // note: @export is configured only for prototypes so must use array syntax to avoid mangling
    // note: because this is not instance specific there's no config indicating verbosity, so
    //       always log with $A.log directly

    var resolve = CryptoAdapter._keyResolve;
    var reject = CryptoAdapter._keyReject;
    var log;

    // only allow one invocation and
    delete CryptoAdapter["setKey"];
    delete CryptoAdapter._keyResolve;
    delete CryptoAdapter._keyReject;

    if (!(rawKey instanceof ArrayBuffer)) {
        var type = !rawKey? typeof rawKey : rawKey.constructor.name;
        log = "CryptoAdapter cannot import key of wrong type (" + type + "), rejecting";
        $A.warning(log);
        reject(new Error(log));
        return;
    }

    CryptoAdapter.engine["importKey"](
        "raw",                  // format
        rawKey,                 // raw key as an ArrayBuffer
        CryptoAdapter.ALGO,     // algorithm of key
        false,                  // don't allow key export
        ["encrypt", "decrypt"]  // allowed operations
    )["then"](
            function(key) {
                // it's possible for key import to fail, which we treat as a fatal
                // error. all pending and future operations will fail.
                if (!key) {
                    log = "CryptoAdapter crypto.importKey() returned no key, rejecting";
                    $A.warning(log);
                    reject(new Error(log));
                    return;
                }
                $A.log("CryptoAdapter crypto.importKey() successfully imported key");
                resolve(key);
            },
            function(e) {
                log = "CryptoAdapter crypto.importKey() failed, rejecting: " + e;
                $A.warning(log);
                reject(new Error(log));
            }
        );
};


/**
 * Registers crypto adapter.
 */
CryptoAdapter["register"] = function() {
    // crypto adapter requires indexeddb adapter to be registered, indicating the implementation is
    // sound.
    //
    // if a browser supports crypto it'll expose window.crypto. unfortunately the crypto operations will
    // fail unless they're run on a "secure origins" (like HTTPS and localhost). see http://sfdc.co/bO9Hok.
    // unfortunately adapter registration must be synchronous otherwise the adapter is not available in
    // time for aura's boot cycle and thus the "actions" store. so manually check https (production) and
    // localhost (dev).
    if ($A.storageService.isRegisteredAdapter(CryptoAdapter.NAME)) {
        $A.warning("CryptoAdapter already registered");
        return;
    }

    if (!$A.storageService.isRegisteredAdapter(Aura.Storage.IndexedDBAdapter.NAME)) {
        $A.warning("CryptoAdapter cannot register because it requires IndexedDB");
        return;
    }

    var secure = window.location.href.indexOf('https') === 0 || window.location.hostname === "localhost";
    if (!secure) {
        $A.warning("CryptoAdapter cannot register because it requires a secure origin");
        return;
    }

    if (!CryptoAdapter.engine) {
        $A.warning("CryptoAdapter cannot register because it requires Web Cryptography API");
        return;
    }

    $A.storageService.registerAdapter({
        "name": CryptoAdapter.NAME,
        "adapterClass": CryptoAdapter,
        "secure": true,
        "persistent": true
    });
};


/**
 * Returns the name of the adapter.
 * @returns {String} name of adapter
 */
CryptoAdapter.prototype.getName = function() {
    return CryptoAdapter.NAME;
};

/**
 * Starts the initialization process.
 * @return {Promise} a promise that resolves when initialization has completed, or rejects if initialization has failed.
 */
CryptoAdapter.prototype.initialize = function() {
    if (this.initializePromise) {
        return this.initializePromise;
    }

    this.initializePromise = this.initializeInternal();
    return this.initializePromise;
};


/**
 * Initializes the adapter by waiting for the app-wide crypto key to be set,
 * then validates the key works for items already in persistent storage. Several
 * error scenarios to detect:
 * - invalid key provided -> fallback to memory storage
 * - valid key is provided but can't fetch what's in storage -> clear then use crypto with new key
 * - valid key is provided but doesn't match what's in storage -> clear then use crypto with new key
 * @private
 */
CryptoAdapter.prototype.initializeInternal = function() {
    var that = this;

    // TODO - this check should be done by the consumer(s) that care. eg ComponentDefStorage, actions storage
    if (!$A.util.isLocalStorageEnabled()) {
        return Promise["reject"](new Error("localStorage is disabled"));
    }

    return Promise["all"]([CryptoAdapter.key, this.adapterInitializePromise])
        ["then"](
            function keyReceived(values) {
                // it's possible for key generation to fail, which we treat as a fatal
                // error. all pending and future operations will fail.
                var key = values[0];
                if (!key) {
                    throw new Error("CryptoAdapter.key resolved with no key."); // move to reject state
                }
                that.key = key;
            }
            // reject: no key received or indexeddb adapter failed. leave in reject state
            // so crypto adapter initialize() rejects
        )["then"](
            function verifySentinel() {

                function handleInvalidSentinel() {
                    // decryption failed so clear the store
                    that.log(CryptoAdapter.LOG_LEVEL.INFO, "initialize(): encryption key is different so clearing storage");
                    $A.metricsService.transaction("aura", "performance:cryptoStorage-keymismatch");
                    return that.clear();
                }

                // check if existing data can be decrypted
                that.log(CryptoAdapter.LOG_LEVEL.INFO, "initialize(): verifying sentinel");
                return that.getItems([CryptoAdapter.SENTINEL], true)
                    ["then"](
                        function(values) {
                            // if sentinel value is incorrect then clear the store. crypto will operate with new key.
                            if (!values[CryptoAdapter.SENTINEL] || values[CryptoAdapter.SENTINEL].value !== CryptoAdapter.SENTINEL) {
                                // TODO avoid double clear() when config[clearOnInit] is also true
                                return handleInvalidSentinel();
                            }
                            // new key matches key used in store. existing values remain.
                        },
                        handleInvalidSentinel
                    );
            }
        )["then"](
            function storeSentinel() {
                // underlying store is setup, either as crypto or memory fallback. this store
                // is now ready for use.
                return that.setSentinelItem();
            }
        );
};


/**
 * Returns adapter size.
 * @returns {Promise} a promise that resolves with the size in bytes
 */
CryptoAdapter.prototype.getSize = function() {
    return this.adapter.getSize();
};


/**
 * Retrieves items from storage.
 * @param {String[]} [keys] The set of keys to retrieve. Undefined to retrieve all items.
 * @param {Boolean} [includeExpired] True to return expired items, false to not return expired items.
 * @returns {Promise} A promise that resolves with an object that contains key-value pairs.
 */
CryptoAdapter.prototype.getItems = function(keys, includeInternalKeys) {
    var that = this;
    return this.adapter.getItems(keys)
        ["then"](
            function(values) {
                var decrypted = {};
                function decryptSucceeded(k, decryptedValue) {
                    // do not return the sentinel. note that we did verify it decrypts correctly.
                    if (k !== CryptoAdapter.SENTINEL || includeInternalKeys) {
                        decrypted[k] = decryptedValue;
                    }
                }

                function decryptFailed() {
                    // decryption failed. do not add the key to decrypted to indicate we
                    // do not have the key. do not rethrow to return the promise to resolve state.
                }

                var promises = [];
                var promise, value;
                for (var key in values) {
                    value = values[key];
                    if ($A.util.isUndefinedOrNull(value)) {
                        // should never get back a non-crypto payload. treat is as though
                        // the underlying adapter doesn't have it.
                    } else {
                        promise = that.decrypt(key, value)
                            ["then"](
                                decryptSucceeded.bind(undefined, key),
                                decryptFailed
                            );
                        promises.push(promise);
                    }
                }
                return Promise["all"](promises)
                    ["then"](function() {
                        return decrypted;
                    });
            }
        );
};


/**
 * Decrypts a stored cached entry.
 * @param {String} key The key of the value to decrypt.
 * @param {Object} value The cache entry to decrypt.
 * @returns {Promise} Promise that resolves with the decrypted item.
 * @private
 */
CryptoAdapter.prototype.decrypt = function(key, value) {
    var that = this;
    if (!value || !value["value"]) {
        return Promise["reject"](new Error("CryptoAdapter.decrypt() value is malformed for key"+key));
    }

    return CryptoAdapter.engine["decrypt"](
            {
                "name": CryptoAdapter.ALGO,
                "iv": value["value"]["iv"]
            },
            that.key,
            value["value"]["cipher"]
        )
        ["then"](
            function(decrypted) {
                var obj = that.arrayBufferToObject(new Uint8Array(decrypted));
                return {"expires": value["expires"], "value": obj};
            },
            function(err) {
                that.log(CryptoAdapter.LOG_LEVEL.WARNING, "decrypt(): decryption failed for key "+key, err);
                throw new Error(err);
            }
        );
};


/**
 * Converts an object to an ArrayBuffer.
 * @param {Object} o The object to convert.
 * @private
 */
CryptoAdapter.prototype.objectToArrayBuffer = function(o) {
    // can't JSON serialize undefined so store a (unencrypted) empty buffer
    if (o === undefined) {
        return new ArrayBuffer(0);
    }

    // json encode to a string
    var str = $A.util.json.encode(o);
    // string to array buffer
    return this.encoder["encode"](str);
};

/**
 * Alias for objectToArrayBuffer, used by AuraStorage to avoid multiple calls to json.encode
 * @param {Object} o The object to convert
 */
CryptoAdapter.prototype.encodeValue = function(o) {
    return this.objectToArrayBuffer(o);
};

/**
 * Converts an ArrayBuffer to object.
 * @param {ArrayBuffer} ab The ArrayBuffer to convert.
 * @private
 */
CryptoAdapter.prototype.arrayBufferToObject = function(ab) {
    // array buffer to string
    var str = this.decoder["decode"](ab);
    //if empty buffer, we stored undefined
    if (str === "") {
        return undefined;
    }
    // string (of json) to object
    return JSON.parse(str);
};


/**
 * Stores entry used to determine whether encryption key provided can decrypt the store.
 * @returns {Promise} Promise that resolves when the item is stored.
 */
CryptoAdapter.prototype.setSentinelItem = function() {
    var now = new Date().getTime();
    // shape must match AuraStorage#buildPayload
    var tuple = [
        CryptoAdapter.SENTINEL,
        {
            "value": CryptoAdapter.SENTINEL,
            "created": now,
            "expires": now + 15768000000 // 1/2 year
        },
        0
    ];
    return this.setItems([tuple]);
};


/**
 * Encrypts a tuple.
 * @param {Array} tuple An array of key-value-size.
 * @returns {Promise} Promise that resolves to a tuple of key-encrypted value-size.
 */
CryptoAdapter.prototype.encryptToTuple = function(tuple) {
    var that = this;
    return new Promise(function(resolve, reject) {
        var itemArrayBuffer;
        try {
            // if json serialization errors then reject
            if (!tuple[1]["valueEncoded"]) {
                itemArrayBuffer = that.objectToArrayBuffer(tuple[1]["value"]);
            } else {
                itemArrayBuffer = tuple[1]["value"];
            }
        } catch (e) {
            that.log(CryptoAdapter.LOG_LEVEL.WARNING, "encryptToTuple(): serialization failed for key " + tuple[0], e);
            reject(e);
            return;
        }

        // generate a new initialization vector for every item
        var iv = window["crypto"]["getRandomValues"](new Uint8Array(CryptoAdapter.IV_LENGTH));
        CryptoAdapter.engine["encrypt"](
                {
                    "name": CryptoAdapter.ALGO,
                    "iv": iv
                },
                that.key,
                itemArrayBuffer
            )
            ["then"](
                function (encrypted) {
                    var storable = {
                        "expires": tuple[1]["expires"],
                        "value": {"iv": iv, "cipher": encrypted}
                    };
                    resolve([tuple[0], storable, tuple[2]]);
                },
                function (err) {
                    that.log(CryptoAdapter.LOG_LEVEL.WARNING, "encryptToTuple(): encryption failed for key " + tuple[0], err);
                    reject(err);
                }
            );
    });
};


/**
 * Stores items in storage.
 * @param {Array} tuples An array of key-value-size pairs. Eg <code>[ [key1, value1, size1], [key2, value2, size2] ]</code>.
 * @returns {Promise} A promise that resolves when the items are stored.
 */
CryptoAdapter.prototype.setItems = function(tuples) {
    // encrypt into tuples
    var promises = [];
    var tuple;
    for (var i = 0; i < tuples.length; i++) {
        tuple = tuples[i];
        promises.push(this.encryptToTuple(tuple));
    }

    var that = this;
    return Promise["all"](promises)["then"](
        function(encryptedTuples) {
            return that.adapter.setItems(encryptedTuples);
        },
        function (err) {
            var keys = tuples.map(function(t) { return t[0]; });
            that.log(CryptoAdapter.LOG_LEVEL.WARNING, "setItemsInternal(): transaction error for keys "+keys.toString(), err);
            throw err;
        }
    );
};


/**
 * Removes items from storage.
 * @param {String[]} keys The keys of the items to remove.
 * @returns {Promise} A promise that resolves when all items are removed.
 */
CryptoAdapter.prototype.removeItems = function(keys) {
    // note: rely on AuraStorage key prefixing to avoid clashing with sentinel key
    return this.adapter.removeItems(keys);
};


/**
 * Clears storage.
 * @returns {Promise} a promise that resolves when the store is cleared
 */
CryptoAdapter.prototype.clear = function() {
    var that = this;
    return this.adapter.clear()
        ["then"](
            function() {
                return that.setSentinelItem();
            }
        );
};


/**
 * Sweeps over the store to evict expired items.
 * @returns {Promise} A promise that resolves when the sweep is complete.
 */
CryptoAdapter.prototype.sweep = function() {
    // underlying adapter may sweep the sentinel so always re-add it
    var that = this;
    return this.adapter.sweep()
        ["then"](
            function() {
                return that.setSentinelItem();
            }
        );
};


/**
 * Deletes this storage.
 * @returns {Promise} A promise that resolves when storage is deleted
 */
CryptoAdapter.prototype.deleteStorage = function() {
    return this.adapter.deleteStorage();
};


/**
 * Suspends eviction.
 */
CryptoAdapter.prototype.suspendSweeping = function() {
    if (this.adapter.suspendSweeping) {
        this.adapter.suspendSweeping();
    }
};


/**
 * Resumes eviction.
 */
CryptoAdapter.prototype.resumeSweeping = function() {
    if (this.adapter.resumeSweeping) {
        this.adapter.resumeSweeping();
    }
};


/**
 * @returns {Boolean} whether the adapter is secure.
 */
CryptoAdapter.prototype.isSecure = function() {
    return true;
};


/**
 * @returns {Boolean} whether the adapter is persistent.
 */
CryptoAdapter.prototype.isPersistent = function() {
    return true;
};


/**
 * Logs a message.
 * @param {CryptoAdapter.LOG_LEVEL} level Log line level
 * @param {String} msg The log message
 * @param {Object} [obj] Optional log payload
 * @private
 */
CryptoAdapter.prototype.log = function (level, msg, obj) {
    if (this.debugLogging || level.id >= CryptoAdapter.LOG_LEVEL.WARNING.id) {
        $A[level.fn]("CryptoAdapter['"+this.instanceName+"']"+msg, obj);
    }
};


/**
 * Anti-obfuscate to support adapters provided by non-framework. Eg tests.
 */
CryptoAdapter.prototype.adapterAntiObfuscation = function(adapter) {
    // copied from AuraStorage#adapterAntiObfuscation
    adapter.initialize = adapter.initialize || adapter["initialize"];
    adapter.getName = adapter.getName || adapter["getName"];
    adapter.isSecure = adapter.isSecure || adapter["isSecure"];
    adapter.isPersistent = adapter.isPersistent || adapter["isPersistent"];
    adapter.suspendSweeping = adapter.suspendSweeping || adapter["suspendSweeping"];
    adapter.resumeSweeping = adapter.resumeSweeping || adapter["resumeSweeping"];

    adapter.setItems = adapter.setItems || adapter["setItems"];
    adapter.getItems = adapter.getItems || adapter["getItems"];
    adapter.removeItems = adapter.removeItems || adapter["removeItems"];
    adapter.clear = adapter.clear || adapter["clear"];
    adapter.sweep = adapter.sweep || adapter["sweep"];
    adapter.getSize = adapter.getSize || adapter["getSize"];
    adapter.deleteStorage = adapter.deleteStorage || adapter["deleteStorage"];
};


Aura.Storage.CryptoAdapter = CryptoAdapter;

// export crypto adapter as $A.storageService.CryptoAdapter exposing effectively
// only the non-mangled functions. not using @export because it exports the
// constructor function which is not desired.
AuraStorageService.prototype["CryptoAdapter"] = CryptoAdapter;
