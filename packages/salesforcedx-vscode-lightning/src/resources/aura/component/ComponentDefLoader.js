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
 * Handles retrieval of ComponentDefs from the server
 * @constructor
 */
function ComponentDefLoader() {
    this.pending = null;
    this.loading = 0;
    this.counter = 0;
    this.scriptTagCounter = 0;
    this.requestedDescriptors = {};
    this.lastContextParameterName;
}

// params start with "_" to avoid namespace collisions
ComponentDefLoader.STYLE_param = "_style";
ComponentDefLoader.DESCRIPTOR_param = "_def";
ComponentDefLoader.UID_param = "_uid";

ComponentDefLoader.UID_default = "LATEST";
ComponentDefLoader.BASE_PATH = "/auraCmpDef?";
ComponentDefLoader.MARKUP = "markup://";
ComponentDefLoader.RESTRICTED_KEY = "restricted";
ComponentDefLoader.UNRESTRICTED_KEY = "unrestricted";

ComponentDefLoader.UNKNOWN_ERROR_MESSAGE_PREFIX = "An unknown error occurred attempting to fetch definitions at: ";

ComponentDefLoader.MARK_NS = "transport";
ComponentDefLoader.MARK_NAME = "request";

ComponentDefLoader.prototype.getContextParameters = function() {
    var params = $A.getContext().getURIComponentDefinitionsParameters();
    var returnQueryString = "";
    for (var i=0; i < params.length; i++) {
        if (i > 0) {
            returnQueryString = returnQueryString + "&";
        }
        returnQueryString = returnQueryString + params[i].name + "=" + params[i].getValue();
    }
    if (this.lastContextParameterName === undefined) {
        this.lastContextParameterName = params[params.length-1].name;
    }
    return returnQueryString;
};

ComponentDefLoader.prototype.processRequested = function() {
    for (var descriptor in this.requestedDescriptors) {
        if ($A.componentService.hasCacheableDefinitionOfAnyType(descriptor)) {
            for (var i=0; i<this.requestedDescriptors[descriptor].length; i++) {
                this.requestedDescriptors[descriptor][i].finalize();
            }
            delete this.requestedDescriptors[descriptor];
        }
    }
};

ComponentDefLoader.prototype.rejectPendingRequestedDescriptor = function(descriptor, error_message) {
    if (this.requestedDescriptors[descriptor]) {
        for (var j=0; j < this.requestedDescriptors[descriptor].length; j++) {
            this.requestedDescriptors[descriptor][j].error(error_message);
        }
        delete this.requestedDescriptors[descriptor];
    }
};

ComponentDefLoader.prototype.getDescriptorsFromURI = function (uri) {
    // get the descriptors from the URI
    // don't care about the '?' because the first parameters are never descriptors
    // even if we create a bad descriptor here, it won't matter because it then won't exist in the requestedDescriptors map
    var parameters = uri.split("&");
    var results = [];
    for (var p=0; p < parameters.length; p++) {
        var parts = parameters[p].split("=");
        if (parts.length === 2) {
            var paramName = parts[0];
            if (paramName === ComponentDefLoader.DESCRIPTOR_param) {
                results.push(parts[1]);
            } else if (paramName[0] !== "_") {
                var names = parts[1].split(",");
                for (var n=0; n < names.length; n++) {
                    results.push(ComponentDefLoader.MARKUP + paramName + ":" + names[n]);
                }
            }
        }
    }
    return results;
};

ComponentDefLoader.prototype.rejectPendingRequested = function(uri, error_message) {
    var descriptors = this.getDescriptorsFromURI(uri);
    for (var i = 0; i < descriptors.length; i++) {
        this.rejectPendingRequestedDescriptor(descriptors[i], error_message);
    }
};

ComponentDefLoader.prototype.buildBundleComponentNamespace = function(descriptors, descriptorMap, existingRequested) {
    if (!$A.util.isArray(descriptors)) {
        //Should we return an empty object here or raise an error?
        return {};
    }
    var cdnAvailable = !!$A.getContext().cdnHost;
    var namespaceMap = {};
    namespaceMap[ComponentDefLoader.RESTRICTED_KEY] = {};
    if (cdnAvailable) {
        namespaceMap[ComponentDefLoader.UNRESTRICTED_KEY] = {};
    }

    for (var i=0; i < descriptors.length; i++) {
        if ($A.componentService.hasCacheableDefinitionOfAnyType(descriptors[i])) {
            continue;
        }
        if ($A.util.isArray(this.requestedDescriptors[descriptors[i]])) {
            // we don't have the definition yet, but it was requested already
            // it should be currently pending
            this.requestedDescriptors[descriptors[i]].push(existingRequested);
            existingRequested.counter++;
            continue;
        }
        this.requestedDescriptors[descriptors[i]] = [];
        var descriptor = new Aura.System.DefDescriptor(descriptors[i]);
        var namespace = descriptor.getNamespace();
        var name = descriptor.getName();
        var isRestrictedNamespace = !$A.clientService.isInternalNamespace(namespace);
        var restrictedKey = (isRestrictedNamespace || !cdnAvailable) ? ComponentDefLoader.RESTRICTED_KEY : ComponentDefLoader.UNRESTRICTED_KEY;
        if (!(namespace in namespaceMap[restrictedKey])) {
            namespaceMap[restrictedKey][namespace] = {};
        }
        if ($A.util.isUndefinedOrNull(namespaceMap[restrictedKey][namespace][name])) {
            namespaceMap[restrictedKey][namespace][name] = descriptorMap[descriptors[i]];
        }
    }

    return namespaceMap;
};

