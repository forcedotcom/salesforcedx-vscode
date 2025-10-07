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
 * @description The Aura Localization Service, accessible using <code>$A.localizationService</code>. Provides utility methods
 * for localizing data or getting formatters for numbers, currencies, dates, etc.
 * @constructor
 * @export
 * @platform
 */
function AuraLocalizationService() {
    /** @type {?NumberFormat} */
    this.numberFormat = undefined;
    /** @type {?NumberFormat} */
    this.percentFormat = undefined;
    /** @type {?NumberFormat} */
    this.currencyFormat = undefined;
    // moment.js must be loaded before we can use date/time related APIs

    /** @const {!string} */
    this.ZERO = "0";

    /**
     * @const
     * @enum {!string}
     */
    this.momentLanguages = {
        "iw": "he", // Hebrew
        "in": "id", // Indonesian
        "no": "nb"  // Norwegian
    };
    /** @dict */
    this.momentLocaleCache = {};

    // needs to hardcode some locales which are not identified by browers
    /** @dict */
    this.intlLocaleCache = {
        "no_NO": "nb",
        "tl_PH": "fil",
        "sh_BA": "hr",
        "sh_ME": "hr",
        "sh_CS": "hr"
    };

    /** @dict */
    this.timeZoneFormatCache = {};

    /** @dict */
    this.dateTimeFormatCache = {};
    /** @dict */
    this.localeCache = {};

    /**
     * @const
     */
    this.cache = {
        /** @dict */
        format : {},
        /** @dict */
        strictModeFormat : {}
    };

    /** @dict */
    this.dateTimeUnitAlias = {};

    // common time zones which are not supported by Intl API
    /**
     * @const
     * @enum {!string}
     */
    this.timeZoneMap = {
        "US/Alaska": "America/Anchorage",
        "US/Aleutian": "America/Adak",
        "US/Arizona": "America/Phoenix",
        "US/Central": "America/Chicago",
        "US/East-Indiana": "America/Fort_Wayne",
        "US/Eastern": "America/New_York",
        "US/Hawaii": "Pacific/Honolulu",
        "US/Indiana-Starke": "America/Indiana/Knox",
        "US/Michigan": "America/Detroit",
        "US/Mountain": "America/Denver",
        "US/Pacific": "America/Los_Angeles",
        "US/Samoa": "Pacific/Pago_Pago",
        "Pacific-New": "America/Los_Angeles"
    };

    // [dateString, delimiter, timeString, offsetString]
    /** @const {!RegExp} */
    this.ISO_REGEX = /^\s*((?:\d{4})-(?:\d\d-\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:\.\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    /** @const {!RegExp} */
    this.ISO_REGEX_NO_DASH = /^\s*((?:\d{4})(?:\d\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:\.\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    // hh:mm, hh:mm:ss, hh:mm:ss.SSS, hh:mmZ, hh:mm:ssZ, hh:mm:ss.SSSZ
    /** @const {!RegExp} */
    this.ISO_TIME_REGEX = /^\s*(\d\d:\d\d(?::\d\d(?:\.\d+)?)?)((?:[\+\-]\d\d(?::?\d\d)?)|(?:\s*Z))?$/;
    /** @const {!RegExp} */
    this.ISO_OFFSET_PATTERN = /(Z)|([+-]\d\d):?(\d\d)/;

    // The order matters
    /** @const {!Array<!RegExp>} */
    this.ISO_DATE_PATTERNS = [
        /(\d{4})-(\d\d)-(\d\d)/,
        /(\d{4})-(\d\d)/,
        /(\d{4})(\d\d)(\d\d)/,
        /(\d{4})/
    ];
    /** @const {!Array<!RegExp>} */
    this.ISO_TIME_PATTERNS = [
        /(\d\d):(\d\d):(\d\d)\.(\d+)/,
        /(\d\d):(\d\d):(\d\d)/,
        /(\d\d):(\d\d)/,
        /(\d\d)(\d\d)(\d\d)\.(\d+)/,
        /(\d\d)(\d\d)(\d\d)/,
        /(\d\d)(\d\d)/,
        /(\d\d)/
    ];
    /** @const {!RegExp} */
    this.UNSIGNED_NUMBER  = /\d+/;  // 0 - infinte
    /** @const {!RegExp} */
    this.DIGIT1 = /\d/; // 0 - 9
    /** @const {!RegExp} */
    this.DIGIT2 = /\d\d/; // 00 - 99
    /** @const {!RegExp} */
    this.DIGIT3 = /\d{3}/; // 000 - 999
    /** @const {!RegExp} */
    this.DIGIT4 = /\d{4}/; // 0000 - 9999
    /** @const {!RegExp} */
    this.DIGIT1_2 = /\d{1,2}/; // 0 - 99
    /** @const {!RegExp} */
    this.DIGIT1_3 = /\d{1,3}/; // 0 - 999
    /** @const {!RegExp} */
    this.DIGIT1_4 = /\d{1,4}/; // 0 - 9999

    /** @const {!RegExp} */
    this.HOUR_MIN = /(\d{1,2})(\d\d)/; // hmm
    /** @const {!RegExp} */
    this.HOUR_MIN_SEC = /(\d{1,2})(\d\d)(\d\d)/; // hmmss
    
    /**
     * @const {!Object}
     * @private
     */
    this.enUsDateTimePatterns = {
        // month/day/year, hour:minute
        /** @struct */
        primaryPattern: {
            /** @const {!RegExp} */
            REG_EXP: /(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2}):(\d{1,2})/,
            /** @const {!number} */
            MONTH: 1,
            /** @const {!number} */
            DAY: 2,
            /** @const {!number} */
            YEAR: 3,
            /** @const {!number} */
            HOUR: 4,
            /** @const {!number} */
            MINUTE: 5
        },
        // year-month-day, hour:minute
        /** @struct */
        secondaryPattern: {
            /** @const {!RegExp} */
            REG_EXP: /(\d{4})-(\d{1,2})-(\d{1,2})\D+(\d{1,2}):(\d{1,2})/,
            /** @const {!number} */
            MONTH: 2,
            /** @const {!number} */
            DAY: 3,
            /** @const {!number} */
            YEAR: 1,
            /** @const {!number} */
            HOUR: 4,
            /** @const {!number} */
            MINUTE: 5
        },
        /**
         * Used to swap the primaryPattern and secondaryPattern. When
         * executing the primary pattern expression and it fails to find
         * a match, we need to switch over to the secondary pattern
         * expression and see if that will find a match. If the
         * secondary pattern expression finds a match we need to make it
         * the primary so we don't have to run 2 regular expressions
         * every time.
         *
         * @private
         */
        swap: function () {
            var tmp = this.primaryPattern;
            this.primaryPattern = this.secondaryPattern;
            this.secondaryPattern = tmp;
        }
    };
}

/**
 * Formats a number with the default number format.
 * @param {number} number - The number to be formatted.
 * @return {number} The formatted number
 * @memberOf AuraLocalizationService
 * @example
 * var num = 10000;
 * // Returns 10,000
 * var formatted = $A.localizationService.formatNumber(num);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.formatNumber = function(number) {
    return this.getDefaultNumberFormat().format(number);
};

/**
 * Returns a formatted percentage number based on the default percentage format.
 * @param {number} number - The number to be formatted.
 * @return {number} The formatted percentage
 * @memberOf AuraLocalizationService
 * @example
 * var num = 0.54;
 * // Returns 54%
 * var formatted = $A.localizationService.formatPercent(num);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.formatPercent = function(number) {
    return this.getDefaultPercentFormat().format(number);
};

/**
 * Returns a currency number based on the default currency format.
 * @param {number} number - The currency number to be formatted.
 * @return {number} The formatted currency
 * @memberOf AuraLocalizationService
 * @example
 * var curr = 123.45;
 * // Returns $123.45
 * $A.localizationService.formatCurrency(curr);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.formatCurrency = function(number) {
    return this.getDefaultCurrencyFormat().format(number);
};


/**
 * Returns a NumberFormat object.
 * @param {string} format - The number format. <code>format=".00"</code> displays the number followed by two decimal places.
 * @param {string} symbols
 * @return {number} The number format
 * @memberOf AuraLocalizationService
 * @example
 * var f = $A.get("$Locale.numberFormat");
 * var num = 10000
 * var nf = $A.localizationService.getNumberFormat(f);
 * var formatted = nf.format(num);
 * // Returns 10,000
 * var formatted = $A.localizationService.formatNumber(num);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getNumberFormat = function(format, symbols) {
    return new Aura.Utils.NumberFormat(format, symbols);
};

/**
 * Returns the default NumberFormat object.
 * @return {number} The number format returned by <code>$Locale.numberFormat</code>.
 * @memberOf AuraLocalizationService
 * @example
 * // Returns 20,000.123
 * $A.localizationService.getDefaultNumberFormat().format(20000.123);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getDefaultNumberFormat = function() {
    if (!this.numberFormat) {
        this.numberFormat = new Aura.Utils.NumberFormat($A.get("$Locale.numberFormat"));
    }
    return this.numberFormat;
};


/**
 * Returns the default percentage format.
 * @return {number} The percentage format returned by <code>$Locale.percentFormat</code>.
 * @memberOf AuraLocalizationService
 * @example
 * // Returns 20%
 * $A.localizationService.getDefaultPercentFormat().format(0.20);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getDefaultPercentFormat = function() {
    if (!this.percentFormat) {
        this.percentFormat = new Aura.Utils.NumberFormat($A.get("$Locale.percentFormat"));
    }
    return this.percentFormat;
};

/**
 * Returns the default currency format.
 * @return {number} The currency format returned by <code>$Locale.currencyFormat</code>.
 * @memberOf AuraLocalizationService
 * @example
 * // Returns $20,000.00
 * $A.localizationService.getDefaultCurrencyFormat().format(20000);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getDefaultCurrencyFormat = function() {
    if (!this.currencyFormat) {
        this.currencyFormat = new Aura.Utils.NumberFormat($A.get("$Locale.currencyFormat"));
    }
    return this.currencyFormat;
};

/**
 * Displays a length of time.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @param {boolean} withSuffix - If true, returns value with the suffix
 * @return {string} a String of a length of time
 * @memberOf AuraLocalizationService
 * @public
 * @example
 * var dur = $A.localizationService.duration(1, 'day');
 * // Returns "a day"
 * var length = $A.localizationService.displayDuration(dur);
 * @export
 * @platform
 */
AuraLocalizationService.prototype.displayDuration = function(duration, withSuffix) {
    if (!this.isValidDuration(duration)) {
        return "Invalid Duration";
    }

    return duration.displayDuration(withSuffix);
};

/**
 * Displays a length of time in days.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The length of time in days.
 * @memberOf AuraLocalizationService
 * @public
 * @example
 * var dur = $A.localizationService.duration(24, 'hour');
 * // Returns 1
 * var length = $A.localizationService.displayDurationInDays(dur);
 * @export
 * @platform
 */
AuraLocalizationService.prototype.displayDurationInDays = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.asUnit("day") || 0;
};

/**
 * Displays a length of time in hours.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The length of time in hours.
 * @memberOf AuraLocalizationService
 * @example
 * var dur = $A.localizationService.duration(2, 'day');
 * // Returns 48
 * var length = $A.localizationService.displayDurationInHours(dur);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.displayDurationInHours = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.asUnit("hour") || 0;
};

/**
 * Displays a length of time in milliseconds.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The length of time in milliseconds.
 * @memberOf AuraLocalizationService
 * @example
 * var dur = $A.localizationService.duration(1, 'hour');
 * // Returns 3600000
 * var length = $A.localizationService.displayDurationInMilliseconds(dur);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.displayDurationInMilliseconds = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.asUnit("millisecond") || 0;
};

/**
 * Displays a length of time in minutes.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The length of time in minutes.
 * @memberOf AuraLocalizationService
 * @example
 * var dur = $A.localizationService.duration(1, 'hour');
 * // Returns 60
 * var length = $A.localizationService.displayDurationInMinutes(dur);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.displayDurationInMinutes = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.asUnit("minute") || 0;
};

/**
 * Displays a length of time in months.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The length of time in months.
 * @memberOf AuraLocalizationService
 * @example
 * var dur = $A.localizationService.duration(60, 'day');
 * // Returns 1.971293
 * var length = $A.localizationService.displayDurationInMonths(dur);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.displayDurationInMonths = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.asUnit("month") || 0;
};

/**
 * Displays a length of time in seconds.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The length of time in seconds.
 * @memberOf AuraLocalizationService
 * @example
 * var dur = $A.localizationService.duration(60, 'minutes');
 * // Returns 3600
 * var length = $A.localizationService.displayDurationInSeconds(dur);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.displayDurationInSeconds = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.asUnit("second") || 0;
};

/**
 * Displays a length of time in years.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The length of time in years.
 * @memberOf AuraLocalizationService
 * example
 * var dur = $A.localizationService.duration(6, 'month');
 * // Returns 0.5
 * var length = $A.localizationService.displayDurationInYears(dur);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.displayDurationInYears = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.asUnit("year") || 0;
};

/**
 * Creates an object representing a length of time.
 * @param {number} num - The length of time in a given unit
 * @param {string} unit - A datetime unit. The default is milliseconds. Options: years, months, weeks, days, hours, minutes, seconds, milliseconds
 * @return {Object} A duration object
 * @memberOf AuraLocalizationService
 * @example
 * var dur = $A.localizationService.duration(1, 'day');
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.duration = function(num, unit) {
    return new Aura.Utils.Duration(num, unit, this.moment);
};

/**
 * Formats a date.
 * @param {string|number|Date} date - A datetime string in ISO8601 format (if no timezone then browser timezone offset assumed), or a timestamp in milliseconds, or a Date object.
 *   If you provide a String value, use ISO 8601 format to avoid parsing warnings.
 * @param {?string=} [formatString] - (optional) A string containing tokens to format the given date. For example, "yyyy-MM-dd" formats 15th January, 2017 as "2017-01-15".
 *   The default format string comes from the $Locale value provider.
 *   For details on available tokens, see https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/js_cb_format_dates.htm.
 * @param {?string=} [locale] - (optional) A locale to format the given date.
 *   The default value is from $Locale.langLocale.
 *   It is strongly recommended to use the locale value from Locale Value Provider ($Locale).
 *   It falls back to the value in $Locale.langLocale if using unavailable locale.
 * @return {string} A formatted and localized date string.
 *
 * @memberOf AuraLocalizationService
 * @example
 * var date = new Date();
 * // Returns date in the format "Oct 9, 2015"
 * $A.localizationService.formatDate(date);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.formatDate = function(date, formatString, locale) {
    if (this.moment["isMoment"](date)) {
        $A.deprecated("$A.localizationService.formatDate: 'date' is required to be an ISO 8601 string, or a number, or a Date object. A moment object for the date parameter is not supported.",
                null, "AuraLocalizationService.formatDate(moment)");

        date = date["toDate"]();
    }

    return this.formatDateTimeInternal(date, (formatString || $A.get("$Locale.dateFormat")), locale);
};

/**
 * Formats a time.
 * @param {string|number|Date} date - A datetime string in ISO8601 format (if no timezone then browser timezone offset assumed), or a timestamp in milliseconds, or a Date object.
 *   If you provide a String value, use ISO 8601 format to avoid parsing warnings.
 * @param {?string=} [formatString] - (optional) A string containing tokens to format the given date.
 *   The default format string comes from the $Locale value provider.
 *   For details on available tokens, see https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/js_cb_format_dates.htm.
 * @param {?string=} [locale] - (optional) A locale to format the given date.
 *   The default value is from $Locale.langLocale.
 *   It is strongly recommended to use the locale value from Locale Value Provider ($Locale).
 *   It falls back to the value in $Locale.langLocale if using unavailable locale.
 * @return {string} A formatted and localized time string.
 *
 * @memberOf AuraLocalizationService
 * @example
 * var date = new Date();
 * // Returns a date in the format "9:00:00 AM"
 * var now = $A.localizationService.formatTime(date);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.formatTime = function(date, formatString, locale) {
    if (this.moment["isMoment"](date)) {
        $A.deprecated("$A.localizationService.formatTime: 'date' is required to be an ISO 8601 string, or a number, or a Date object. A moment object for the date parameter is not supported.",
                null, "AuraLocalizationService.formatTime(moment)");

        date = date["toDate"]();
    }

    return this.formatDateTimeInternal(date, (formatString || $A.get("$Locale.timeFormat")), locale);
};

/**
 * @private
 */
AuraLocalizationService.prototype.formatDateTimeInternal = function(date, formatString, locale) {
    if (typeof date === "string") {
        date = this.parseDateTimeISO8601(date);
    } else {
        date = this.normalizeDateTimeInput(date);
    }

    if (!this.isValidDateObject(date)) {
        return "Invalid Date";
    }

    if (!locale) {
        locale = $A.get("$Locale.langLocale");
    }

    return this.formatDateTimeToString(date, formatString, locale, false);
};

/**
 * Formats a datetime.
 * @param {string|number|Date} date - A datetime string in ISO8601 format (if no timezone then browser timezone offset assumed), or a timestamp in milliseconds, or a Date object.
 *   If you provide a String value, use ISO 8601 format to avoid parsing warnings.
 * @param {?string=} [formatString] - (optional) A string containing tokens to format the given date.
 *   The default format string comes from the $Locale value provider.
 *   For details on available tokens, see https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/js_cb_format_dates.htm.
 * @param {?string=} [locale] - (optional) A locale to format the given date.
 *   The default value is from $Locale.langLocale.
 *   It is strongly recommended to use the locale value from Locale Value Provider ($Locale).
 *   It falls back to the value in $Locale.langLocale if using unavailable locale.
 * @return {string} A formatted and localized date time string.
 *
 * @memberOf AuraLocalizationService
 * @example
 * var date = new Date();
 * // Returns datetime in the format "Oct 9, 2015 9:00:00 AM"
 * $A.localizationService.formatDateTime(date);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.formatDateTime = function(date, formatString, locale) {

    // TODO: verify prod logs. removing if there's no useage.
    if (this.moment["isMoment"](date)) {
        $A.deprecated("$A.localizationService.formatDateTime: 'date' is required to be an ISO 8601 string, or a number, or a Date object. A moment object for the date parameter is not supported.",
                null, "AuraLocalizationService.formatDateTime(moment)");

        date = date["toDate"]();
    }

    return this.formatDateTimeInternal(date, (formatString || $A.get("$Locale.datetimeFormat")), locale);
};

/**
 * Formats a date in UTC.
 * @param {string|number|Date} date - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 *   If you provide a String value, use ISO 8601 format to avoid parsing warnings.
 * @param {?string=} [formatString] - (optional) A string containing tokens to format the given date. For example, "yyyy-MM-dd" formats 15th January, 2017 as "2017-01-15".
 *   The default format string comes from the $Locale value provider.
 *   For details on available tokens, see https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/js_cb_format_dates.htm.
 * @param {?string=} [locale] - (optional) A locale to format the given date.
 *   The default value is from $Locale.langLocale.
 *   It is strongly recommended to use the locale value from Locale Value Provider ($Locale).
 *   It falls back to the value in $Locale.langLocale if using unavailable locale.
 * @return {string} A formatted and localized date string.
 *
 * @memberOf AuraLocalizationService
 * @example
 * var date = new Date();
 * // Returns date in UTC in the format "Oct 9, 2015"
 * $A.localizationService.formatDateUTC(date);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.formatDateUTC = function(date, formatString, locale) {
    if (this.moment["isMoment"](date)) {
        $A.deprecated("$A.localizationService.formatDateUTC: 'date' is required to be an ISO 8601 string, or a number, or a Date object. A moment object for the date parameter is not supported.",
                null, "AuraLocalizationService.formatDateUTC(moment)");

        date = date["toDate"]();
    }

    return this.formatDateTimeUTCInternal(date, (formatString || $A.get("$Locale.dateFormat")), locale);
};

/**
 * Formats a time in UTC.
 * * @param {string|number|Date} date - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 *   If you provide a String value, use ISO 8601 format to avoid parsing warnings.
 * @param {?string=} [formatString] - (optional) A string containing tokens to format the given date.
 *   The default format string comes from the $Locale value provider.
 *   For details on available tokens, see https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/js_cb_format_dates.htm.
 * @param {?string=} [locale] - (optional) A locale to format the given date.
 *   The default value is from $Locale.langLocale.
 *   It is strongly recommended to use the locale value from Locale Value Provider ($Locale).
 *   It falls back to the value in $Locale.langLocale if using unavailable locale.
 * @return {string} A formatted and localized time string.
 *
 * @memberOf AuraLocalizationService
 * @example
 * var date = new Date();
 * // Returns time in UTC in the format "4:00:00 PM"
 * $A.localizationService.formatTimeUTC(date);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.formatTimeUTC = function(date, formatString, locale) {
    if (this.moment["isMoment"](date)) {
        $A.deprecated("$A.localizationService.formatTimeUTC: 'date' is required to be an ISO 8601 string, or a number, or a Date object. A moment object for the date parameter is not supported.",
                null, "AuraLocalizationService.formatTimeUTC(moment)");

        date = date["toDate"]();
    }

    return this.formatDateTimeUTCInternal(date, (formatString || $A.get("$Locale.timeFormat")), locale);
};

/**
 * @private
 */
AuraLocalizationService.prototype.formatDateTimeUTCInternal = function(date, formatString, locale) {
    if (typeof date === "string") {
        var config = this.parseISOStringToConfig(date);
        if (config === null) {
            return "Invalid Date";
        }

        var minute = config["minute"];
        if (config["utcOffset"] !== undefined) {
            minute -= config["utcOffset"];
        }

        // Ideally, we should use Date.UTC() to create the date object and use Intl with UTC timezone setting to format.
        // But Intl does not give offset format as moment, so we need to handle offset string as special case. If using the above logic
        // to format date, we need two configs to format date time and offset.
        date = new Date(config["year"], config["month"] - 1, config["day"], config["hour"], minute, config["second"], config["millisecond"]);

    } else {
        date = this.normalizeDateTimeInput(date);
        // We need to clone the object so we don't change the reference
        date = new Date(date.valueOf());
        date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    }

    if (!this.isValidDateObject(date)) {
        return "Invalid Date";
    }

    if (!locale) {
        locale = $A.get("$Locale.langLocale");
    }

    return this.formatDateTimeToString(date, formatString, locale, true);
};

/**
 * Formats a datetime in UTC.
  * @param {string|number|Date} date - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 *   If you provide a String value, use ISO 8601 format to avoid parsing warnings.
 * @param {?string=} [formatString] - (optional) A string containing tokens to format the given date.
 *   The default format string comes from the $Locale value provider.
 *   For details on available tokens, see https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/js_cb_format_dates.htm.
 * @param {?string=} [locale] - (optional) A locale to format the given date.
 *   The default value is from $Locale.langLocale.
 *   It is strongly recommended to use the locale value from Locale Value Provider ($Locale).
 *   It falls back to the value in $Locale.langLocale if using unavailable locale.
 * @return {string} A formatted and localized date time string.
 *
 * @example
 * var date = new Date();
 * // Returns datetime in UTC in the format "Oct 9, 2015 4:00:00 PM"
 * $A.localizationService.formatDateTimeUTC(date);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.formatDateTimeUTC = function(date, formatString, locale) {
    if (this.moment["isMoment"](date)) {
        $A.deprecated("$A.localizationService.formatDateTimeUTC: 'date' is required to be an ISO 8601 string, or a number, or a Date object. A moment object for the date parameter is not supported.",
                null, "AuraLocalizationService.formatDateTimeUTC(moment)");

        date = date["toDate"]();
    }

    return this.formatDateTimeUTCInternal(date, formatString || $A.get("$Locale.datetimeFormat"), locale);
};

/**
 * Gets the number of days in a duration.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The number of days in duration.
 * @memberOf AuraLocalizationService
 * @example
 * var dur = $A.localizationService.duration(48, 'hour');
 * // Returns 2, the number of days for the given duration
 * $A.localizationService.getDaysInDuration(dur);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getDaysInDuration = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.getUnit("day") || 0;
};

/**
 * Gets the number of hours in a duration.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The number of hours in duration.
 * @memberOf AuraLocalizationService
 * @example
 * var dur = $A.localizationService.duration(60, 'minute');
 * // Returns 1, the number of hours in the given duration
 * $A.localizationService.getHoursInDuration(dur);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getHoursInDuration = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.getUnit("hour") || 0;
};

/**
 * Gets the number of milliseconds in a duration.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The number of milliseconds in duration.
 * @memberOf AuraLocalizationService
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getMillisecondsInDuration = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.getUnit("millisecond") || 0;
};

/**
 * Gets the number of minutes in a duration.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The number of minutes in duration.
 * @memberOf AuraLocalizationService
 * @example
 * var dur = $A.localizationService.duration(60, 'second');
 * // Returns 1, the number of minutes in the given duration
 * $A.localizationService.getMinutesInDuration(dur);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getMinutesInDuration = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.getUnit("minute") || 0;
};

/**
 * Gets the number of months in a duration.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The number of months in duration.
 * @memberOf AuraLocalizationService
 * @example
 * var dur = $A.localizationService.duration(70, 'day');
 * // Returns 2, the number of months in the given duration
 * $A.localizationService.getMonthsInDuration(dur);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getMonthsInDuration = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.getUnit("month") || 0;
};

/**
 * Gets the number of seconds in a duration.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The number of seconds in duration.
 * @memberOf AuraLocalizationService
 * @example
 * var dur = $A.localizationService.duration(3000, 'millisecond');
 * // Returns 3
 * $A.localizationService.getSecondsInDuration(dur);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getSecondsInDuration = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.getUnit("second") || 0;
};

/**
 * Gets the number of years in a duration.
 * @param {Duration} duration - The duration object returned by $A.localizationService.duration
 * @return {number} The number of years in duration.
 * @memberOf AuraLocalizationService
 * @example
 * var dur = $A.localizationService.duration(24, 'month');
 * // Returns 2
 * $A.localizationService.getYearsInDuration(dur);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getYearsInDuration = function(duration) {
    if (!this.isValidDuration(duration)) {
        return 0;
    }

    return duration.getUnit("year") || 0;
};

/**
 * Get the date time related labels (month name, weekday name, am/pm etc.).
 * @return {Object} the localized label set.
 * @memberOf AuraLocalizationService
 * @deprecated
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getLocalizedDateTimeLabels = function() {
    $A.deprecated("$A.localizationService.getLocalizedDateTimeLabels(): The labels from this method are no longer supported. This method will be removed in an upcoming release.",
            null, "AuraLocalizationService.getLocalizedDateTimeLabels");

    var langLocale = $A.get("$Locale.langLocale");
    return this.moment["localeData"](this.getAvailableMomentLocale(langLocale));
};

/**
 * Get today's date based on a time zone.
 * @param {string} timezone - A time zone id based on the java.util.TimeZone class, for example, America/Los_Angeles
 * @param {!function(!string)} callback - A function to be called after the "today" value is obtained
 * @memberOf AuraLocalizationService
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getToday = function(timezone, callback) {
    this.getDateStringBasedOnTimezone(timezone, new Date(), callback);
};


/**
 * Get the date's date string based on a time zone.
 * @param {string} timeZone - A time zone id based on the java.util.TimeZone class, for example, America/Los_Angeles
 * @param {!Date} date - A Date object
 * @param {!function(string)} callback - A function to be called after the date string is obtained
 * @memberOf AuraLocalizationService
 * @example
 * var timezone = $A.get("$Locale.timezone");
 * var date = new Date();
 * // Returns the date string in the format "2015-10-9"
 * $A.localizationService.getDateStringBasedOnTimezone(timezone, date, function(today){
 *    console.log(today);
 * });
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.getDateStringBasedOnTimezone = function(timeZone, date, callback) {
    $A.assert(date instanceof Date, "AuraLocalizationService.getDateStringBasedOnTimezone(): 'date' must be a Date object.");
    $A.assert(typeof callback === "function", "AuraLocalizationService.getDateStringBasedOnTimezone(): 'callback' must be a function.");

    if (!this.isValidDateObject(date)) {
        callback("Invalid Date");
        return;
    }

    timeZone = this.normalizeTimeZone(timeZone);

    var dateTimeString = this.formatDateToEnUSString(date, timeZone);
	var match = this.enUsDateTimePatterns.primaryPattern.REG_EXP.exec(dateTimeString);
    if (match === null) {
        match = this.enUsDateTimePatterns.secondaryPattern.REG_EXP.exec(dateTimeString);
        if (match === null) {
            callback(null);
            return;
        }
        this.enUsDateTimePatterns.swap();
    }

    callback(match[this.enUsDateTimePatterns.primaryPattern.YEAR] + "-" + match[this.enUsDateTimePatterns.primaryPattern.MONTH] + "-" + match[this.enUsDateTimePatterns.primaryPattern.DAY]);
};

/**
 * A utility function to check if a datetime pattern string uses a 24-hour or period (12 hour with am/pm) time view.
 * @param {string} pattern - datetime pattern string
 * @return {boolean} Returns true if it uses period time view.
 * @memberOf AuraLocalizationService
 * @public
 * @export
 * @platform
 * @deprecated
 */
AuraLocalizationService.prototype.isPeriodTimeView = function(pattern) {
    $A.deprecated("$A.localizationService.isPeriodTimeView(): The method is no longer supported by framework, and will be removed in an upcoming release.",
            null, "AuraLocalizationService.isPeriodTimeView");

    if (typeof pattern !== "string") {
        return false;
    }
    var shouldEscape = false;
    for (var i = 0; i < pattern.length; i++) {
        var c = pattern.charAt(i);
        if (c === 'h' && shouldEscape === false) {
            return true;
        }
        if (c === '[') {
            shouldEscape = true;
        } else if (c === ']') {
            shouldEscape = false;
        }
    }
    return false;
};

/**
 * Checks if date1 is after date2.
 * @param {string|number|Date} date1 - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 * @param {string|number|Date} date2 - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 * @param {string} unit - A datetime unit. The default is millisecond. Options: year, month, week, day, hour, minute, second, millisecond.
 * @return {boolean} Returns true if date1 is after date2, or false otherwise.
 * @memberOf AuraLocalizationService
 * @example
 * var date = new Date();
 * var day = $A.localizationService.endOf(date, 'day');
 * // Returns false, since date is before day
 * $A.localizationService.isAfter(date, day);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.isAfter = function(date1, date2, unit) {
    var normalizedDate1 = this.normalizeDateTimeInput(date1);
    var normalizedDate2 = this.normalizeDateTimeInput(date2);

    if (!this.isValidDateObject(normalizedDate1) || !this.isValidDateObject(normalizedDate2)) {
        return false;
    }

    unit = this.normalizeDateTimeUnit(unit) || "millisecond";

    if (unit === "millisecond") {
        return normalizedDate1.getTime() > normalizedDate2.getTime();
    } else {
        return this.startOf(normalizedDate1, unit).getTime() > this.startOf(normalizedDate2, unit).getTime();
    }
};

/**
 * Checks if date1 is before date2.
 * @param {string|number|Date} date1 - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 * @param {string|number|Date} date2 - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 * @param {string} unit - A datetime unit. The default is millisecond. Options: year, month, week, day, hour, minute, second, millisecond.
 * @return {boolean} Returns true if date1 is before date2, or false otherwise.
 * @memberOf AuraLocalizationService
 * @example
 * var date = new Date();
 * var day = $A.localizationService.endOf(date, 'day');
 * // Returns true, since date is before day
 * $A.localizationService.isBefore(date, day);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.isBefore = function(date1, date2, unit) {
    var normalizedDate1 = this.normalizeDateTimeInput(date1);
    var normalizedDate2 = this.normalizeDateTimeInput(date2);

    if (!this.isValidDateObject(normalizedDate1) || !this.isValidDateObject(normalizedDate2)) {
        return false;
    }

    unit = this.normalizeDateTimeUnit(unit) || "millisecond";

    if (unit === "millisecond") {
        return normalizedDate1.getTime() < normalizedDate2.getTime();
    } else {
        return this.startOf(normalizedDate1, unit).getTime() < this.startOf(normalizedDate2, unit).getTime();
    }
};

/**
 * Checks if date1 is the same as date2.
 * @param {string|number|Date} date1 - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 * @param {string|number|Date} date2 - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 * @param {string} unit - A datetime unit. The default is millisecond. Options: year, month, week, day, hour, minute, second, millisecond.
 * @return {boolean} Returns true if date1 is the same as date2, or false otherwise.
 * @memberOf AuraLocalizationService
 * @example
 * var date = new Date();
 * var day = $A.localizationService.endOf(date, 'day');
 * // Returns false
 * $A.localizationService.isSame(date, day, 'hour');
 * // Returns true
 * $A.localizationService.isSame(date, day, 'day');
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.isSame = function(date1, date2, unit) {
    var normalizedDate1 = this.normalizeDateTimeInput(date1);
    var normalizedDate2 = this.normalizeDateTimeInput(date2);

    if (!this.isValidDateObject(normalizedDate1) || !this.isValidDateObject(normalizedDate2)) {
        return false;
    }

    unit = this.normalizeDateTimeUnit(unit) || "millisecond";
    if (unit === "millisecond") {
        return normalizedDate1.getTime() === normalizedDate2.getTime();
    } else {
        return this.startOf(normalizedDate1, unit).getTime() === this.startOf(normalizedDate2, unit).getTime();
    }
};

/**
 * Checks if a date is between two other dates (fromDate and toDate), where the match is inclusive.
 * @param {string|number|Date} date - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 * @param {string|number|Date} fromDate - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 * @param {string|number|Date} toDate - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 * @param {string} unit - A datetime unit. The default is millisecond. Options: year, month, week, day, hour, minute, second, millisecond.
 * @return {boolean} Returns true if date is between fromDate and toDate, or false otherwise.
 * @memberOf AuraLocalizationService
 * @example
 * $A.localizationService.isBetween("2017-03-07","March 7, 2017", "12/1/2017")
 * // Returns true
 * $A.localizationService.isBetween("2017-03-07 12:00", "March 7, 2017 15:00", "12/1/2017")
 * // Returns false
 * $A.localizationService.isBetween("2017-03-07 12:00", "March 7, 2017 15:00", "12/1/2017", "day")
 * // Returns true
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.isBetween = function(date, fromDate, toDate, unit) {
    return !this.isBefore(date, fromDate, unit) && !this.isAfter(date, toDate, unit);
};

/**
 * Parses a string to a JavaScript Date.
 * @param {string} dateTimeString - The datetime string to be parsed.
 * @param {string} parseFormat - A Java format string which is used to parse datetime. The default is from LocaleValueProvider.
 * @param {string|boolean=} [locale] - [Deprecated] (optional) Locale value from Locale Value Provider. It falls back to the value in $Locale.langLocale if using unavailable locale. The default value is from $Locale.langLocale.
 * @param {boolean=} [strictParsing] - (optional) Set to true to turn off forgiving parsing and use strict validation.
 * @return {Date} A JavaScript Date object, or null if dateTimeString is invalid
 * @memberOf AuraLocalizationService
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.parseDateTime = function(dateTimeString, parseFormat, locale, strictParsing) {
    if (!dateTimeString) {
        return null;
    }

    var langLocale = locale;
    // recommended signature
    if (typeof locale === 'boolean') {
        strictParsing = locale;
        langLocale = $A.get("$Locale.langLocale");
    } else if (locale !== undefined || strictParsing !== undefined) {
        $A.deprecated("$A.localizationService.parseDateTime(dateTimeString, parseFormat, locale, strictParsing) is deprecated. " +
                "Do NOT rely on the [locale] parameter. It only allows to use the value which is provided " +
                "by Locale Value Provider. It will be removed in an upcoming release.",
                "Use $A.localizationService.parseDateTime(dateTimeString, parseFormat, strictParsing)");

        if (locale && !this.isAvailableLocale(locale)) {
            langLocale = $A.get("$Locale.langLocale");
            $A.warning("AuraLocalizationService.parseDateTime(): Locale '" + locale + "' is not available. " +
                    "Falls back to the locale in $Locale.langLocale: " + langLocale);
        }
    }

    if (!langLocale) {
        langLocale = $A.get("$Locale.langLocale");
    }

    var format = strictParsing ? this.getStrictModeFormat(parseFormat) : this.getNormalizedFormat(parseFormat);
    var value = strictParsing ? this.getStrictModeDateTimeString(dateTimeString) : dateTimeString;
    var mDate = this.moment(value, format, this.getAvailableMomentLocale(langLocale), strictParsing);
    if (!mDate || !mDate["isValid"]()) {
        if ($A.util.isUndefinedOrNull(parseFormat)) {
            return null;
        }
        // TODO: remove moment dependency and enable DateTimeForamt.parse()
        // langLocale will be fallback to default locale if the locale does not have moment data on the client,
        // so we should use the original locale here.
        langLocale = (typeof locale === "string") ? locale : $A.get("$Locale.langLocale");
        var dateTimeFormat = this.createDateTimeFormat(parseFormat, langLocale);
        return dateTimeFormat.parse(dateTimeString, strictParsing);
    }

    return mDate["toDate"]();
};

/**
 * Parses a date time string in an ISO-8601 format.
 * @param {?string} dateTimeString - The datetime string in an ISO-8601 format.
 * @return {?Date} A JavaScript Date object, or null if dateTimeString is invalid.
 * @memberOf AuraLocalizationService
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.parseDateTimeISO8601 = function(dateTimeString) {
    if (!dateTimeString) {
        return null;
    }

    var date = null;
    if (this.isISO8601DateTimeString(dateTimeString)) {
        var config = this.parseISOStringToConfig(dateTimeString);
        if (config === null) {
            return null;
        }

        if (config["utcOffset"] !== undefined) {
            var minute = config["minute"] - config["utcOffset"];
            date = new Date(Date.UTC(config["year"], config["month"] - 1, config["day"], config["hour"], minute, config["second"], config["millisecond"]));
        } else {
            date = new Date(config["year"], config["month"] - 1, config["day"], config["hour"], config["minute"], config["second"], config["millisecond"]);
        }
    } else {
        $A.warning("LocalizationService.parseDateTimeISO8601: The provided datetime string is not in ISO8601 format. " +
                "It will be parsed by native Date(), which may have different results across browsers and versions. " + dateTimeString);

        date = new Date(dateTimeString);
    }

    return this.isValidDateObject(date) ? date : null;
};

/**
 * Parses a string to a JavaScript Date in UTC.
 * @param {string} dateTimeString - The datetime string to be parsed
 * @param {string} parseFormat - A Java format string which is used to parse datetime. The default is from LocaleValueProvider.
 * @param {string|boolean=} [locale] - [Deprecated] (optional) Locale value from Locale Value Provider. It falls back to the value in $Locale.langLocale if using unavailable locale. The default value is from $Locale.langLocale.
 * @param {boolean=} [strictParsing] - (optional) Set to true to turn off forgiving parsing and use strict validation.
 * @return {Date} A JavaScript Date object, or null if dateTimeString is invalid
 * @memberOf AuraLocalizationService
 * @example
 * var date = "2015-10-9";
 * // Returns "Thu Oct 08 2015 17:00:00 GMT-0700 (PDT)"
 * $A.localizationService.parseDateTimeUTC(date);
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.parseDateTimeUTC = function(dateTimeString, parseFormat, locale, strictParsing) {
    if (!dateTimeString) {
        return null;
    }

    var langLocale = locale;
    // recommended signature
    if (typeof locale === "boolean") {
        strictParsing = locale;
        langLocale = $A.get("$Locale.langLocale");
    } else if (locale !== undefined || strictParsing !== undefined) {
        $A.deprecated("$A.localizationService.parseDateTimeUTC(dateTimeString, parseFormat, locale, strictParsing) is deprecated. " +
                "Do NOT rely on the [locale] parameter. It only allows to use the value which is provided " +
                "by Locale Value Provider. It will be removed in an upcoming release.",
                "Use $A.localizationService.parseDateTimeUTC(dateTimeString, parseFormat, strictParsing)");

        if (locale && !this.isAvailableLocale(locale)) {
            langLocale = $A.get("$Locale.langLocale");
            $A.warning("AuraLocalizationService.parseDateTimeUTC(): Locale '" + locale + "' is not available. " +
                    "Falls back to the locale in $Locale.langLocale: " + langLocale);
        }
    }

    if (!langLocale) {
        langLocale = $A.get("$Locale.langLocale");
    }

    var format = strictParsing ? this.getStrictModeFormat(parseFormat) : this.getNormalizedFormat(parseFormat);
    var value = strictParsing ? this.getStrictModeDateTimeString(dateTimeString) : dateTimeString;
    var mDate = this.moment["utc"](value, format, this.getAvailableMomentLocale(langLocale), strictParsing);
    if (!mDate || !mDate["isValid"]()) {
        if ($A.util.isUndefinedOrNull(parseFormat)) {
            return null;
        }
        // TODO: remove moment dependency and enable DateTimeForamt.parse()
        // langLocale will be fallback to default locale if the locale does not have moment data on the client,
        // so we should use the original locale here.
        langLocale = (typeof locale === "string") ? locale : $A.get("$Locale.langLocale");
        var dateTimeFormat = this.createDateTimeFormat(parseFormat, langLocale);
        return dateTimeFormat.parse(dateTimeString, strictParsing, true);
    }

    return mDate["toDate"]();
};

/**
 * Get a date which is the start of a unit of time for the given date.
 * @param {string|number|Date} date - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 * @param {?string} unit - A datetime unit. Options: year, month, week, day, hour, minute or second.
 * @return {Date} A JavaScript Date object. It returns a parsed Date if unit is not provided.
 * @memberOf AuraLocalizationService
 * @example
 * var date = "2015-10-9";
 * // Returns "Thu Oct 01 2015 00:00:00 GMT-0700 (PDT)"
 * $A.localizationService.startOf(date, 'month');
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.startOf = function(date, unit) {
    var normalizedDate = (date instanceof Date)? new Date(date.getTime()) : this.normalizeDateTimeInput(date);
    unit = this.normalizeDateTimeUnit(unit);
    if (!unit || !this.isValidDateObject(normalizedDate)) {
        return normalizedDate;
    }

    switch (unit) {
        case "year":
            normalizedDate.setMonth(0);
            // falls through
        case "month":
            normalizedDate.setDate(1);
            // falls through
        case "week":
        case "day":
            normalizedDate.setHours(0);
            // falls through
        case "hour":
            normalizedDate.setMinutes(0);
            // falls through
        case "minute":
            normalizedDate.setSeconds(0);
            // falls through
        case "second":
            normalizedDate.setMilliseconds(0);
    }

    // for 'week', we adjust days after resetting the time above
    if (unit === "week") {
        // In $Locale, Sun-Sat is 1~7
        var firstDayOfWeek = $A.get("$Locale.firstDayOfWeek") - 1;
        var weekday = (normalizedDate.getDay() + 7 - firstDayOfWeek) % 7;
        var offset = weekday * 864e5; // 24 * 60 * 60 * 1000

        normalizedDate.setTime(normalizedDate.getTime() - offset);
    }

    return normalizedDate;
};

/**
 * Get a date which is the end of a unit of time for the given date.
 * @param {string|number|Date} date - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object.
 * @param {?string} unit - A datetime unit. Options: year, month, week, day, hour, minute or second.
 * @return {Date} A JavaScript Date object. It returns a parsed Date if unit is not provided.
 * @memberOf AuraLocalizationService
 * @example
 * var date = new Date();
 * // Returns the time at the end of the day
 * // in the format "Fri Oct 09 2015 23:59:59 GMT-0700 (PDT)"
 * var day = $A.localizationService.endOf(date, 'day')
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.endOf = function(date, unit) {
    var normalizedDate = this.startOf(date, unit);
    unit = this.normalizeDateTimeUnit(unit);
    if (!unit || !this.isValidDateObject(normalizedDate)) {
        return normalizedDate;
    }

    this.addSubtract(/** @type {!Date} */ (normalizedDate), 1, unit, false);
    this.addSubtract(/** @type {!Date} */ (normalizedDate), 1, "millisecond", true);
    return normalizedDate;
};

