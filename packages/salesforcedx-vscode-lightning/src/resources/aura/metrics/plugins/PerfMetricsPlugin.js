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
 * PerfMetricsPlugin
 * =================
 * This plugin hooks into the ClientService.
 * In particular the following methods:
 * processResponses(): Gets the performance metrics sent from the server
 * and creates a mark so transactions can leverage all this information
 *
 * @description Transport metrics plugin
 * @constructor
 */
var PerfMetricsPlugin = function PerfMetricsPlugin(config) {
    this.config = config;
    this["enabled"] = true;
};

PerfMetricsPlugin.NAME = "server";
PerfMetricsPlugin.prototype = {
    initialize: function (metricsService) {
        this.collector = metricsService;
        if (this["enabled"]) {
            this.bind(metricsService);
        }
    },
    enable: function () {
        if (!this["enabled"]) {
            this["enabled"] = true;
            this.bind(this.collector);
        }
    },
    disable: function () {
        if (this["enabled"]) {
            this["enabled"] = false;
            this.unbind(this.collector);
        }
    },
    processResponsesOverride : function (/* config, auraXHR, responseObject, noAbort */) {
        var config         = Array.prototype.shift.apply(arguments),
            auraXHR        = arguments[0],
            responseObject = arguments[1],
            perfData       = responseObject["perf"],
            stampMark      = this.collector["mark"](PerfMetricsPlugin.NAME, 'perf');

        if (perfData) {
            stampMark["context"] = {
                "id"        : auraXHR.marker,
                "requestId" : auraXHR["requestId"],
                "perf"      : perfData
            };
        }

        return config["fn"].apply(config["scope"], arguments);
    },
    bind: function () {
        $A.installOverride("ClientService.processResponses", this.processResponsesOverride, this);
    },
    //#if {"excludeModes" : ["PRODUCTION"]}
    postProcess: function (markList) {
        return markList;
    },
    // #end
    unbind: function () {
        $A.uninstallOverride("ClientService.processResponses", this.processResponsesOverride);
    }
};

// Exposing symbols/methods for Google Closure

PerfMetricsPlugin.prototype["initialize"] = PerfMetricsPlugin.prototype.initialize;
PerfMetricsPlugin.prototype["enable"] = PerfMetricsPlugin.prototype.enable;
PerfMetricsPlugin.prototype["disable"] = PerfMetricsPlugin.prototype.disable;
PerfMetricsPlugin.prototype["postProcess"] = PerfMetricsPlugin.prototype.postProcess;

$A.metricsService.registerPlugin({
    "name"   : PerfMetricsPlugin.NAME,
    "plugin" : PerfMetricsPlugin
});
