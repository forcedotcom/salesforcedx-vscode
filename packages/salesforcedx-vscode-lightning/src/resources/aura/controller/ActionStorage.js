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
 * @description API to access action storage.
 *
 * This class is *the* API to access storable actions and action storage. All access to action storage
 * must use this API to ensure a consistent and reliable cache.
 *
 * By default a `filter` of storable action keys accessible to the current browser tab is built.
 * This is required because actions depend on defs, defs depend on labels, and the
 * label GVP is stored in the actions store. Labels and defs are loaded at framework boot so
 * the same must be done for actions. Failing to do this can result in storable action cache hits
 * that reference defs or labels the current tab does not have access to, which typically causes
 * a failure in the app. This commonly occurs in multi-tab browser scenarios because persistent
 * storage is shared across tabs but not synchronized into each tab's memory.
 *
 * Building the filter incurs a runtime cost at boot so is done only when persistent actions storage
 * is used. It may also selectively be disabled by the application (eg if the environment guarantees
 * a single tab).
 *
 * @constructor
 * @protected
 */
function ActionStorage() {
    this.actionKeysFilter = undefined;

    // allows the app to explicitly disable the filter
    this.actionsFilterEnabled = true;

    this.actionsFilterInited = false;
    this.actionsFilterPopulated = false;
}

ActionStorage.prototype.STORAGE_NAME = "actions";

ActionStorage.prototype.URI_DEFS_ENABLED_KEY = "_uri_defs_enabled";

/**
 * Enables or disables the persisted actions filter, required for multi-tab
 * environments that use storable actions.
 * @param {Boolean} enable - true to enable the filter, false to disable the filter.
 */
ActionStorage.prototype.enableActionsFilter = function(enable) {
    this.actionsFilterEnabled = !!enable;
};

/**
 * Initialize the persisted actions filter.
 * @return {Boolean} true if actions filter is set up
 */
ActionStorage.prototype.setupActionsFilter = function() {
    if (this.actionKeysFilter !== undefined) {
        return this.actionsFilterInited;
    }

    if (!this.actionsFilterEnabled) {
        this.actionKeysFilter = null;
        this.actionsFilterInited = false;
    } else {
        this.actionKeysFilter = {};
        this.actionsFilterInited = true;

        // Lazily populate actions filter after bootstrap.
        this.populateActionsFilter();
    }

    return this.actionsFilterInited;
};

/**
 * Populates the persisted actions filter if applicable.
 */
ActionStorage.prototype.populateActionsFilter = function() {
    if(this.actionsFilterPopulated) {
        return Promise["resolve"]();
    }
    this.actionsFilterPopulated = true;

    // if filter is not set up
    if (!this.isStoragePersistent() || !this.setupActionsFilter()) {
        return Promise["resolve"]();
    }

    var that = this;
    // if filter is enabled, getAll() populates all persisted actions to filter
    return this.getAll()["then"](function(items){

        var actionsStoredWithURIDefs = items[that.URI_DEFS_ENABLED_KEY];
        var bootstrapEntry = items[AuraClientService.BOOTSTRAP_KEY];
        var uriEnabled = $A.getContext().uriAddressableDefsEnabled;
        var allowedStorage_size = actionsStoredWithURIDefs === undefined? 0: 1;
        allowedStorage_size += bootstrapEntry === undefined ? 0: 1;
        
        // actions stored with uri defs enabled are backwards compatible with it disabled.
        // actions stored with uri defs disabled are not compatible with uri defs enabled.
        if ((uriEnabled !== !!actionsStoredWithURIDefs) &&
            (Object.keys(items).length > allowedStorage_size) ) {

            $A.warning("Clearing actions db because uri addressable defs state was toggled");
            return that.clear()["then"](function(){
                return that.set(that.URI_DEFS_ENABLED_KEY, uriEnabled)["then"](function(){ return []; });
            });
        } else if (actionsStoredWithURIDefs === undefined){
            that.set(that.URI_DEFS_ENABLED_KEY, uriEnabled);
        }
        return items;
    });
};

/**
 * Reset the persisted actions filter.
 */
ActionStorage.prototype.clearActionsFilter = function() {
    this.actionKeysFilter = undefined;
    this.setupActionsFilter();
};

ActionStorage.prototype.isActionsFilterEnabled = function() {
    return this.actionsFilterEnabled;
};

/**
 * Check if actions filter has been set up.
 */
ActionStorage.prototype.isActionsFilterInitialized = function() {
    return this.actionsFilterInited;
};

/**
 * Check if an action is absent in Action Storage (from in-memory cache).
 * This function only guarantees that an action storage key is absent in storage.
 * It doesn't guarantee that an action can be retrieved from storage if it returns false.
 *
 * @param {String} key - action storage key
 * @return {Boolean} true if the action storage key is guaranteed to not be accessible from storage; false if accessible or unknown.
 */
ActionStorage.prototype.isKeyAbsentFromCache = function(key) {
    if (!this.isStorageEnabled()) {
        return true;
    }

    // always return false if cache is not enabled to enforce checking in real storage
    if (!this.actionsFilterEnabled || !this.actionKeysFilter) {
        return false;
    }

    return !this.actionKeysFilter[key];
};

/**
 * Returns the underlying AuraStorage
 * @private
 */
ActionStorage.prototype.getStorage = function() {
    return $A.storageService.getStorage(this.STORAGE_NAME);
};

/**
 * Check if the underlying AuraStorage is persistent
 * @return {Boolean} true if action storage is persistent
 */