/**
 * Get a date time string in simplified extended ISO format.
 * @template T
 * @param {Date|T} date - should be a Date object, but could be anything
 * @return {string|T} An ISO8601 string to represent passed in Date object. If the date is not valid then the date argument will be returned.
 * @memberOf AuraLocalizationService
 * @example
 * var date = new Date();
 * // Returns "2015-10-09T20:47:17.590Z"
 * $A.localizationService.toISOString(date);
 * @deprecated Use Date.toISOString() instead
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.toISOString = function(date) {
    $A.deprecated("$A.localizationService.toISOString(): The method is no longer supported by framework, and will be removed in an upcoming release.",
            "Use native method Date.toISOString() instead", "AuraLocalizationService.toISOString");

    return this.isValidDateObject(date) ? date.toISOString() : date;
};

/**
 * Translate the localized digit string to a string with Arabic digits if there is any.
 * @param {string} input - a string with localized digits.
 * @return {string} a string with Arabic digits.
 * @memberOf AuraLocalizationService
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.translateFromLocalizedDigits = function(input) {
    if (!input) {
        return input;
    }

    var localizedZero = $A.get("$Locale.zero");
    var zeroCharCodeOffset = localizedZero.charCodeAt(0) - this.ZERO.charCodeAt(0);
    if (!zeroCharCodeOffset) {
        return input;
    }

    var charArray = input.split("");
    for (var i = 0; i < charArray.length; i++) {
        var charCode = charArray[i].charCodeAt(0);
        if (charCode <= localizedZero.charCodeAt(0) + 9 && charCode >= localizedZero.charCodeAt(0)) {
            charArray[i] = String.fromCharCode(charCode - zeroCharCodeOffset);
        }
    }
    return charArray.join("");
};

/**
 * Translate the input date from other calendar system (for example, Buddhist calendar) to Gregorian calendar
 * based on the locale.
 * @param {Date} date - a Date Object.
 * @return {Date} an updated Date object.
 * @memberOf AuraLocalizationService
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.translateFromOtherCalendar = function(date) {
    if (!date) {
        return date;
    }
    var userLocaleLang = $A.get("$Locale.userLocaleLang");
    var userLocaleCountry = $A.get("$Locale.userLocaleCountry");
    if (userLocaleLang === 'th' && userLocaleCountry === 'TH') { // Buddhist year
        date.setFullYear(date.getFullYear() - 543);
    }
    return date;
};

/**
 * Translate the input string to a string with localized digits (different from Arabic) if there is any.
 * @param {string} input - a string with Arabic digits.
 * @return {string} a string with localized digits.
 * @memberOf AuraLocalizationService
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.translateToLocalizedDigits = function(input) {
    if (!input) {
        return input;
    }

    var localizedZero = $A.get("$Locale.zero");
    var zeroCharCodeOffset = localizedZero.charCodeAt(0) - this.ZERO.charCodeAt(0);
    if (!zeroCharCodeOffset) {
        return input;
    }

    var charArray = input.split("");
    for (var i = 0; i < charArray.length; i++) {
        var charCode = charArray[i].charCodeAt(0);
        if (charCode <= "9".charCodeAt(0) && charCode >= "0".charCodeAt(0)) {
            charArray[i] = String.fromCharCode(charCode + zeroCharCodeOffset);
        }
    }
    return charArray.join("");
};

/**
 * Translate the input date to a date in other calendar system, for example, Buddhist calendar based on the locale.
 * @param {Date} date - a Date Object.
 * @return {Date} an updated Date object.
 * @memberOf AuraLocalizationService
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.translateToOtherCalendar = function(date) {
    if (!date) {
        return date;
    }
    var userLocaleLang = $A.get("$Locale.userLocaleLang");
    var userLocaleCountry = $A.get("$Locale.userLocaleCountry");
    if (userLocaleLang === 'th' && userLocaleCountry === 'TH') { // Buddhist year
        date.setFullYear(date.getFullYear() + 543);
    }
    return date;
};

/**
 * Converts a datetime from UTC to a specified timezone.
 * @param {!Date} date - A JavaScript Date object
 * @param {string} timezone - A time zone id based on the java.util.TimeZone class, for example, America/Los_Angeles
 * @param {!function(!Date)} callback - A function to be called after the conversion is done
 * @memberOf AuraLocalizationService
 * @example
 * // Provides locale information
 * var format = $A.get("$Locale.timeFormat");
 * format = format.replace(":ss", "");
 * var langLocale = $A.get("$Locale.langLocale");
 * var timezone = $A.get("$Locale.timezone");
 * var date = new Date();
 * $A.localizationService.UTCToWallTime(date, timezone, function(walltime) {
 *    // Returns the local time without the seconds, for example, 9:00 PM
 *    displayValue = $A.localizationService.formatDateTimeUTC(walltime, format, langLocale);
 * })
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.UTCToWallTime = function(date, timezone, callback) {
    $A.assert(date instanceof Date, "AuraLocalizationService.UTCToWallTime(): 'date' must be a Date object.");
    $A.assert(typeof callback === "function", "AuraLocalizationService.UTCToWallTime(): 'callback' must be a function.");

    timezone = this.normalizeTimeZone(timezone);
    if (timezone === "UTC" || !this.isValidDateObject(date)) {
        callback(date);
        return;
    }

    var data = this.createDateTimeData(date, "UTC");

    var convertedData = this.setDataToZone(data, timezone);
    var dateTime = convertedData["config"];

    var ts = Date.UTC(dateTime["year"], dateTime["month"]-1, dateTime["day"], dateTime["hour"], dateTime["minute"]);
    var wallTimeDate = new Date(ts);
    wallTimeDate.setSeconds(date.getSeconds());
    wallTimeDate.setMilliseconds(date.getMilliseconds());

    callback(wallTimeDate);
};

/**
 * Converts a datetime from a specified timezone to UTC.
 * @param {!Date} date - A JavaScript Date object
 * @param {string} timezone - A time zone id based on the java.util.TimeZone class, for example, America/Los_Angeles
 * @param {!function(!Date)} callback - A function to be called after the conversion is done
 * @memberOf AuraLocalizationService
 * @example
 * $A.localizationService.WallTimeToUTC(date, timezone, function(utc) {
 *     displayDate = $A.localizationService.formatDateTime(utc, format, langLocale);
 * })
 * @public
 * @export
 * @platform
 */
