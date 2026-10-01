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
 * ComponentMetricsPlugin
 * =================
 * The plugin summarizes marks that have been injected directly 
 * for component create, render, and re-render
 *
 * @description ComponentMetricsPlugin
 * @constructor
 * @export
 */
var ComponentMetricsPlugin = function ComponentMetricsPlugin(config) {
    this.config = config;
    this["enabled"] = true;
};

ComponentMetricsPlugin.NAME = "component";

/** @export */
ComponentMetricsPlugin.prototype.initialize = function (metricsService) {
    this.metricsService = metricsService;
};

/** @export */
ComponentMetricsPlugin.prototype.enable = function () {
    if (!this["enabled"]) {
        this["enabled"] = true;
    }
};

/** @export */
ComponentMetricsPlugin.prototype.disable = function () {
    if (this["enabled"]) {
        this["enabled"] = false;
    }
};

ComponentMetricsPlugin.prototype.summarizeCreateInfo = function(cmp, duration, ts) {
    cmp["createCount"] = cmp["createCount"] || 0;
    cmp["createTimeTotal"] = cmp["createTimeTotal"] || 0;
    
    cmp["createCount"]++;
    cmp["createTimeTotal"] += duration;
    
    // TODO: Do we want to log these ? This is an array when the create events happened
    // along with the individual duration
    //#if {"excludeModes" : ["PRODUCTION"]}
    cmp["createTs"] = cmp["createTs"] || [];
    cmp["createDuration"] = cmp["createDuration"] || [];
    cmp["createTs"].push(ts);
    cmp["createDuration"].push(duration);
    //#end
};

/** @export */
ComponentMetricsPlugin.prototype.postProcess = function (marks) {
    var processedMarks = [];
    var uniqueCmps = {};
    var mark;
    for (var i = 0; i < marks.length; i++) {
        mark = marks[i];
        var name        = mark["context"]["name"];
        var ts          = mark["ts"];
        var duration    = Math.floor(mark["duration"] * 100)/ 100;
        var type        = mark["name"]; // render, create, re-render
        var cmp         = uniqueCmps[name];
        if (!cmp) {
            cmp = {
                    "name" : name
            };
            processedMarks.push(cmp);
            uniqueCmps[name] = cmp;
        }
        if (type === 'create') {
            this.summarizeCreateInfo(cmp, duration, ts);
        } else {
            $A.warning("[ComponentMetricsPlugin] Unexpected type of mark encountered in the component namespace:" + type);
        }
    }
    return processedMarks;
};

$A.metricsService.registerPlugin({
    "name"   : ComponentMetricsPlugin.NAME,
    "plugin" : ComponentMetricsPlugin
});
