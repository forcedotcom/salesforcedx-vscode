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
 * @description Creates an AuraError instance.
 * @constructor
 * @param {String} message - the detail message about the error.
 * @param {Object} innerError - an Error object whose properties are to be placed into AuraError.
 * @param {String} severity - the severity of the error. Aura built-in values are defined in $A.severity.
 */
function AuraError(message, innerError, severity) {

    /* parse error to create stack frames */
    function getStackFrames(e) {
        var remove = 0;
        if (!e || !e.stack) {
            try {
                throw new Error("foo");
            } catch (f) {
                e = f;
                // fabricated frames to remove:
                // 0: new $A.auraError
                // 1: getStackFrames
                // 2: throw new Error("foo")
                remove += 3;
            }
        }

        return Aura.Errors.StackParser.parse(e).slice(remove);
    }

    /* analyze stack frames to create meaningful trace */
    function getStackTrace(frames) {
        // only strip out stack-frames after a non-framework stack-frame,
        // and keep stack-frames before a non-framework stack-frame intact.
        var filtered = [];
        var nonFrameworkStackFrameExist = false;
        var isNonFrameworkStackFrame = false;
        for (var i = 0; i < frames.length; i++) {
            isNonFrameworkStackFrame = !frames[i].fileName || frames[i].fileName.match(/aura_[^\.]+\.js$/gi) === null;
            if (!nonFrameworkStackFrameExist) {
                filtered.push(frames[i]);
                nonFrameworkStackFrameExist = isNonFrameworkStackFrame;
            } else {
                if (isNonFrameworkStackFrame) {
                    filtered.push(frames[i]);
                }
            }
        }
        return filtered.join('\n');
    }

    // the component that throws the error
    this["component"] = "";

    // the component stack that contains the component that throws the error
    this["componentStack"] = "";

    // the action that errors out
    this.action = null;

    if (message == null) {
        message = '';
    }

    this.name = innerError ? innerError.name : "AuraError";
    this.message = message + (innerError ? " [" + (innerError.message || innerError.toString()) + "]" : "");
    this.stackFrames = getStackFrames(innerError);
    this.stackTrace = getStackTrace(this.stackFrames);
    this.severity = innerError ? (innerError.severity || severity) : severity;
    this["handled"] = innerError ? (innerError["handled"] || false) : false;
    this["reported"] = innerError ? (innerError["reported"] || false) : false;

    this["name"] = this.name;
    this["message"] = this.message;
    this["stackTrace"] = this.stackTrace;
    this["severity"] = this.severity;
    this["data"] = null;
    this["stackFrames"] = this.stackFrames;
    this["stacktraceIdGen"] = "";
    this["id"] = "";

    // Access Stack defaults - takes dependency on $A.clientService
    if ((typeof $A) !== "undefined" && $A.clientService) {
        var currentAccess = $A.clientService.getCurrentAccessName();
        if (currentAccess) {
            this.setComponent(currentAccess);
            this["componentStack"] = $A.clientService.getAccessStackHierarchy();
        }
    }

}

/* port murmur32 from guava */
Aura.Errors.MurmurHash3 = {
    mul32: function(m, n) {
        var nlo = n & 0xffff;
        var nhi = n - nlo;
        return ((nhi * m | 0) + (nlo * m | 0)) | 0;
    },

    hashString: function(data) {
        var c1 = 0xcc9e2d51, c2 = 0x1b873593;
        var h1 = 0;
        var len = data.length;
        for (var i = 1; i < len; i += 2) {
            var k1 = data.charCodeAt(i - 1) | (data.charCodeAt(i) << 16);
            k1 = this.mul32(k1, c1);
            k1 = ((k1 & 0x1ffff) << 15) | (k1 >>> 17);  // ROTL32(k1,15);
            k1 = this.mul32(k1, c2);

            h1 ^= k1;
            h1 = ((h1 & 0x7ffff) << 13) | (h1 >>> 19);  // ROTL32(h1,13);
            h1 = (h1 * 5 + 0xe6546b64) | 0;
        }

        if((len % 2) === 1) {
            k1 = data.charCodeAt(len - 1);
            k1 = this.mul32(k1, c1);
            k1 = ((k1 & 0x1ffff) << 15) | (k1 >>> 17);  // ROTL32(k1,15);
            k1 = this.mul32(k1, c2);
            h1 ^= k1;
        }

        // finalization
        h1 ^= (len << 1);

        // fmix(h1);
        h1 ^= h1 >>> 16;
        h1  = this.mul32(h1, 0x85ebca6b);
        h1 ^= h1 >>> 13;
        h1  = this.mul32(h1, 0xc2b2ae35);
        h1 ^= h1 >>> 16;

        return h1;
    }
};

