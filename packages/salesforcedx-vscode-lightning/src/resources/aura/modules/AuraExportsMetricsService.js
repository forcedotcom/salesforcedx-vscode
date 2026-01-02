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

var LTNG = "ltng";
var PERF = "performance";
var INTERACTION = "interaction";
var ERROR = "error";
var USER = "user";
var CLICK = "click";

Aura.ExportsMetricsService = {
    "perfStart": function (name, attributes, eventSource) {
        return $A.metricsService.transactionStart(LTNG, PERF + ":" + name, { "context": { "eventSource": eventSource || name, "attributes": attributes }});
    },
    "perfEnd": function (name, attributes, eventSource) {
        return $A.metricsService.transactionEnd(LTNG, PERF + ":" + name, { "context": { "eventSource": eventSource || name, "attributes": attributes }});
    },
    "mark": function (ns, name, ctx) {
        return $A.metricsService.mark(ns, name, ctx);
    },
    "markStart": function (ns, name, ctx) {
        return $A.metricsService.markStart(ns, name, ctx);
    },
    "markEnd": function (ns, name, ctx) {
        return $A.metricsService.markEnd(ns, name, ctx);
    },
    "time": function () {
       return $A.metricsService.time();
    },
    "interaction": function (target, scope, context, eventSource, eventType) {
        return $A.metricsService.transaction(LTNG, INTERACTION, {
            "context": {
                "eventSource" : eventSource || CLICK,
                "eventType"   : eventType || USER,
                "locator"     : {
                    "target"  : target,
                    "scope"   : scope,
                    "context" : context
                }
            }
        });
    },
    "registerCacheStats": function (name) {
        return $A.metricsService.registerCacheStats(name);
     },
     "error": function (attributes, eventSource, eventType) {
        return $A.metricsService.transaction(LTNG, ERROR, {
            "context": {
                "attributes": attributes,
                "eventSource" : eventSource || ERROR,
                "eventType"   : eventType || ERROR
            }
        });
    }
};