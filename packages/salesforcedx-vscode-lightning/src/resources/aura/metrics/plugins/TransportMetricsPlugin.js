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
 * TransportMetricsPlugin
 * =================
 * This plugin tracks information about all XHRs done to the aura servlet
 * @description Transport metrics plugin
 * @constructor
 * @export
 */
var TransportMetricsPlugin = function TransportMetricsPlugin(config) {
    this.config = config;
    this["enabled"] = true;
};

TransportMetricsPlugin.NAME = "transport";
TransportMetricsPlugin.ORIGIN = window.location && window.location.origin;
TransportMetricsPlugin.AURA_URL = TransportMetricsPlugin.ORIGIN + '/aura';
TransportMetricsPlugin.SERVER_TIMING_HEADER = "Server-Timing";
TransportMetricsPlugin.SERVER_TIMING_TOTAL = "total";
TransportMetricsPlugin.SERVER_TIMING_DURATION = "dur";

/** @export */
TransportMetricsPlugin.prototype.initialize = function (metricsService) {
    this.metricsService = metricsService;
    if (this["enabled"]) {
        this.bind(metricsService);
    }
};

/** @export */
TransportMetricsPlugin.prototype.enable = function () {
    if (!this["enabled"]) {
        this["enabled"] = true;
        this.bind(this.metricsService);
    }
};

/** @export */
TransportMetricsPlugin.prototype.disable = function () {
    if (this["enabled"]) {
        this["enabled"] = false;
        this.unbind(this.metricsService);
    }
};

/**
 * 
 * @param {XMLHttpRequest} request
 * @returns {number} header value 
 */
TransportMetricsPlugin.prototype.getServerTimingTotal = function (request) {
    var serverTimingHeader = request.getResponseHeader(TransportMetricsPlugin.SERVER_TIMING_HEADER);
    if (typeof serverTimingHeader === "string") {
        var serverTiming = this.parseServerTimingHeader(serverTimingHeader);
        var totalKey = serverTiming[TransportMetricsPlugin.SERVER_TIMING_TOTAL];
        var totalValue = totalKey && totalKey[TransportMetricsPlugin.SERVER_TIMING_DURATION];
        if (isNaN(totalValue)) {
            return undefined;
        } else {
            return totalValue;
        }
    } else {
        return undefined;
    }
};

/**
 * Parse Server-Timing using spec: https://w3c.github.io/server-timing/
 * @param {string} serverTimingHeader
 * @returns {object} Server Timing Object
 */
TransportMetricsPlugin.prototype.parseServerTimingHeader = function (serverTimingHeader) {
    serverTimingHeader = serverTimingHeader.toLowerCase();
    var serverTiming = {};
    try {
        if (serverTimingHeader.length > 0) {
            var typeSplit = serverTimingHeader.split(",");
            for (var i = 0; i < typeSplit.length; i++) {
                var typeDetailSplit = typeSplit[i].split(";");
                var name = typeDetailSplit[0].trim();
                serverTiming[name] = {};
                for (var j = 1; j < typeDetailSplit.length; j++) {
                    var metricKeyValue = typeDetailSplit[j].split("=");
                    if (metricKeyValue.length === 2) {
                        var keyName = metricKeyValue[0].trim();
                        var metricValue = metricKeyValue[1].trim();
                        if (keyName === TransportMetricsPlugin.SERVER_TIMING_DURATION) {
                            metricValue = parseInt(metricValue);
                        }
                        serverTiming[name][keyName] = metricValue;
                    }
                }
            }
        }
    } catch (e) {
        // ignore the exception and bail out on parsing server timing header
    }
    return serverTiming;
};

TransportMetricsPlugin.prototype.sendOverride = function (/* config, auraXHR, actions, method, options */) {
    var config = Array.prototype.shift.apply(arguments);
    var auraXHR = arguments[0];
    var options = arguments[3] || {};
    // capture the time at which the xhr send is actually called
    // don't trigger a mark. if the XHR isn't succcessful, we don't track it
    // and so we don't want orphan markStart marks. Not capturing the correct starttime can
    // result in negative values for xhrDelay
    var sendTime = this.metricsService.time();
    var ret = config["fn"].apply(config["scope"], arguments);

    if (ret) {
        var startMark = this.metricsService["markStart"](TransportMetricsPlugin.NAME, 'request');
        // since the xhr actually went out when the original send function is called
        startMark["ts"] = sendTime;
        var actionDefs = [];
        for (var id in auraXHR.actions) {
            if (auraXHR.actions.hasOwnProperty(id)) {
                actionDefs.push(id);
            }
        }

        startMark["context"] = {
            "auraXHRId"     : auraXHR.marker,
            "requestLength" : auraXHR.length,
            "background"    : !!options.background,
            "actionDefs"    : actionDefs,
            "requestId"     : auraXHR["requestId"] || options["requestId"]
        };
    }
    return ret;
};

