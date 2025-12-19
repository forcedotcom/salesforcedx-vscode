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
 * AuraContextPlugin
 * =================
 * This plugin hooks into the Aura Context object.
 * In particular the following methods:
 * merge(): Tracks the component defs that are sent dynamically to the client.
 *
 * @description AuraContextPlugin
 * @constructor
 * @export
 */
var AuraContextPlugin = function AuraContextPlugin(config) {
    this.config = config;
    this["enabled"] = true; // Do not enable it automatically
};

AuraContextPlugin.NAME = "defRegistry";

/** @export */
AuraContextPlugin.prototype.initialize = function (metricsService) {
    this.collector = metricsService;

    if (this["enabled"]) {
        this.bind(metricsService);
    }
};

/** @export */
AuraContextPlugin.prototype.enable = function () {
    if (!this["enabled"]) {
        this["enabled"] = true;
        this.bind(this.collector);
    }
};

/** @export */
AuraContextPlugin.prototype.disable = function () {
    if (this["enabled"]) {
        this["enabled"] = false;
        this.unbind(this.collector);
    }
};

AuraContextPlugin.prototype.bind = function (metricsService) {
    var method  = 'merge',
    defIter = function (b) {
        var a = [];
        for (var i = 0; i < b.length; i++) {
            var def = b[i];
            if (def['descriptor']) {
                a.push(def['descriptor']);
            }
        }
        return a;
    },
    hook = function (original, config) {
        var ret     = original.apply(this, Array.prototype.slice.call(arguments, 1)),
            cmpDefs = config['componentDefs'],
            evtDefs = config['eventDefs'],
            payload =  {},
            hasDefs = (cmpDefs && cmpDefs.length) || (evtDefs && evtDefs.length);

        if (cmpDefs) {
            payload['componentDefs'] = defIter(cmpDefs);
        }

        if (evtDefs) {
            payload['eventDefs'] = defIter(evtDefs);
        }

        if (hasDefs) {
            metricsService['transaction']('aura', 'newDefs', { "context": {"attributes" : payload } });
        }
        
        return ret;
    };

	metricsService.instrument(
	    Aura.Context.AuraContext.prototype,
	    method,
	    AuraContextPlugin.NAME,
	    false/*async*/,
	    null,
	    null,
	    hook
	);
};

//#if {"excludeModes" : ["PRODUCTION"]}
/** @export */
AuraContextPlugin.prototype.postProcess = function (transportMarks) {
    return transportMarks;
};
//#end

AuraContextPlugin.prototype.unbind = function (metricsService) {
    metricsService["unInstrument"](Aura.Context.AuraContext.prototype, 'merge');
};

$A.metricsService.registerPlugin({
    "name"   : AuraContextPlugin.NAME,
    "plugin" : AuraContextPlugin
});