AuraLocalizationService.prototype.WallTimeToUTC = function(date, timezone, callback) {
    $A.assert(date instanceof Date, "AuraLocalizationService.WallTimeToUTC(): 'date' must be a Date object.");
    $A.assert(typeof callback === "function", "AuraLocalizationService.WallTimeToUTC(): callback must be a function.");

    timezone = this.normalizeTimeZone(timezone);
    if (timezone === "UTC" || !this.isValidDateObject(date)) {
        callback(date);
        return;
    }

    var data = this.createDateTimeData(date, timezone);

    var convertedData = this.setDataToZone(data, "UTC");
    var dateTime = convertedData["config"];

    var ts = Date.UTC(dateTime["year"], dateTime["month"]-1, dateTime["day"], dateTime["hour"], dateTime["minute"]);
    var utcDate = new Date(ts);
    utcDate.setUTCSeconds(date.getSeconds(), date.getMilliseconds());

    callback(utcDate);
};

/**---------- Private functions ----------*/

/**
 * Initialize localization service.
 * @private
 */
AuraLocalizationService.prototype.init = function() {
    if (Aura["moment"] === undefined) {
        $A.warning("moment is required to initialize Localization Service.");
        return;
    }

    // If locale data didn't get added in inline.js, then adding the locale data.
    if (Aura["loadLocaleData"]) {
        Aura["loadLocaleData"](Aura["moment"]);
        Aura["loadLocaleData"] = undefined;
    }

    // using local reference to prevent Aura depended moment gets overriden
    this.moment = Aura["moment"];

    // TODO: remove this when locales are consolidated.
    // Caching all available locales. This is for backward compatibility. At this moment, there are three locales
    // in Locale Value Provider. Keep them all available for now to avoid breaking consumers.

    // Refer to LocaleValueProvider.java
    var langLocale = $A.get("$Locale.langLocale");
    var userLocale = $A.get("$Locale.userLocaleLang") + "_" + $A.get("$Locale.userLocaleCountry");
    var ltngLocale = $A.get("$Locale.language") + "_" + $A.get("$Locale.userLocaleCountry");

    this.momentLocaleCache[langLocale] = this.normalizeToMomentLocale(langLocale);
    this.momentLocaleCache[userLocale] = this.normalizeToMomentLocale(userLocale);
    this.momentLocaleCache[ltngLocale] = this.normalizeToMomentLocale(ltngLocale);

    // set moment default locale
    this.moment.locale(this.momentLocaleCache[langLocale]);

    this.setupDateTimeUnitAlias();
};