Aura.Errors.GenerateErrorId = function(hashGen) {
    return Aura.Errors.MurmurHash3.hashString(hashGen);
};

Aura.Errors.GenerateErrorIdHashGen = function(componentName, stackFrames) {
    var hashGen = componentName;
    var fileUrl;
    var functionName;
    for (var i = 0; i < stackFrames.length; i++) {
        var frame = stackFrames[i];
        // if non framework stackframe
        if (!frame.fileName || frame.fileName.match(/aura_[^\.]+\.js$/gi) === null) {
            functionName = frame.functionName;
            fileUrl = frame.fileName;
            break;
        }
    }

    // Use function name if known
    if(functionName !== undefined) {
        hashGen += "$" + functionName;
    }

    // If function name is not known, or was eval, also include filename
    if((functionName === undefined || functionName === "eval()") && fileUrl !== undefined) {
        var parts = fileUrl.split("/");
        var file = parts.slice(Math.max(parts.length - 2, 0)).join("/");
        hashGen += "$/" + file;
    }

    return hashGen;
};


AuraError.prototype = new Error();
AuraError.prototype.constructor = AuraError;
AuraError.prototype.toString = function() {
    return this.message || Error.prototype.toString();
};

/**
 * When there is need to mess with stacktrace, call this method
 * @function
 * @param {String} trace - The trace to be set to this error instance.
 */
AuraError.prototype.setStackTrace = function(trace) {
    this.stackTrace = trace;
};

/**
 * Returns the failing component descriptor based on stacktrace
 */
AuraError.prototype.findComponentFromStackTrace = function() {
    for (var i = 0; i < this.stackFrames.length; i++) {
        var frame = this.stackFrames[i];
        var fileName = frame.fileName;
        // if non framework stackframe
        if (fileName && fileName.match(/aura_[^\.]+\.js$/gi) === null) {
            var pathParts = fileName.replace(".js", "").split("/");

            // aura components: ORIGIN/components/namespace/name.js
            if (pathParts[pathParts.length - 3] === "components") {
                return "markup://" + pathParts.slice(-2).join(":");
            }
            // aura libraries: ORIGIN/libraries/namespace/libraryName/name.js
            if (pathParts[pathParts.length - 4] === "libraries") {
                pathParts = pathParts.slice(-3);
                return "js://" + pathParts[0] + ":" + pathParts[1] + "." + pathParts[2];
            }

            // module components: ORIGIN/components/namespace-name.js
            if (pathParts[pathParts.length - 2] === "components") {
                var moduleName = pathParts[pathParts.length - 1];
                pathParts = moduleName.split(/-(.+)/);
                // convert to Aura descriptor
                return pathParts[0] + ":" + $A.util.hyphensToCamelCase(pathParts[1]);
            }
        }
    }

    return "";
};

AuraError.prototype.setComponent = function(component) {
    this["component"] = component;
    this["stacktraceIdGen"] = Aura.Errors.GenerateErrorIdHashGen(component, this.stackFrames);
    this["id"] = Aura.Errors.GenerateErrorId(this["stacktraceIdGen"]);
};

Aura.Errors.AuraError = AuraError;