TransportMetricsPlugin.prototype.receiveOverride = function(/* config, auraXHR */) {
    var config  = Array.prototype.shift.apply(arguments);
    var auraXHR = arguments[0];
    var endMark = this.metricsService["markEnd"](TransportMetricsPlugin.NAME, "request");
     
    endMark["context"] = {
        "auraXHRId"      : auraXHR.marker,
        "status"         : auraXHR.request.status,
        "statusText"     : auraXHR.request.statusText
    };
    // Accessing responseText can fail in IE11 for large payloads or other reasons
    // set to 0 if can't access it
    try {
        endMark["context"]["responseLength"] = auraXHR.request.responseText.length;
    } catch (ex) {
        endMark["context"]["responseLength"] = 0;
    }

    if (window.performance && window.performance.getEntriesByName) {
        var allResources = window.performance.getEntriesByType("resource");
        var r = allResources.filter(function (res) {
            return res.name.indexOf(auraXHR.url) !== -1; 
        })[0];
        
        if (r) {
            $A.util.apply(endMark["context"], {
                "xhrDuration"     : parseInt(r.responseEnd - r.startTime, 10),
                "xhrStall"        : parseInt(r.requestStart - r.startTime, 10),
                "startTime"       : parseInt(r.startTime, 10),
                "fetchStart"      : parseInt(r.fetchStart, 10),
                "requestStart"    : parseInt(r.requestStart, 10),
                "dns"             : parseInt(r.domainLookupEnd - r.domainLookupStart, 10),
                "tcp"             : parseInt(r.connectEnd - r.connectStart, 10),
                "ttfb"            : parseInt(r.responseStart - r.startTime, 10),
                "transfer"        : parseInt(r.responseEnd - r.responseStart, 10),
                "transferSize"    : r["transferSize"] || 0
            });
        }
    }
    // https://www.w3.org/TR/server-timing/
    // If there's a server timing header, use that
    var serverTiming = this.getServerTimingTotal(auraXHR.request);
    if (serverTiming !== undefined) {
        endMark["context"]["serverTime"] = serverTiming;
    }
    var ret = config["fn"].apply(config["scope"], arguments);
    // the decoded and json parsed message is only available in the response to this method
    var perfSummary = ret && ret["message"] && ret["message"]["perfSummary"];
    if (serverTiming === undefined && perfSummary && perfSummary["version"] === "core") {
        endMark["context"]["serverTime"] = perfSummary["request"];
    }
    return ret;
};

TransportMetricsPlugin.prototype.bind = function () {
    $A.installOverride("ClientService.send", this.sendOverride, this);
    $A.installOverride("ClientService.receive", this.receiveOverride, this);
};

/** @export */
TransportMetricsPlugin.prototype.postProcess = function (transportMarks) {
    var procesedMarks = [];
    var queue = {};
    for (var i = 0; i < transportMarks.length; i++) {
        var id = transportMarks[i]["context"] && 
                    (transportMarks[i]["context"]["auraXHRId"] || transportMarks[i]["context"]["defLoaderId"]);
        if (id === undefined) {
            continue;
        }
        var phase = transportMarks[i]["phase"];
        if (phase === 'start') {
            queue[id] = transportMarks[i];
        } else if (phase === 'end' && queue[id]){
            var mark = $A.util.apply({}, queue[id], true, true);
            var duration = parseInt(transportMarks[i]["ts"] - mark["ts"]);
            mark["context"]  = $A.util.apply(mark["context"] || {}, transportMarks[i]["context"]);
            mark["duration"] = duration;
            mark["context"]["xhrDelay"] = duration - (mark["context"]["xhrDuration"] || mark["context"]["duration"]);
            mark["phase"]    = 'processed';
            procesedMarks.push(mark);
            delete queue[id];
        }
    }

    return procesedMarks;
};

TransportMetricsPlugin.prototype.unbind = function () {
    $A.uninstallOverride("ClientService.send", this.sendOverride);
    $A.uninstallOverride("ClientService.receive", this.receiveOverride);
};

$A.metricsService.registerPlugin({
    "name"   : TransportMetricsPlugin.NAME,
    "plugin" : TransportMetricsPlugin
});
