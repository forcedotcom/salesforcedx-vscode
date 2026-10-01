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
/*eslint-disable no-unused-vars*/
 /*
 * TODO: DELETE THIS FILE WHEN WE DEPRECATE JIFFY MARKS
 */
/**
 * The levels for logging performance m
 *
 * @enum {{name: !string, value: !number}}
 * @expose
 * @export
 */
var PerfLogLevel = {
    /** @expose */
    DEBUG : {
        name : "DEBUG",
        value : 1
    },
    /** @expose */
    INTERNAL : {
        name : "INTERNAL",
        value : 2
    },
    /** @expose */
    PRODUCTION : {
        name : "PRODUCTION",
        value : 3
    },
    /** @expose */
    DISABLED : {
        name : "DISABLED",
        value : 4
    }
};

/**
 * Various Perf constants.
 *
 * @enum {!string}
 * @expose
 * @export
 */
var PerfConstants = {
    /** @expose */
    PAGE_START_MARK : "PageStart",
    /** @expose */
    PERF_PAYLOAD_PARAM : "bulkPerf",
    /** @expose */
    MARK_NAME : "mark",
    /** @expose */
    MEASURE_NAME : "measure",
    /** @expose */
    MARK_START_TIME : "st",
    /** @expose */
    MARK_LAST_TIME : "lt",
    /** @expose */
    PAGE_NAME : "pn",
    /** @expose */
    ELAPSED_TIME : "et",
    /** @expose */
    REFERENCE_TIME : "rt",
    /** @expose */
    Perf_LOAD_DONE : "loadDone"
};

/**
 * @enum {!string}
 * @expose
 */
PerfConstants.STATS = {
    /** @expose */
    NAME : "stat",
    /** @expose */
    SERVER_ELAPSED : "internal_serverelapsed",
    /** @expose */
    DB_TOTAL_TIME : "internal_serverdbtotaltime",
    /** @expose */
    DB_CALLS : "internal_serverdbcalls",
    /** @expose */
    DB_FETCHES : "internal_serverdbfetches"
};

/**
 * @public
 * @namespace
 * @const
 */
var PerfShim = {
    /**
     * @type {!window.typePerfLogLevel}
     * @expose
     * @const
     */
    currentLogLevel: PerfLogLevel.DISABLED,

    /**
     * @param {!string} id The id used to identify the mark.
     * @param {string|window.typePerfLogLevel=} logLevel The level at which this mark should
     * be logged at.
     * @return {!PerfShim}
     * @expose
     */
    mark: function (id, logLevel) { return this; },

    /**
     * @param {!string} id This is the id associated with the mark that uses
     * the same id.
     * @param {string|window.typePerfLogLevel=} logLevel The level at which this mark should
     * be logged at.
     * @return {!PerfShim}
     * @expose
     */
    endMark: function (id, logLevel) { return this; },

    /**
     * This method is used to the update the name of a mark
     *
     * @param {!string} oldName The id used to identify the old mark name.
     * @param {!string} newName The id used to identify the new mark name.
     * @return {!PerfShim} for chaining methods
     * @expose
     */
    updateMarkName: function (oldName, newName) { return this; },

    /**
     * Serializes a measure object to JSON.
     *
     * @param {!window.typejsonMeasure} measure The measure to serialize.
     * @return {!string} JSON-serialized version of the supplied measure.
     * @expose
     */
    measureToJson: function (measure) { return ""; },

    /**
     * Serializes timers to JSON.
     *
     * @param {boolean=} includeMarks
     * @return {!string} JSON-serialized version of supplied marks.
     * @expose
     */
    toJson: function (includeMarks) { return ""; },

    /**
     * @param {!string} timer_name The name of the timer to set.
     * @param {number=} timer_delta The time delta to set.
     * @param {string|window.typePerfLogLevel=} logLevel The level at which this mark should be logged at. Defaults to PerfLogLevel.INTERNAL if left blank
     * @return {!PerfShim}
     * @expose
     */
    setTimer: function (timer_name, timer_delta, logLevel) { return this; },

    /**
     * Get a JSON-serialized version of all existing timers and stats in POST friendly format.
     *
     * @return {!string} POST-friendly timers and stats.
     * @expose
     */
    toPostVar: function () { return ""; },

    /**
     * Returns all of the measures that have been captured
     *
     * @return {!Array.<window.typejsonMeasure>} all existing measures.
     * @expose
     */
    getMeasures: function () { return []; },

    /**
     * Returns the beaconData to piggyback on the next XHR call
     *
     * @return {?string} beacon data.
     * @expose
     */
    getBeaconData: function () { return null; },

    /**
     * Sets the beaconData to piggyback on the next XHR call
     *
     * @param {!string} beaconData
     * @expose
     */
    setBeaconData: function (beaconData) {},

    /**
     * Clears beacon data
     *
     * @expose
     */
    clearBeaconData: function () {},

    /**
     * Removes the existing timers
     *
     * @expose
     */
    removeStats: function () {},

    /**
     * Add a performance measurement from the server.
     *
     * @param {!string} label
     * @param {!number} elapsedMillis
     * @return {!PerfShim}
     * @expose
     */
    stat: function (label, elapsedMillis) { return this; },

    /**
     * Get the stored server side performance measures.
     *
     * @param {!string} label
     * @return {!string|number}
     * @expose
     */
    getStat: function (label) { return -1; },

    /**
     * Called when the page is ready to interact with. To support the existing Kylie.onLoad method.
     *
     * @expose
     */
    onLoad: function () {},

    /**
     * This method is used to mark the start of a transaction
     *
     * @param {!string} tName The id used to identify the transaction.
     * @return {!PerfShim} for chaining methods
     * @expose
     */
    startTransaction: function (tName) { return this; },

    /**
     * This method is used to mark the end of a transaction
     *
     * @param {!string} tName The id used to identify the transaction.
     * @return {!PerfShim} for chaining methods
     * @expose
     */
    endTransaction: function (tName) { return this; },

    /**
     * This method is used to the update the name of the
     * transaction
     *
     * @param {!string} oldName The id used to identify the old transaction name.
     * @param {!string} newName The id used to identify the new transaction name.
     * @return {!PerfShim} for chaining methods
     * @expose
     */
    updateTransaction: function (oldName, newName) { return this; },

    /**
     * This method is used to figure if onLoad/page_ready has been fired or
     * not
     *
     * @return {!boolean}
     * @expose
     */
    isOnLoadFired: function () { return false; },

    /**
     * @namespace
     * @const
     * @expose
     */
    util: ({
        /**
         * Sets the roundtrip time cookie
         *
         * @param {!string=} name
         * @param {!string|number=} value
         * @param {Date=} expires
         * @param {string=} path
         * @expose
         */
        setCookie: function (name, value, expires, path) {}
    }),

    /**
     * Whether the full Kylie framework is loaded, as opposed to just the stubs.
     *
     * @type {boolean}
     * @const
     */
    enabled: false
};