/**
 * @param {?string=} timeZone
 * @return {!string}
 * @private
 */
AuraLocalizationService.prototype.normalizeTimeZone = function(timeZone) {
    var normalizedTimeZone = timeZone;
    if (!timeZone) {
        normalizedTimeZone = $A.get("$Locale.timezone");
    }

    if (normalizedTimeZone === "GMT" || normalizedTimeZone === "UTC") {
        return "UTC";
    }

    if (this.timeZoneMap.hasOwnProperty(normalizedTimeZone)) {
        return this.timeZoneMap[normalizedTimeZone];
    }

    var timeZoneFormat = this.createEnUSDateTimeFormat(normalizedTimeZone);
    if (timeZoneFormat !== null) {
        return normalizedTimeZone;
    }

    // If timeZone is falsy, the time zone at this point is from $Locale
    if (timeZone) {
        normalizedTimeZone = $A.get("$Locale.timezone");
        $A.warning("Unsupported time zone: " + timeZone + ". Fallback to default time zone: " + normalizedTimeZone);

        if (normalizedTimeZone === "GMT" || normalizedTimeZone === "UTC") {
            this.timeZoneMap[timeZone] = "UTC";
            return "UTC";
        }

        timeZoneFormat = this.createEnUSDateTimeFormat(normalizedTimeZone);
        if (timeZoneFormat !== null) {
            this.timeZoneMap[timeZone] = normalizedTimeZone;
            return normalizedTimeZone;
        }
    } else {
        // If timeZone is falsy, we cache the value from $Locale
        timeZone = normalizedTimeZone;
    }

    // If the time zone in label is not supported, then fallback to UTC
    var message = "Unsupported time zone value in GVP: " + normalizedTimeZone;
    $A.warning(message);
    // Sending Gack to server if the time zone in GVP is not supported by browsers
    $A.logger.reportError(new $A.auraError(message), undefined, "WARNING");

    this.timeZoneMap[timeZone] = "UTC";
    return "UTC";
};