ComponentDefLoader.prototype.buildBundleComponentUri = function(descriptorMap) {
    var descriptors = Object.keys(descriptorMap);
    var existingRequested = {
        counter: 0,
        finalize: function(){
            this.counter--;
            if (this.counter <= 0) {
                this.resolve();
            }
        },
        error: function(msg) {
            this.reject(msg);
        }
    };

    var namespaceMap = this.buildBundleComponentNamespace(descriptors, descriptorMap, existingRequested);

    var baseURI = ComponentDefLoader.BASE_PATH + this.getContextParameters();

    var maxLength;
    if ($A.util.isIE) {
        // URI length for IE needs to be below 2000 characters.
        maxLength = 1800;
    } else {
        // Commonly, app or proxy servers are configured with a request header size of 8k - 16k
        // this includes URL and any additional Headers, like Cookies
        // initially buffering for standard headers Accept*, Host, Referrer, Connection.
        // This information can vary, reducing the size further to help ensure we stay under the limit
        maxLength = 8000 - document.cookie.length - window.navigator.userAgent.length;
    }

    var uris = [];

    var restrictedKeys = [ComponentDefLoader.RESTRICTED_KEY, ComponentDefLoader.UNRESTRICTED_KEY];

    for (var keyIdx=0; keyIdx < restrictedKeys.length; keyIdx++) {

        var restrictedKey = restrictedKeys[keyIdx];
        var uri = "";
        var numberOfDescriptorsInUid = 0;

        var uid = "";

        var namespaceMapEntries = namespaceMap[restrictedKey];

        if (!namespaceMapEntries) {
            continue;
        }

        var namespaces = Object.keys(namespaceMapEntries).sort();
        if (namespaces.length === 0) {
            continue;
        }

        var hasRestrictedNamespaces = (restrictedKey === ComponentDefLoader.RESTRICTED_KEY);


        for (var i = 0; i < namespaces.length; i++) {
            var namespace = namespaces[i];
            var name;
            var names = Object.keys(namespaceMapEntries[namespace]).sort();

            if (namespaces.length === 1 && names.length === 1) {
                name = names[0];
                uri = "&" + ComponentDefLoader.DESCRIPTOR_param + "=" + ComponentDefLoader.MARKUP + namespace + ":" + name;
                if ($A.util.isString(namespaceMapEntries[namespace][name])) {
                    uid = namespaceMapEntries[namespace][name];
                    numberOfDescriptorsInUid++;
                }
                uris.push([uri, uid, hasRestrictedNamespaces, numberOfDescriptorsInUid]);
                uri = "";
                break;
            }

            var additionalURI = "&" + namespace + "=" + names.join(",");
            if (additionalURI.length + uri.length > maxLength) {
                if (additionalURI.length > maxLength) {
                    additionalURI = "&" + namespace + "=";
                    for (var name_idx = 0; name_idx < names.length; name_idx++) {
                        name = names[name_idx];
                        if (additionalURI.length + name.length + uri.length > maxLength) {
                            uri += additionalURI;
                            uris.push([uri, uid, hasRestrictedNamespaces, numberOfDescriptorsInUid]);
                            numberOfDescriptorsInUid = 0;
                            if ($A.util.isString(namespaceMapEntries[namespace][name])) {
                                uid = namespaceMapEntries[namespace][name];
                                numberOfDescriptorsInUid++;
                            } else {
                                uid = "";
                            }
                            additionalURI = "&" + namespace + "=" + name;
                            uri = "";
                        } else {
                            additionalURI += (name_idx > 0 ? "," : "") + name;
                            var additional_def_uid = namespaceMapEntries[namespace][name];
                            if ($A.util.isString(additional_def_uid)) {
                                if (additional_def_uid.length === 0) {
                                    numberOfDescriptorsInUid = -1000;
                                }
                                uid += additional_def_uid;
                                numberOfDescriptorsInUid++;
                            }
                        }
                    }
                    uri = additionalURI;
                    names.length = 0;
                } else {
                    uris.push([uri, uid, hasRestrictedNamespaces, numberOfDescriptorsInUid]);
                    uid = "";
                    uri = additionalURI;
                    numberOfDescriptorsInUid = 0;
                }
            } else {
                uri += additionalURI;
            }
            for (var j = 0; j < names.length; j++) {
                var def_uid = namespaceMapEntries[namespace][names[j]];
                if ($A.util.isString(def_uid)) {
                    uid += def_uid;
                    numberOfDescriptorsInUid++;
                }
            }
        }

        if (uri !== "") {
            uris.push([uri, uid, hasRestrictedNamespaces, numberOfDescriptorsInUid]);
        }
    }

    var processedURI = [];
    if (existingRequested.counter > 0) {
        processedURI.push(new Promise(function(resolve, reject){
            existingRequested.resolve = resolve;
            existingRequested.reject = reject;
        }));
    }

    for (var def=0; def<uris.length; def++) {
        var finalURI = this.buildURIString(uris[def][0], uris[def][1], uris[def][3]);
        var host = $A.clientService._host;
        if (/* it doesn't have a restricted namespace */ !uris[def][2] && /* uid is not LATEST-N */ uris[def][1].length) {
            host = $A.getContext().cdnHost || host;
        }
        processedURI.push(host + baseURI + finalURI.uriString);
    }
    return processedURI;
};

