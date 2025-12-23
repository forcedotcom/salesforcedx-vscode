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
 * Locale class for AuraLocalizationService.
 * This class for creating localized date for a locale.
 *
 * @param {string} formatString - A string containing tokens to format a date and time.
 * @param {string} localeName - A locale which is supported by Intl.DateTimeFormat.
 *
 * @constructor
 */
Aura.Utils.Locale = function(localeName) {
    this.intlLocale = $A.localizationService.normalizeToIntlLocale(localeName);

    // style: names
    this.monthNames = {};
    this.weekdayNames = {};
    this.meridiemNames = undefined;

    // Parsing is case insensitive, so names for parsing is in lower case.
    this.monthNamesParse = {};
    this.weekdayNamesParse = {};
    this.meridiemNamesParse = undefined;

    this.numberFormats = {};
};

Aura.Utils.Locale.prototype.getName = function() {
    return this.intlLocale;
};

Aura.Utils.Locale.prototype.getMonths = function(style) {
    if (this.monthNames[style] === undefined) {
        this.createMonthNames(style);
    }
    return this.monthNames[style];
};

/**
 * Get localized month string in the given style, i.e. Jan, Feb
 *
 * @param {number} month An integer number, between 0 and 11, 0 corresponds to January, 1 to February.
 * @param {string} style Possible values: long, short.
 */
Aura.Utils.Locale.prototype.getMonth = function(month, style) {
    var months = this.getMonths(style);
    return months[month];
};

/**
 * Get month number for the given localized month string.
 *
 * @param {string} monthString A localized month string, i.e. January, February...
 * @param {string} style Possible values: long, short.
 * @returns {number} A zero-based month number, -1 if the string is not valid.
 */
Aura.Utils.Locale.prototype.parseMonth = function(monthString, style) {
    // using long style by default
    if (!style) {
        style = "long";
    }

    if (this.monthNamesParse[style] === undefined) {
        this.createMonthNames(style);
    }
    return this.monthNamesParse[style].indexOf(monthString.toLowerCase());
};

Aura.Utils.Locale.prototype.getShortMonthPattern = function() {
    if (this.shortMonthPattern === undefined) {
        var months = this.getMonths("short");
        this.shortMonthPattern = new RegExp("^(" + months.join("|") + ")", "i");
    }
    return this.shortMonthPattern;
};

Aura.Utils.Locale.prototype.getLongMonthPattern = function() {
    if (this.longMonthPattern === undefined) {
        var months = this.getMonths("long");
        this.longMonthPattern = new RegExp("^(" + months.join("|") + ")", "i");
    }
    return this.longMonthPattern;
};

/**
 * Generate localized month names.
 * This method does not return, but hydating the instance.
 *
 * @param {string} style The style of month name. Possible values are "short", "long".
 * @private
 */
Aura.Utils.Locale.prototype.createMonthNames = function(style) {
    var monthFormat = new Intl["DateTimeFormat"](this.intlLocale, {
        "month": style
    });

    var date = new Date(2014, 0, 1);
    var monthNames = [];
    var monthNamesParse = [];
    for (var i = 0; i < 12; i++) {
        date.setMonth(i);
        var month = $A.localizationService.format(monthFormat, date);
        if (!month) {
            continue;
        }
        monthNames.push(month);
        monthNamesParse.push(month.toLowerCase());
    }

    this.monthNames[style] = monthNames;
    this.monthNamesParse[style] = monthNamesParse;
};

/**
 * Check if the given meridiem string means PM for the locale.
 *
 * @param {string} meridiemString
 * @returns {boolean}
 */
Aura.Utils.Locale.prototype.isPM = function(meridiemString) {
    if (this.meridiemNamesParse === undefined) {
        this.createMeridiemNames();
    }

    // case insensitive
    return this.meridiemNamesParse[1] === meridiemString.toLowerCase();
};

/**
 *
 * @param {number} hour A number between 0 and 23. 0-11 means AM, 12-23 means PM.
 */
Aura.Utils.Locale.prototype.getMeridiem = function(hour) {
    var meridiems = this.getMeridiems();
    return (hour < 12)? meridiems[0] : meridiems[1];
};


Aura.Utils.Locale.prototype.getMeridiems = function() {
    if (this.meridiemNames === undefined) {
        this.createMeridiemNames();
    }
    return this.meridiemNames;
};

Aura.Utils.Locale.prototype.getMeridiemPattern = function() {
    if (this.meridiemPattern === undefined) {
        var meridiems = this.getMeridiems();
        this.meridiemPattern = new RegExp("^(" + meridiems.join("|") + ")", "i");
    }
    return this.meridiemPattern;
};

/**
 * Generate localized meridiem names.
 * This method does not return, but hydating the instance.
 *
 * @param {string} style The style of month name. Possible values are "short", "long".
 * @private
 */