/**
 * @param {!Date} date
 * @param {!string} timeZone
 * @returns {!{config: !{year: !number, month: !number, day: !number, hour: !number, minute: !number}, offset: !number, timestamp: !number, timeZone: !string}} datetime data for the given zone
 * @private
 */
AuraLocalizationService.prototype.createDateTimeData = function(date, timeZone) {
    var config = {
        "year": date.getUTCFullYear(),
        "month": date.getUTCMonth() + 1,
        "day": date.getUTCDate(),
        "hour": date.getUTCHours(),
        "minute": date.getUTCMinutes()
        // Currently we only use the config for time zone conversion,
        // second and millisecond are not needed.
    };
    var zoneInfo = this.getZoneInfo(config, timeZone);

    return {
        "config": config,
        "offset": zoneInfo[1],
        "timestamp": zoneInfo[0],
        "timeZone": timeZone
    };
};

/**
 * Convert datatime data created by createDateTimeData() to different time zone.
 *
 * @param {!{config: !{year: !number, month: !number, day: !number, hour: !number, minute: !number}, offset: !number, timestamp: !number, timeZone: !string}} data
 * @param {!string} timeZone
 * @returns {!{config: !{year: !number, month: !number, day: !number, hour: !number, minute: !number}, offset:!number , timestamp: !number, timeZone: !string}} datetime data for the given zone
 * @private
 */
