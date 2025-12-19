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
 * ComponentServiceMetricsPlugin
 * =================
 * This plugin hooks into the ComponentService.
 * In particular the following methods:
 * createComponentPriv(): Tracks the component creation time for all components
 *
 * @description ComponentServiceMetricsPlugin
 * @constructor
 * @export
 */
var ComponentServiceMetricsPlugin = function ComponentServiceMetricsPlugin(config) {
    this.config = config;
    this["enabled"] = false; // Do not enable it automatically
};

ComponentServiceMetricsPlugin.NAME = "componentService";

/** @export */
ComponentServiceMetricsPlugin.prototype.initialize = function (metricsService) {
    this.metricsService = metricsService;

    if (this["enabled"]) {
        this.bind(metricsService);
    }
};

/** @export */
ComponentServiceMetricsPlugin.prototype.enable = function () {
    if (!this["enabled"]) {
        this["enabled"] = true;
        this.bind(this.metricsService);
    }
};

/** @export */
ComponentServiceMetricsPlugin.prototype.disable = function () {
    if (this["enabled"]) {
        this["enabled"] = false;
        this.unbind(this.metricsService);
    }
};

ComponentServiceMetricsPlugin.prototype.createComponentOverride = function () {
    var config = Array.prototype.shift.apply(arguments);
    var cmpConfig = arguments[0];
    var descriptor = $A.util.isString(cmpConfig) ? cmpConfig : (cmpConfig["componentDef"]["descriptor"] || cmpConfig["componentDef"]) + '';

    this.metricsService["markStart"](ComponentServiceMetricsPlugin.NAME, 'createComponent', { context: { "descriptor" : descriptor } });
    var ret = config["fn"].apply(config["scope"], arguments);
    this.metricsService["markEnd"](ComponentServiceMetricsPlugin.NAME, 'createComponent', { context: { "descriptor" : descriptor } });

    return ret;
};

ComponentServiceMetricsPlugin.prototype.bind = function () {
    $A.installOverride("ComponentService.createComponentPriv", this.createComponentOverride, this);
};

//#if {"excludeModes" : ["PRODUCTION"]}
/** @export */
ComponentServiceMetricsPlugin.prototype.postProcess = function (componentMarks) {
    var procesedMarks = [];
    var stack = [];
    for (var i = 0; i < componentMarks.length; i++) {
        var phase = componentMarks[i]["phase"];
        if (phase === 'start') {
            stack.push(componentMarks[i]);
        } else if (phase === 'end' && stack.length) {
            var mark = $A.util.apply({}, stack.pop(), true, true);
            if (mark["context"]["descriptor"] === componentMarks[i]["context"]["descriptor"]) {
                mark["context"]  = $A.util.apply(mark["context"], componentMarks[i]["context"]);
                mark["duration"] = componentMarks[i]["ts"] - mark["ts"];    
                procesedMarks.push(mark);
            }
        }
    }
    return procesedMarks;
};
//#end	

ComponentServiceMetricsPlugin.prototype.unbind = function () {
    $A.unInstallOverride("ComponentService.createComponentPriv", this.createComponentOverride);
};

$A.metricsService.registerPlugin({
    "name"   : ComponentServiceMetricsPlugin.NAME,
    "plugin" : ComponentServiceMetricsPlugin
});
