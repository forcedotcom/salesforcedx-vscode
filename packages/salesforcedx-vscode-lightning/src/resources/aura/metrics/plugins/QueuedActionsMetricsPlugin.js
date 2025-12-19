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
 * QueuedActionsMetricsPlugin
 * =================
 * This plugin tracks the state and result of all actions from the framework
 * @description Queued Action metrics plugin
 * @constructor
 * @export
 */
var QueuedActionsMetricsPlugin = function QueuedActionsMetricsPlugin(config) {
    this.config = config;
    this["enabled"] = true;
};

QueuedActionsMetricsPlugin.NAME = "actions";

/** @export */
QueuedActionsMetricsPlugin.prototype.initialize = function (metricsService) {
    this.metricsService = metricsService;
    if (this["enabled"]) {
        this.bind(metricsService);
    }
};

/** @export */
QueuedActionsMetricsPlugin.prototype.enable = function () {
    if (!this["enabled"]) {
        this["enabled"] = true;
        this.bind(this.metricsService);
    }
};

/** @export */
QueuedActionsMetricsPlugin.prototype.disable = function () {
    if (this["enabled"]) {
        this["enabled"] = false;
        this.unbind(this.metricsService);
    }
};

QueuedActionsMetricsPlugin.prototype.enqueueActionOverride = function() {
    var config = Array.prototype.shift.apply(arguments);
    var action = arguments[0];
    var cmp = action.getComponent();

    if (action.getDef().isServerAction()) {
        var mark = this.metricsService["mark"](QueuedActionsMetricsPlugin.NAME, 'enqueue', {
            "id"           : action.getId(),
            "abortable"    : action.isAbortable(),
            "storable"     : action.isStorable(),
            "background"   : action.isBackground(),
            "cmp"          : (cmp && cmp.getType()) || "none",
            "def"          : action.getDef().toString()
        });
        var params =  action.getLoggableParams();
        if(!$A.util.isEmpty(params)){
            mark["params"] = params;
        }
    }

    //console.log('>>> ActionEnqueue :: %s [%s]', action.getId(), action.getDef()+'');

    var ret = config["fn"].apply(config["scope"], arguments);
    return ret;
};

QueuedActionsMetricsPlugin.prototype.collectServerActionOverride = function() {
    var config = Array.prototype.shift.apply(arguments);
    var action = arguments[0];
    this.metricsService["mark"](QueuedActionsMetricsPlugin.NAME, 'sendQueued', {
        "id"    : action.getId()
    });
    return config["fn"].apply(config["scope"], arguments);
};

QueuedActionsMetricsPlugin.prototype.actionSendOverride = function() {
    var config = Array.prototype.shift.apply(arguments);
    var actions = arguments[1];

    for (var i = 0; i < actions.length; i++) {
        this.metricsService["mark"](QueuedActionsMetricsPlugin.NAME, 'sendStart', {
            "id" : actions[i].getId()
        });
    }
    //console.log('>>> ActionSend :: [%s]', actions.map(function (a) {return a.getId(); }).join(','));

    return config["fn"].apply(config["scope"], arguments);
};

QueuedActionsMetricsPlugin.prototype.actionFinishOverride = function() {
    var config = Array.prototype.shift.apply(arguments);
    var action = config["self"];
    // we don't want to log client side actions
    var shouldLog = action.getDef().isServerAction();
    shouldLog && this.metricsService["mark"](QueuedActionsMetricsPlugin.NAME, 'finishStart', {
        "id"    : action.getId(),
        "state" : action.getState(),
        "cache" : action.isFromStorage()
    });
    var ret = undefined;
    //console.log('>>> ActionFinish :: ', config["self"].getId());
    try {
        ret = config["fn"].apply(config["scope"], arguments);
    } finally {
        shouldLog && this.metricsService["mark"](QueuedActionsMetricsPlugin.NAME, 'finishEnd', {
            "id"    : action.getId()
        });
    }
    return ret;
};