AuraLocalizationService.prototype.setDataToZone = function(data, timeZone) {
    var timestamp = data["timestamp"];
    var offset = this.zoneOffset(timestamp, timeZone);
    timestamp += offset * 6e4; // 60 * 1000

    var date = new Date(timestamp);
    var config = {
        "year": date.getUTCFullYear(),
        "month": date.getUTCMonth() + 1,
        "day": date.getUTCDate(),
        "hour": date.getUTCHours(),
        "minute": date.getUTCMinutes()
        // Currently we only use the config for time zone conversion,
        // so second and millisecond are not needed.
    };

    return {
        "timestamp": timestamp,
        "config": config,
        "timeZone": timeZone,
        "offset": offset
    };
};

/**
 * @param {!{year: !number, month: !number, day: !number, hour: !number, minute: !number}} config
 * @param {!string} timeZone
 * @returns {!Array<!number, !number>} a tuple which contains timestamp and offset
 * @private
 */
AuraLocalizationService.prototype.getZoneInfo = function(config, timeZone) {
    var nowOffset = this.zoneOffset(Date.now(), timeZone);

    var localTs = Date.UTC(config["year"], config["month"]-1, config["day"], config["hour"], config["minute"]);
    // First attempt: the time zone offset during current time.
    var utcGuess = localTs - nowOffset * 6e4; // 60 * 1000
    var guessOffset = this.zoneOffset(utcGuess, timeZone);

    if (nowOffset === guessOffset) {
        return [utcGuess, guessOffset];
    }

    // Second attempt: if the offsets are different, remove the delta from ts.
    utcGuess -= (guessOffset - nowOffset) * 6e4; // 60 * 1000

    var guessOffset2 = this.zoneOffset(utcGuess, timeZone);
    if (guessOffset === guessOffset2) {
        return [utcGuess, guessOffset];
    }

    // Finally: if the offsets are still different, we have to make the decision.
    return [localTs - Math.max(guessOffset, guessOffset2) * 6e4, Math.max(guessOffset, guessOffset2)];
};

/**
 * Get the time zone offset during the given timestamp.
 *
 * @param {!number} timestamp
 * @param {!string} timeZone
 * @returns {!number} offset in minute
 * @private
 */
AuraLocalizationService.prototype.zoneOffset = function(timestamp, timeZone) {
    if (timeZone === "UTC") {
        return 0;
    }

    // clean up second and millisecond from timestamp
    var date = new Date(timestamp);
    date.setSeconds(0, 0);
    var dateTimeString = this.formatDateToEnUSString(date, timeZone);
    var zoneTs = this.parseEnUSDateTimeString(dateTimeString);

    // converts to minutes
    return (zoneTs - date.getTime()) / (6e4); // 60 * 1000
  };

/**
 * Formats a Date object to the en-US date time string.
 *
 * This method assumes the browser supports Intl API with time zone data.
 * @param {!Date} date
 * @param {!string} timeZone
 * @returns {!string}
 * @private
 */
AuraLocalizationService.prototype.formatDateToEnUSString = function(date, timeZone) {

    var timeZoneFormat = this.createEnUSDateTimeFormat(timeZone);
    var dateString = timeZoneFormat ? this.format(timeZoneFormat, date) : null;

    // If something wrong with the native function, using local time as fallback
    return (dateString !== null) ? dateString : this.formatDateTime(date, "MM/dd/yyyy, hh:mm");
};

/**
 * Parse a datetime string in en-US format, "month/day/year, hour:minute", to a timestamp in millisecond in UTC
 *
 * @param {!string} dateTimeString - a datetime string in en-US format, "month/day/year, hour:minute"
 * @returns {?number} timestamp in millisecond
 * @private
 */
AuraLocalizationService.prototype.parseEnUSDateTimeString = function(dateTimeString) {
    var match = this.enUsDateTimePatterns.primaryPattern.REG_EXP.exec(dateTimeString);
    if (match === null) {
        match = this.enUsDateTimePatterns.secondaryPattern.REG_EXP.exec(dateTimeString);
        if (match === null) {
            return null;
        }
        this.enUsDateTimePatterns.swap();
    }

    // month param is between 0 and 11
    return Date.UTC(parseInt(match[this.enUsDateTimePatterns.primaryPattern.YEAR], 10), parseInt(match[this.enUsDateTimePatterns.primaryPattern.MONTH], 10) - 1, parseInt(match[this.enUsDateTimePatterns.primaryPattern.DAY], 10), parseInt(match[this.enUsDateTimePatterns.primaryPattern.HOUR], 10), parseInt(match[this.enUsDateTimePatterns.primaryPattern.MINUTE], 10));
};

/**
 * This function is a wrapper for Intl.DateTimeFormat.format() to make sure the consistency across the
 * browsers.
 * The caller should always validate the values. If it returns null, it means there was something wrong
 * with the native function.
 *
 * @param {!Intl.DateTimeFormat} dateTimeFormat
 * @param {!Date} date
 * @returns {?string}
 * @private
 */