ActionStorage.prototype.isStoragePersistent = function() {
    var storage = this.getStorage();
    return !!storage && storage.isPersistent();
};

/**
 * Check if the underlying AuraStorage is initialized
 * @return {Boolean} true if action storage is enabled
 */
ActionStorage.prototype.isStorageEnabled = function() {
    return !!this.getStorage();
};

/**
 * Asynchronously stores multiple actions to action storage. All or none of the values are stored.
 * Stored action keys are added into action filter if actions filter is enabled.
 *
 * @param {Object} values The actionKey-value pairs to store.
 * @returns {Promise} A promise that resolves when all of the actionKey-value pairs are stored.
 */
ActionStorage.prototype.setAll = function(values) {
    var key;
    var storage = this.getStorage();
    if (!storage) {
        return Promise["resolve"]();
    }

    if (!this.setupActionsFilter()) {
        return storage.setAll(values);
    }

    // since storing operation will be enqueued and async, put the key in cache for now.
    // if storage fails to save the actions, these actions are sent to the server when
    // processing storable actions
    for (key in values) {
        this.actionKeysFilter[key] = true;
    }

    var that = this;
    return storage.setAll(values)
        ["then"](
            undefined,
            function(e) {
                // TODO: if prior to this setAll() the entries existed in storage,
                // then they actually remain accessible
                for (key in values) {
                    that.actionKeysFilter[key] = undefined;
                }
                throw e;
            }
        );
};

/**
 * Asynchronously stores the action in storage using the specified key.
 * Stored action key is added into action filter if actions filter is enabled.
 *
 * @param {String} actionKey - The action key to store.
 * @param {*} value The value of the action to store.
 * @returns {Promise} A promise that resolves when are stored.
 */
ActionStorage.prototype.set = function(actionKey, value) {
    var values = {};
    values[actionKey] = value;
    return this.setAll(values);
};

/**
 * Asynchronously gets multiple items from storage.
 * Retrieved action keys are added into action filter if actions filter is enabled.
 *
 * @param {String[]} [actionKeys] The set of action keys to retrieve. Empty array or falsey to retrieve all items.
 * @returns {Promise} A promise that resolves to an object that contains key-value pairs. {key: storedItem}
 */
ActionStorage.prototype.getAll = function(actionKeys) {
    var storage = this.getStorage();
    if (!storage) {
        return Promise["resolve"]({});
    }

    if (!this.setupActionsFilter()) {
        return storage.getAll(actionKeys, true);
    }

    var that = this;
    var key;
    return storage.getAll(actionKeys, true)
        ["then"](function(items) {
            if (Array.isArray(actionKeys) && actionKeys.length > 0) {
                for (var i = 0; i < actionKeys.length; i++) {
                    key = actionKeys[i];
                    // clean up non-existing keys
                    if (!items[key] && that.actionKeysFilter[key]) {
                        delete that.actionKeysFilter[key];
                    }
                }
            }

            for (key in items) {
                that.actionKeysFilter[key] = true;
            }
            return items;
        });
};

/**
 * Asynchronously gets a sigle action from storage corresponding to the action key.
 * Retrieved action keys is added into action filter if actions filter is enabled.
 *
 * @param {String} actionKey The key of the action to retrieve.
 * @returns {Promise} A promise that resolves to the stored item or undefined if the key is not found.
 */
ActionStorage.prototype.get = function(actionKey) {
    return this.getAll([actionKey])
        ["then"](
            function(items) {
                return items? items[actionKey] : undefined;
            }
        );
};

/**
 * Asynchronously removes multiple actions from storage. All or none of the values are removed.
 * Removed actions keys get deleted from action filter if action filter is enabled.
 *
 * @param {String[]} actionKeys The keys of the actions to remove.
 * @param {Boolean=} doNotFireModified Whether to fire the modified event on item removal.
 * @returns {Promise} A promise that resolves when all of the values are removed.
 */
ActionStorage.prototype.removeAll = function(actionKeys, doNotFireModified) {
    var storage = this.getStorage();
    if (!storage) {
        return Promise["resolve"]();
    }

    if (!this.setupActionsFilter()) {
        return storage.removeAll(actionKeys, doNotFireModified);
    }

    var key;
    for (var i = 0; i < actionKeys.length; i++) {
        key = actionKeys[i];
        if (this.actionKeysFilter[key]) {
            delete this.actionKeysFilter[key];
        }
    }

    return storage.removeAll(actionKeys, doNotFireModified);
};

/**
 * Asynchronously removes a single action from storage corresponding to the specified key.
 * Removed action key gets deleted from action filter if action filter is enabled.
 *
 * @param {String} actionKey The key of the action to remove.
 * @param {Boolean} doNotFireModified Whether to fire the modified event on item removal.
 * @returns {Promise} A promise that will remove the value from storage.
 */
ActionStorage.prototype.remove = function(actionKey, doNotFireModified) {
    return this.removeAll([actionKey], doNotFireModified);
};

/**
 * Clear the action storge. The action filter get reset if action filter is enable.
 *
 * @returns {Promise} A promise that will clear storage.
 */
ActionStorage.prototype.clear = function() {
    var storage = this.getStorage();
    if (!storage) {
        return Promise["resolve"]();
    }

    // action storage gets explicitly cleared, we want to clear cache anyway,
    // even if the clear operation fails
    if (this.actionsFilterEnabled) {
        this.clearActionsFilter();
    }

    return storage.clear();
};

Aura.Controller.ActionStorage = ActionStorage;