QueuedActionsMetricsPlugin.prototype.actionsProcessResponses = function() {
    var config = Array.prototype.shift.apply(arguments);
    var message = arguments[1];
    // the decoded and json parsed message is only available in the response to this method
    var perfSummary = message && message["perfSummary"];
    if (perfSummary && perfSummary["version"] === "core") {
        var actions = perfSummary["actions"] || {};
        var xhrServerTime = perfSummary["request"];
        var keys = Object.keys(actions);
        var numberOfActions = keys.length;
        for (var i = 0; i < numberOfActions; i++) {
            var id = keys[i];
            var serverTime = actions[id];
            serverTime["xhrServerTime"] = xhrServerTime;
            serverTime["boxCarCount"] = numberOfActions;
            this.metricsService["mark"](QueuedActionsMetricsPlugin.NAME, 'receive', {
                "id"         : id,
                "serverTime" : serverTime
            });
        }
    }
    return config["fn"].apply(config["scope"], arguments);
};

QueuedActionsMetricsPlugin.prototype.bind = function () {
    // Time of $A.enqueue
    $A.installOverride("enqueueAction", this.enqueueActionOverride, this);

    // Time when action is immediately ready to send
    $A.installOverride("ClientService.collectServerAction", this.collectServerActionOverride, this);

    // Time when the action is sent
    $A.installOverride("ClientService.send", this.actionSendOverride, this);
    
    // Time when response for all actions is received by client
    $A.installOverride("ClientService.processResponses", this.actionsProcessResponses, this);

    // Time when the action is done
    $A.installOverride("Action.finishAction", this.actionFinishOverride, this);
    
};

/** @export */
QueuedActionsMetricsPlugin.prototype.postProcess = function (actionMarks /*, trxConfig*/) {
    var processedMarks = [];
    var queue  = {};

    // This loop is to assemble the action time
    for (var i = 0; i < actionMarks.length; i++) {
        var actionMark = actionMarks[i];
        var id = actionMark["context"]["id"];
        var mark = queue[id];
        var name = actionMark["name"];
        
        if (name === 'enqueue') {
            queue[id] = $A.util.apply({}, actionMark);
        }
        
        if (mark) {
            switch (name) {
            case "sendQueued":
                mark["xhrWait"] = Math.floor(actionMark["ts"]);
                mark["enqueueWait"] = Math.floor(actionMark["ts"] - mark["ts"]);
                break;
            case "sendStart":
                if (mark["xhrWait"] === undefined) {
                    mark["xhrWait"] = 0;
                } else {
                    mark["xhrWait"] = Math.floor(actionMark["ts"] - mark["xhrWait"]);
                }
                // send can start immediately as well before a sendQueued is triggered for executeHotspot
                if (mark["enqueueWait"] === undefined) {
                    mark["enqueueWait"] = Math.floor(actionMark["ts"] - mark["ts"]);
                }
                break;
            case "receive":
                mark["serverTime"] = actionMark["context"]["serverTime"];
                break;
            case "finishStart":
                $A.util.apply(mark["context"], actionMark["context"]);
                mark["callbackTime"] = actionMark["ts"];
                // these actions can come from storage too, so enqueueWait wouldn't normally be marked
                // because we won't go through the sendQueued step
                if (mark["enqueueWait"] === undefined) {
                    mark["enqueueWait"] = Math.floor(actionMark["ts"] - mark["ts"]);
                }
                break;
            case "finishEnd":
                mark["callbackTime"] = Math.floor(actionMark["ts"] - mark["callbackTime"]);
                mark["duration"] = Math.floor(actionMark["ts"] - mark["ts"]);
                mark["phase"] = "processed";
                processedMarks.push(mark);
                delete queue[id];
                break;
            }
        }
    }

    return processedMarks;
};

QueuedActionsMetricsPlugin.prototype.unbind = function () {
    $A.uninstallOverride("enqueueAction", this.enqueueActionOverride);
    $A.uninstallOverride("ClientService.collectServerAction", this.collectServerActionOverride);
    $A.uninstallOverride("ClientService.send", this.actionSendOverride, this);
    $A.uninstallOverride("ClientService.processResponses", this.actionsProcessResponses);
    $A.uninstallOverride("Action.finishAction", this.actionFinishOverride);
};

$A.metricsService.registerPlugin({
    "name"   : QueuedActionsMetricsPlugin.NAME,
    "plugin" : QueuedActionsMetricsPlugin
});