Aura.Utils.Locale.prototype.createMeridiemNames = function() {
    var meridiemFormat = new Intl["DateTimeFormat"](this.intlLocale, {
        "hour12": true,
        "hour": "2-digit",
        "minute": "2-digit"
    });

    var amDate = new Date(2012, 11, 20, 11, 11);
    var pmDate = new Date(2012, 11, 20, 23, 11);

    var am, pm;
    if ($A.localizationService.canFormatToParts() === true) {
        am = $A.localizationService.getLocalizedDateTimeField(amDate, meridiemFormat, "dayperiod");
        pm = $A.localizationService.getLocalizedDateTimeField(pmDate, meridiemFormat, "dayperiod");
    } else {
        // If the browser does not support DateTimeFormat.formatToParts, relying on the pattern to parse.
        // IE11 doesn't provide default value for dayperiod for the locales which don't use 12-hour clock.
        var timeString = $A.localizationService.format(meridiemFormat, amDate);
        am = (timeString && timeString.replace(".", "").replace(/ ?.{2}:.{2} ?/, "")) || "AM";
        timeString = $A.localizationService.format(meridiemFormat, pmDate);
        pm = (timeString && timeString.replace(".", "").replace(/ ?.{2}:.{2} ?/, "")) || "PM";
    }

    this.meridiemNames = [am, pm];
    this.meridiemNamesParse = [am.toLowerCase(), pm.toLowerCase()];
};

/**
 * Get localized weekday string.
 *
 * @param {number} weekday The day of week, where 0 represents Sunday.
 * @param {string} style Possible values: "narrow", "short", "long".
 */
Aura.Utils.Locale.prototype.getWeekday = function(weekday, style) {
    var weekdays = this.getWeekdays(style);
    return weekdays[weekday];
};

Aura.Utils.Locale.prototype.getWeekdays = function(style) {
    if (this.weekdayNames[style] === undefined) {
        this.createWeekdayNames(style);
    }
    return this.weekdayNames[style];
};

Aura.Utils.Locale.prototype.parseWeekday = function(weekdayString, style) {
    if (!style) {
        style = "long";
    }

    if (this.weekdayNamesParse[style] === undefined) {
        this.createWeekdayNames(style);
    }
    // case insensitive
    return this.weekdayNamesParse[style].indexOf(weekdayString.toLowerCase());
};

Aura.Utils.Locale.prototype.getNarrowWeekdayPattern = function() {
    if (this.narrowWeekdayPattern === undefined) {
        var weekdays = this.getWeekdays("narrow");
        this.narrowWeekdayPattern = new RegExp("^(" + weekdays.join("|") + ")", "i");
    }
    return this.narrowWeekdayPattern;
};

Aura.Utils.Locale.prototype.getShortWeekdayPattern = function() {
    if (this.shortWeekdayPattern === undefined) {
        var weekdays = this.getWeekdays("short");
        this.shortWeekdayPattern = new RegExp("^(" + weekdays.join("|") + ")", "i");
    }
    return this.shortWeekdayPattern;
};

Aura.Utils.Locale.prototype.getLongWeekdayPattern = function() {
    if (this.longWeekdayPattern === undefined) {
        var weekdays = this.getWeekdays("long");
        this.longWeekdayPattern = new RegExp("^(" + weekdays.join("|") + ")", "i");
    }
    return this.longWeekdayPattern;
};

/**
 * Generate localized weekday names for formatting and parsing.
 * This method does not return, but hydating the instance.
 *
 * @param {String} style The style of month name. Possible values are "short", "long", "narrow".
 * @private
 */
Aura.Utils.Locale.prototype.createWeekdayNames = function(style) {
    var weekdayFormat = new Intl["DateTimeFormat"](this.intlLocale, {
        "weekday": style
    });

    // April 2018
    var date = new Date(2018, 3, 1);
    // Sunday - Saturday : 0 - 6
    var weekdayNames = [];
    var weekdayNamesParse = [];
    for (var i = 1; i < 8; i++) {
        date.setDate(i);
        var weekday = $A.localizationService.format(weekdayFormat, date);
        if (!weekday) {
            continue;
        }
        weekdayNames.push(weekday);
        weekdayNamesParse.push(weekday.toLowerCase());
    }

    this.weekdayNames[style] = weekdayNames;
    this.weekdayNamesParse[style] = weekdayNamesParse;
};

Aura.Utils.Locale.prototype.formatNumber = function(num, minIntegerDigits, maxFractionDigits) {
    var key = minIntegerDigits + ":" + maxFractionDigits;
    var numberFormat = this.numberFormats[key];
    if (numberFormat === undefined) {
        numberFormat = new Intl["NumberFormat"](this.intlLocale, {
            "useGrouping": false,
            "minimumIntegerDigits": minIntegerDigits,
            "maximumFractionDigits": maxFractionDigits
        });
        this.numberFormats[key] = numberFormat;
    }

    return numberFormat["format"](num);
};