AuraLocalizationService.prototype.format = function(dateTimeFormat, date) {
    if (this.formatErrorFromIntl) {
        return null;
    }

    try {
        // IE11 adds LTR / RTL mark in the formatted date time string
        return dateTimeFormat["format"](date).replace(/[\u200E\u200F]/g, '');
    } catch (e) {
        // The error should never happen here. The callers validate the arguments.
        // This is only for IE11 profiler. Intl API time zone polyfill gets messed up
        // when start profiling on IE11. If the following code gets executed, we assume
        // that Intl does not work correctly.
        $A.warning("Intl API throws an unexpected error.", e);
        this.formatErrorFromIntl = true;
        return null;
    }
};

/**
 * @param {!string} timeZone
 * @returns {?Intl.DateTimeFormat}
 * @private
 */
AuraLocalizationService.prototype.createEnUSDateTimeFormat = function(timeZone) {
    var timeZoneFormat = this.timeZoneFormatCache[timeZone];
    if (timeZoneFormat !== undefined) {
        return timeZoneFormat;
    }

    try {
        // we rely en-US format to parse the datetime string
        timeZoneFormat = Intl["DateTimeFormat"]("en-US", {
            "timeZone": timeZone,
            "hour12": false, // 24-hour time is needed for parsing the datetime string
            "year": "numeric",
            "month": "2-digit",
            "day": "2-digit",
            "hour": "2-digit",
            "minute": "2-digit"
        });
    } catch (e) {
        timeZoneFormat = null;
    }

    // cache the format for the time zone
    this.timeZoneFormatCache[timeZone] = timeZoneFormat;

    return timeZoneFormat;
};

/**
 * @param {!string} formatString
 * @param {!string} localeName
 * @returns {?Intl.DateTimeFormat}
 * @private
 */
AuraLocalizationService.prototype.createDateTimeFormat = function(formatString, localeName) {
    localeName = this.normalizeToIntlLocale(localeName);

    var cacheKey = localeName + ":" + formatString;
    var dateTimeFormat = this.dateTimeFormatCache[cacheKey];
    if (dateTimeFormat === undefined) {
        var locale = this.createLocale(localeName);
        dateTimeFormat = new Aura.Utils.DateTimeFormat(formatString, locale);
        this.dateTimeFormatCache[cacheKey] = dateTimeFormat;
    }
    return dateTimeFormat;
};

/**
 * For now, this method is only used in DateTimeFormat, so we can assume that
 * the localeName is always supported by Intl API. If we need to use it in
 * AuraLocalizationService, needs to normalizeToIntlLocale().
 */
AuraLocalizationService.prototype.createLocale = function(localeName) {
    var locale = this.localeCache[localeName];
    if (locale === undefined) {
        locale = new Aura.Utils.Locale(localeName);
        this.localeCache[localeName] = locale;
    }

    return locale;
};

/**
 * Normalize the specified Java locale string to moment-js compatible locale which
 * has available data on the client. If the given locale doesn't have any available
 * corresponding locale, it falls back to 'en'.
 *
 * @param {?string} locale
 * @returns {?string}
 * @private
 */
AuraLocalizationService.prototype.normalizeToMomentLocale = function(locale) {
    if (!locale) {
        return locale;
    }

    // all locales that have been loaded in moment
    var locales = this.moment["locales"]();
    var momentLocale;

    var normalized = this.normalizeLocale(locale);
    var tokens = normalized.split("-", 2);

    // momentJs uses 'nb' as Norwegian
    if (this.momentLanguages[tokens[0]]) {
        tokens[0] = this.momentLanguages[tokens[0]];
    }

    if (tokens.length > 1) {
        momentLocale = tokens.join("-");
        if (locales.indexOf(momentLocale) > -1) {
            return momentLocale;
        }
    }

    momentLocale = tokens[0];
    if (locales.indexOf(momentLocale) > -1) {
        return momentLocale;
    }

    // no matching, falls back to en
    return "en";
};

/**
 * Convert locale string into moment-js locale format.
 *
 * @param {?string} locale
 * @returns {?string}
 * @private
 */
AuraLocalizationService.prototype.normalizeLocale = function(locale) {
    return locale ? locale.toLowerCase().replace("_", "-") : locale;
};

/**
 * Get available moment locale from cache based on specified Java locale.
 *
 * This function assumes all available locales are added to cache during init().
 *
 * @param {?string} locale - a Java locale
 * @return {!string} corresponding momnet locale string, or 'en' if Java locale doesn't exists in cache.
 * @private
 */
AuraLocalizationService.prototype.getAvailableMomentLocale = function(locale) {
    var momentLocale = this.momentLocaleCache[locale];
    return momentLocale ? momentLocale : "en";
};

/**
 * Check if a Java locale is available in localization service.
 *
 * This function assumes all available locales are added to cache during init().
 *
 * @param {?string} locale - a Java locale
 * @return {!boolean} true if locale is available, false otherwise
 * @private
 */
AuraLocalizationService.prototype.isAvailableLocale = function(locale) {
    if (!locale) {
        return false;
    }

    if (this.momentLocaleCache.hasOwnProperty(locale)) {
        return true;
    }

    // If locale is not in cache, check if moment has avaiable for the locale
    var momentLocale = this.normalizeToMomentLocale(locale);
    var language = this.normalizeLocale(locale).split("-")[0];
    // Locale falls back to en
    if (momentLocale === "en" && language !== "en") {
        return false;
    } else {
        this.momentLocaleCache[locale] = momentLocale;
        return true;
    }
};

/**
 * @param {!Date} date
 * @param {!string} formatString
 * @param {!string} locale
 * @param {!boolean} isUTCDate
 * @returns {!string}
 * @private
 */
AuraLocalizationService.prototype.formatDateTimeToString = function(date, formatString, locale, isUTCDate) {
    var dateTimeFormat = this.createDateTimeFormat(formatString, locale);

    var utcOffset = (isUTCDate === true) ? 0 : (date.getTimezoneOffset() * -1);
    return dateTimeFormat["format"](date, utcOffset);
};

/**
 * @returns {!boolean}
 */
AuraLocalizationService.prototype.canFormatToParts = function() {
    if (this.supportFormatToParts === undefined) {
        var dateTimeFormat = new Intl["DateTimeFormat"]();
        if (dateTimeFormat["formatToParts"] === undefined) {
            this.supportFormatToParts = false;
        } else {
            try {
                dateTimeFormat["formatToParts"](new Date());
                this.supportFormatToParts = true;
            } catch (e) {
                // Mobile browser does not support formatToParts very well. Needs to do real
                // call for checking support.
                $A.log("The browser does not support Intl.DateTimeFormat.formatToParts", e);
                this.supportFormatToParts = false;
            }
        }

    }

    return this.supportFormatToParts;
};

/**
 * @param {!string} locale
 * @returns {!string}
 */
AuraLocalizationService.prototype.normalizeToIntlLocale = function(locale) {

    var intlLocale = this.intlLocaleCache[locale];
    if (intlLocale === undefined) {
        intlLocale = locale.replace("_", "-").replace("-EURO", "");

        var supported = Intl["DateTimeFormat"]["supportedLocalesOf"](intlLocale);
        if (supported.length === 0) {
            $A.warning("LocalizationService: Unknown locale: " + locale + ". Falls back to 'en-US'.");
            intlLocale = "en-US";
        } else {
            intlLocale = supported[0];
        }

        this.intlLocaleCache[locale] = intlLocale;
    }

    return intlLocale;
};

/**
 * Get the localized value string for the given field from a date.
 * It can be used only if Intl.DateTimeFormat.formatToParts() is supported.
 *
 * @param {!Date} date
 * @param {!Intl.DateTimeFormat} dateTimeFormat
 * @param {!string} field
 * @returns {!string}
 */
AuraLocalizationService.prototype.getLocalizedDateTimeField = function(date, dateTimeFormat, field) {
    var parts = dateTimeFormat["formatToParts"](date);
    return this.findField(parts, field) || "";
};

/**
 * Get the value of a filed from the parts which is returned from Intl.DateTimeFormat.formatToParts().
 *
 * @param {!Array<!{type: !string, value: !string}>} parts
 * @param {!string} type
 * @returns {?string}
 */
AuraLocalizationService.prototype.findField = function(parts, type) {
    for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (part["type"].toLowerCase() === type) {
            return part["value"];
        }
    }

    return null;
};

/**
 * Normalize a Java format string to make it compatible with moment.js
 *
 * @param {?string} format
 * @returns {?string}
 * @private
 */
AuraLocalizationService.prototype.getNormalizedFormat = function(format) {
    if (format) {
        if (!this.cache.format[format]) {
            var normalizedFormat =
                format.replace(/y/g, "Y")
                .replace(/(\b|[^Y])Y(?!Y)/g, "$1YYYY")
                .replace(/d/g, "D")
                .replace(/E/g, "d")
                .replace(/a/g, "A");
            this.cache.format[format] = normalizedFormat;
        }
        return this.cache.format[format];
    }
    return format;
};

/**
 * Modifying the format so that moment's strict parsing doesn't break on minor deviations
 *
 * @param {?string} format
 * @returns {?string}
 * @private
 */
AuraLocalizationService.prototype.getStrictModeFormat = function(format) {
    if (format) {
        if (!this.cache.strictModeFormat[format]) {
            var normalizedFormat = this.getNormalizedFormat(format);
            if (normalizedFormat) {
                var strictModeFormat = normalizedFormat
                    .replace(/(\b|[^D])D{2}(?!D)/g, "$1D")
                    .replace(/(\b|[^M])M{2}(?!M)/g, "$1M")
                    .replace(/(\b|[^h])h{2}(?!h)/g, "$1h")
                    .replace(/(\b|[^H])H{2}(?!H)/g, "$1H")
                    .replace(/(\b|[^m])m{2}(?!m)/g, "$1m")
                    .replace(/(\b|[^s])s{2}(?!s)/g, "$1s")
                    .replace(/\s*A/g, " A")
                    .trim();
                this.cache.strictModeFormat[format] = strictModeFormat;
            }
        }
        return this.cache.strictModeFormat[format];
    }
    return format;
};