ComponentDefLoader.prototype.buildURIString = function(uri, uid, numberOfDescriptorsInUid) {
    if (!uid.length) {
        uid = ComponentDefLoader.UID_default + "-" + (this.counter++);
    } else if (numberOfDescriptorsInUid > 1) {
        uid = $A.util.getHashCode(uid);
    }

    return {uriString: uri + "&" + ComponentDefLoader.UID_param + "=" + uid, uid: uid};
};

ComponentDefLoader.prototype.getScriptPromises = function(descriptorMap) {
    var scriptPromises = [];
    var URIs = this.buildBundleComponentUri(descriptorMap);
    var idx = 0;
    if (URIs.length > 0 && !$A.util.isString(URIs[0])) {
        scriptPromises.push(URIs[0]);
        idx = 1;
    }
    while (idx < URIs.length) {
        scriptPromises.push(this.generateScriptTag(URIs[idx++]));
    }
    return scriptPromises;
};

ComponentDefLoader.prototype.retrievePending = function(pending) {
    //DQ TODO: Need to either review what is passed in (`pending`) or harden
    //how the object is used. A lot of assumptions about the shape of `pending` here.
    var scriptPromises = this.getScriptPromises(pending.descriptorMap);
    this.loading++;
    var that = this;

    Promise["all"](scriptPromises)["then"](function(){
        for (var j = 0; j < pending.callbacks.length; j++) {
            var scope = {idx:j, total:pending.callbacks.length, remaining:pending.callbacks.length-j-1};
            try {
                pending.callbacks[j].call(scope);
            } catch (e) {
                var errorMessage = e.message ? e.message : "Error in callback provided to component creation.";
                $A.reportError(errorMessage, e);
            }
        }
        that.loading--;
    }, function(e){
	if ($A.util.isObject(e) && e.hasOwnProperty("event")) {
	    try {
		$A.clientService.setCurrentAccess(pending.access);
		$A.clientService.parseAndFireEvent(e.event);
	    } catch (e1) {
		// ignore event exception, continue with callbacks with original error
	    } finally {
		$A.clientService.releaseCurrentAccess();
	    }
	}
        for (var j = 0, p_length = pending.callbacks.length; j < p_length; j++) {
            try {
                // all callbacks get the error if only one errors, we aren't tracking which def was for which callback
                pending.callbacks[j](e);
            } catch (callbackError) {
                var errorMessage = callbackError.message ? callbackError.message : "Error in callback provided to component creation.";
                if (e && e.message) {
                    errorMessage +=  "\nAdditional exception on component load: " + e.message;
                }
                $A.reportError(errorMessage, callbackError);
            }
        }
        that.loading--;
        if (pending.callbacks.length === 0) {
            // there was no callbacks, the error should still be surfaced
            $A.reportError("Error loading component definitions", e);
        }
    })["then"](this.loadingComplete, this.loadingComplete);
};

// Exists only so that instrumentation can hook into script tag load completes
// Called when all the script tags have finished loading. Hook defined in Aura_exports override map
// ComponentDefLoader.loadingComplete
ComponentDefLoader.prototype.loadingComplete = function() {
    // no-op empty function
};

ComponentDefLoader.prototype.getError = function (uri) {
   var startIndex = uri.indexOf("&", uri.indexOf(this.lastContextParameterName) + this.lastContextParameterName.length);
    var endIndex = uri.indexOf("&" + ComponentDefLoader.UID_param + "=");
    var loaderErrorString = uri.substr(startIndex, endIndex-startIndex);
    if (loaderErrorString.indexOf("&_def=") === 0) {
        loaderErrorString = loaderErrorString.substr(6);
    }
    if (Aura["componentDefLoaderError"][loaderErrorString] && Aura["componentDefLoaderError"][loaderErrorString].length > 0) {
        return Aura["componentDefLoaderError"][loaderErrorString].pop();
    }
    return undefined;
};

ComponentDefLoader.prototype.createScriptElement = function(uri, onload, onerror) {
    var that = this;
    var counter = this.scriptTagCounter++;
    var startMark = $A.metricsService.markStart(ComponentDefLoader.MARK_NS, ComponentDefLoader.MARK_NAME, { "defLoaderId": counter });

    var script = document.createElement("script");
    script["type"] = "text/javascript";
    script["src"] = uri;
    script["onload"] = function() {
        var endMark = $A.metricsService.markEnd(ComponentDefLoader.MARK_NS, ComponentDefLoader.MARK_NAME);
        var endMarkContext = $A.metricsService.findAndSummarizeResourcePerfInfo(uri, startMark["ts"], endMark["ts"]) || {};
        endMarkContext["defLoaderId"] = counter;
        delete endMarkContext["name"];
        endMarkContext["defs"] = that.getDescriptorsFromURI(uri).slice(1,10); // only log first 10 descriptors fetched
        endMark["context"] = endMarkContext;
        onload();
        script["onload"] = script["onerror"] = undefined;
        document.body.removeChild(script);
    };
    script["onerror"] = function(){
        onerror();
        script["onload"] = script["onerror"] = undefined;
        document.body.removeChild(script);
    };
    script["nonce"] = $A.getContext().scriptNonce;
    document.body.appendChild(script);
};

ComponentDefLoader.prototype.setScriptGenerator = function (method) {
    ComponentDefLoader.prototype.createScriptElement = method;
};

ComponentDefLoader.prototype.generateScriptTag = function(uri) {
    if (!uri) {
        return Promise["resolve"]();
    }

    var that = this;
    return new Promise(function(resolve, reject) {
        that.createScriptElement(uri,
            function () {
                var error = that.getError(uri);
                if (error === undefined) {
                    resolve();
                    that.processRequested();
                } else {
                    reject(error);
                }
            },
            function () {
                var error = that.getError(uri);
                if (error === undefined) {
                    // if we had an onerror, but didn't get an error message
                    // we assume there's a network issue and we are potentially offline
                    $A.clientService.setConnected(false);
                    error = ComponentDefLoader.UNKNOWN_ERROR_MESSAGE_PREFIX + uri;
                }
                reject(error);
                that.rejectPendingRequested(uri);
            }
        );
    });
};

ComponentDefLoader.prototype.schedulePending = function() {
    var that = this;
    this.pending = { callbacks: [], descriptorMap: {}, access: $A.clientService.currentAccess };
    window.setTimeout(function() {
        that.retrievePending.call(that, that.pending);
        that.pending = null;
    }, 0);
    if (!Aura["componentDefLoaderError"]) {
        Aura["componentDefLoaderError"] = {};
    }
};

ComponentDefLoader.prototype.loadComponentDef = function(descriptor, uid, callback) {
    if (this.pending === null) {
        this.schedulePending();
    }

    this.pending.callbacks.push(callback);
    this.pending.descriptorMap[descriptor] = uid;
};

ComponentDefLoader.prototype.loadComponentDefs = function(descriptorMap, callback) {
    if (this.pending === null) {
        this.schedulePending();
    }
    if (callback && typeof callback === "function") {
        //DQ: Should we error here or just bypass this if callback is null?
        this.pending.callbacks.push(callback);
        //Can descriptor map be null? Im pretty sure the answer is 'no'
        Object.assign(this.pending.descriptorMap, descriptorMap);
    }
};

/**
 * Simple Object to define a paramter for uri definition
 * @constructor
 */
function ComponentDefLoaderParameter(name, valueMethod) {
    if (!$A.util.isString(name)) {
        throw new AuraError("paramter name must be a string, but was: " + (typeof name));
    }
    this.name = name;
    if (typeof valueMethod !== "function") {
        throw new AuraError("valueMethod must be a function, but was: " + (typeof valueMethod));
    }
    this.getValue = valueMethod;
}

Aura.Component.ComponentDefLoader = ComponentDefLoader;
Aura.Component.ComponentDefLoaderParameter = ComponentDefLoaderParameter;