/**
 * Modifying the date time string so that moment's strict parsing doesn't break on minor deviations
 *
 * @param {?string} dateTimeString
 * @returns {?string}
 * @private
 */
AuraLocalizationService.prototype.getStrictModeDateTimeString = function(dateTimeString) {
    if (dateTimeString) {
        return dateTimeString.replace(/(\d)([AaPp][Mm])/g, "$1 $2");
    }
    return dateTimeString;
};

/**
 * Mutates the original date object by adding or subtract time.
 *
 * @param {!Date} date - The Date object to mutated
 * @param {!number} num - The number of unit to add or to subtract
 * @param {!string} unit - A normalized datetime unit, options: year, month, week, day, hour, minute or second
 * @param {!boolean} isSubtract - Set true if it is a subtract
 * @private
 */
AuraLocalizationService.prototype.addSubtract = function(date, num, unit, isSubtract) {
    if (isSubtract) {
        num = -1 * num;
    }

    switch (unit) {
        case "year":
            date.setFullYear(date.getFullYear() + num);
            break;
        case "month":
            date.setMonth(date.getMonth() + num);
            break;
        case "week":
            date.setDate(date.getDate() + num * 7);
            break;
        case "day":
            date.setDate(date.getDate() + num);
            break;
        case "hour":
            date.setHours(date.getHours() + num);
            break;
        case "minute":
            date.setMinutes(date.getMinutes() + num);
            break;
        case "second":
            date.setSeconds(date.getSeconds() + num);
            break;
        case "millisecond":
            date.setMilliseconds(date.getMilliseconds() + num);
    }
};

/**
 * Converts datetime input into a Date object. If datetime is a Date object, it returns the original input.
 *
 * @param {?string|number|Date} datetime - A datetime string in ISO8601 format, or a timestamp in milliseconds, or a Date object
 * @returns {!Date} A Date object which represents the provided datetime, an invalid Date if the given datetime is not a supported type
 * @private
 */
AuraLocalizationService.prototype.normalizeDateTimeInput = function(datetime) {

    if (typeof datetime === "string") {
        datetime = this.parseDateTimeISO8601(datetime);
    } else if (typeof datetime === "number") {
        datetime = new Date(datetime);
    }

    if (!this.isValidDateObject(datetime)) {
        return new Date(NaN);
    }

    return /** @type {!Date} */ (datetime);
};

/**
 * Get the quarter number of the given date, 1 - 4.
 *
 * @param {!Date} date
 * @returns {!number}
 * @private
 */
AuraLocalizationService.prototype.quarterInYear = function(date) {
    return Math.floor(date.getMonth() / 3) + 1;
};

/**
 * @param {!Date} date
 * @returns {!number}
 */
AuraLocalizationService.prototype.weekInYear = function(date) {
    var nonLeapLadder = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var leapLadder = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var ordinal = day + (this.isLeapYear(year) ? leapLadder : nonLeapLadder)[month - 1];

    var weekday = date.getDay();
    if (weekday === 0) {
        weekday = 7;
    }

    // weekday needs to be 1-7
    var weekNumber = Math.floor((ordinal - weekday + 10) / 7);

    return weekNumber;
};

/**
 * @param {!number} year
 * @returns {!boolean}
 * @private
 */
AuraLocalizationService.prototype.isLeapYear = function(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
};

/**
 * Parse offset string into minutes
 *
 * @param {string} offsetString
 * @returns {?number} the offset in minutes, null if offset is invalid
 */
AuraLocalizationService.prototype.parseOffset = function(offsetString) {
    var tokens = this.ISO_OFFSET_PATTERN.exec(offsetString);
    if (tokens === null) {
        return null;
    }

    if (tokens[0] === "Z") {
        return 0;
    } else {
        var offsetInMinute = parseInt(tokens[2], 10) * 60 + parseInt(tokens[3], 10);
        if (!this.isValidOffset(offsetInMinute)) {
            return null;
        }
        return offsetInMinute;
    }
};

/**
 * @param {!string} dateTimeString
 * @returns {?{year: !number, month: !number, day: !number, hour: !number, minute: !number, second: !number, millisecond: !number, utcOffset: (number|undefined)}} The date parsed into parts.
 * @private
 */
AuraLocalizationService.prototype.parseISOStringToConfig = function(dateTimeString) {
    var i, tokens;
    // date string
    var year = 0, month = 0, day = 0;
    var timeOnly = false;

    var match = this.ISO_REGEX.exec(dateTimeString) || this.ISO_REGEX_NO_DASH.exec(dateTimeString);
    if (match === null) {
        match = this.ISO_TIME_REGEX.exec(dateTimeString);
        if (match === null) {
            return null;
        }

        timeOnly = true;
        var date = new Date();
        year = date.getFullYear();
        month = date.getMonth() + 1;
        day = date.getDate();
    } else {
        var dateString = match[1];
        for (i = 0; i < this.ISO_DATE_PATTERNS.length; i++) {
            var datePattern = this.ISO_DATE_PATTERNS[i];
            tokens = datePattern.exec(dateString);
            if (tokens) {
                year = parseInt(tokens[1], 10);
                month = parseInt(tokens[2], 10) || 1;
                day = parseInt(tokens[3], 10) || 1;
                break;
            }
        }

        if (!this.isValidDate(year, month, day)) {
            return null;
        }
    }

    var hour, minute, second, millisecond;
    hour = minute = second = millisecond = 0;
    var timeString = timeOnly === false? match[3] : match[1];
    if (timeString !== undefined) {
        for (i = 0; i < this.ISO_TIME_PATTERNS.length; i++) {
            var timePattern = this.ISO_TIME_PATTERNS[i];
            tokens = timePattern.exec(timeString);
            if (tokens) {
                hour = parseInt(tokens[1], 10) || 0;
                minute = parseInt(tokens[2], 10) || 0;
                second = parseInt(tokens[3], 10) || 0;
                // only keep 3 digits for millisecond
                millisecond = tokens[4]? parseInt(tokens[4].substring(0, 3), 10) : 0;
                break;
            }
        }

        if (!this.isValidTime(hour, minute, second, millisecond)) {
            return null;
        }
    }

    var utcOffset = undefined;
    var offsetString = timeOnly === false ? match[4] : match[2];
    if (offsetString !== undefined) {
        utcOffset = this.parseOffset(offsetString);
        if (utcOffset === null) {
            return null;
        }
    }

    return {
        "year": year,
        "month": month,
        "day": day,
        "hour": hour,
        "minute": minute,
        "second": second,
        "millisecond": millisecond,
        "utcOffset": utcOffset
    };
};

/**
 * @param {!number} year
 * @param {!number} month
 * @returns {!number}
 * @private
 */
AuraLocalizationService.prototype.daysInMonth = function (year, month) {
    switch (month) {
        case 2:
            return (year % 4 === 0 && year % 100) || year % 400 === 0 ? 29 : 28;
        case 4: case 6: case 9: case 11:
            return 30;
        default:
            return 31;
    }
};

/**
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @return {!boolean}
 * @private
 */
AuraLocalizationService.prototype.isValidDate = function(year, month, day) {
    return month >= 1 && month <= 13 && day >= 1 && day <= this.daysInMonth(year, month);
};

/**
 * @param {!number} hour
 * @param {!number} minute
 * @param {!number} second
 * @param {!number} millisecond
 * @return {!boolean}
 */
AuraLocalizationService.prototype.isValidTime = function(hour, minute, second, millisecond) {
    return ((hour >=0 && hour < 24) || ((hour === 24) && (minute === 0) && (second === 0) && (millisecond === 0))) &&
           minute >= 0 && minute < 60 &&
           second >= 0 && second < 60 &&
           millisecond >= 0 && millisecond <= 999;
};

/**
 * @param {!number} offsetInMinute
 * @return {!boolean}
 * @private
 */
AuraLocalizationService.prototype.isValidOffset = function(offsetInMinute) {
    // UTC-12 to UTC+14
    return offsetInMinute >= -720 && offsetInMinute <= 840;
};

/**
 * @param {!string} dateTimeString
 * @return {!boolean}
 * @private
 */
AuraLocalizationService.prototype.isISO8601DateTimeString = function(dateTimeString) {
    return this.ISO_REGEX.test(dateTimeString) || this.ISO_REGEX_NO_DASH.test(dateTimeString) ||
            this.ISO_TIME_REGEX.test(dateTimeString);
};

/**
 * @param {*} unit
 * @returns {?string}
 */
AuraLocalizationService.prototype.normalizeDateTimeUnit = function(unit) {
    return $A.util.isString(unit) ? this.dateTimeUnitAlias[unit] || this.dateTimeUnitAlias[unit.toLowerCase()] || null : null;
};

/**
 * Adds a datetime unit's aliases (lowercase, lowercase plural, shorthand) to unit alias map.
 * @param {!string} unit
 * @param {!string} short
 * @private
 */
AuraLocalizationService.prototype.addDateTimeUnitAlias = function(unit, short) {
    var lowerCase = unit.toLowerCase();
    this.dateTimeUnitAlias[lowerCase] = this.dateTimeUnitAlias[lowerCase + 's'] = this.dateTimeUnitAlias[short] = unit;
};

/**
 * @private
 */
AuraLocalizationService.prototype.setupDateTimeUnitAlias = function() {
    this.addDateTimeUnitAlias("year", "y");
    this.addDateTimeUnitAlias("month", "M");
    this.addDateTimeUnitAlias("week", "w");
    this.addDateTimeUnitAlias("day", "d");
    this.addDateTimeUnitAlias("hour", "h");
    this.addDateTimeUnitAlias("minute", "m");
    this.addDateTimeUnitAlias("second", "s");
    this.addDateTimeUnitAlias("millisecond", "ms");
};

/**
 * @param {?Date|*} date
 * @returns {!boolean} true if it is a valid Date object.
 * @private
 */
AuraLocalizationService.prototype.isValidDateObject = function(date) {
    return (date instanceof Date) && !isNaN(date.getTime());
};

/**
 * @param {*} duration
 * @returns {!boolean} true if it is an Aura.Utils.Duration
 */
AuraLocalizationService.prototype.isValidDuration = function(duration) {
    return duration instanceof Aura.Utils.Duration;
};

Aura.Services.AuraLocalizationService = AuraLocalizationService;
