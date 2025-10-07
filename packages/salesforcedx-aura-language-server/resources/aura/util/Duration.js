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
 * Duration class for AuraLocalizationService.
 *
 * We used to expose moment Duration object to framework users by $A.localizationService.duration().
 * This class is responsible for deprecating moment Duration and for the implementation of Duration.
 * All APIs in this class are deprecated and will be removed. (Those APIs were exposed to framework users
 * due to moment Duration)
 * The object of this class can be only consumed by AuraLocalizationService APIs for framework users.
 *
 * @constructor
 * @export
 */
Aura.Utils.Duration = function Duration(num, unit, moment) {
    // still needed for relative time strings
    this.momentDuration = moment["duration"](num, unit);
    this.isValid = true;

    if (typeof num !== "number") {
        this.isValid = false;
        return;
    }

    unit = unit? $A.localizationService.normalizeDateTimeUnit(unit) : "millisecond";

    var milliseconds, days, months;
    switch(unit) {
        // Time
        case "millisecond": milliseconds = num; break;
        case "second": milliseconds = num * 1e3; break;
        case "minute": milliseconds = num * 6e4; break; // 60 * 1000
        case "hour": milliseconds = num * 36e5; break; // 60 * 60 * 1000

        // days -> month, days -> years
        case "day": days = num; break;
        case "week": days = num * 7; break;

        // year -> days, month -> days
        case "month": months = num; break;
        case "year": months = num * 12;
    }

    // If unit is not supported, set as 0
    this.duration = {
        "millisecond": milliseconds || 0,
        "day": days || 0,
        "month": months || 0
    };

    this.data = undefined;
};

/**
 * Displays the time length of the duration.
 *
 * @param {Boolean} withSuffix - If true, returns value with the suffix
 */
Aura.Utils.Duration.prototype.displayDuration = function(withSuffix) {
    // TODO: figure out if it is possible to support this by using labels
    return this.momentDuration["humanize"](withSuffix);
};

/**
 * Displays a length of time in given unit.
 *
 * @param {String} unit - A datetime unit. The default is millisecond. Options: year, month, week, day, hour, minute, second, millisecond
 */
Aura.Utils.Duration.prototype.asUnit = function(unit) {
    if (!this.isValid) {
        return NaN;
    }

    unit = unit? $A.localizationService.normalizeDateTimeUnit(unit) : "millisecond";

    var days;
    var milliseconds = this.duration["millisecond"];
    if (unit === "month" || unit === "year") {
        days = this.duration["day"] +  (milliseconds / 864e5); // 24 * 60 * 60 * 1000
        var months = this.duration["month"] + this.daysToMonths(days);
        return unit === "month" ? months : months / 12;
    } else {
        days = this.duration["day"];
        if (this.duration["month"]) {
            days += Math.round(this.monthsToDays(this.duration["month"]));
        }

        switch (unit) {
            case "week": return (days / 7) + (milliseconds / 6048e5);   // 24 * 60 * 60 * 1000 * 7
            case "day": return days + (milliseconds / 864e5);           // 24 * 60 * 60 * 1000
            case "hour": return (days * 24) + (milliseconds / 36e5);    // 60 * 60 * 1000
            case "minute": return (days * 1440) + (milliseconds / 6e4);
            case "second": return (days * 86400) + (milliseconds / 1000);
            case "millisecond": return Math.floor(days * 864e5) + milliseconds;

            // if unit is not supported
            default: return NaN;
        }
    }
};

/**
 * Gets the number of time in given unit in the duration.
 *
 * @param {String} unit - A datetime unit. The default is millisecond. Options: year, month, day, hour, minute, second, millisecond
 */
Aura.Utils.Duration.prototype.getUnit = function(unit) {
    if (!this.isValid) {
        return NaN;
    }

    // if data has never been populated
    if (this.data === undefined) {
        this.data = {};

        var milliseconds = this.duration["millisecond"];
        this.data["millisecond"] = milliseconds % 1000;

        var seconds = this.absFloor(milliseconds / 1000);
        this.data["second"] = seconds % 60;

        var minutes = this.absFloor(seconds / 60);
        this.data["minute"] = minutes % 60;

        var hours = this.absFloor(minutes / 60);
        this.data["hour"] = hours % 24;

        var days = this.absFloor(hours / 24);
        days += this.duration["day"];

        var months = this.absFloor(this.daysToMonths(days)) + this.duration["month"];
        this.data["day"] = days - this.absCeil(this.monthsToDays(months));

        this.data["month"] = months % 12;
        this.data["year"] = this.absFloor(months / 12);
    }

    unit = unit? $A.localizationService.normalizeDateTimeUnit(unit) : "millisecond";

    var num = this.data[unit];
    return num === undefined? NaN : num;
};

/**
 * Converts days to months.
 *
 * @param {Number} days - the number of days
 * @returns {Number} The number of months
 *
 * @private
 */
Aura.Utils.Duration.prototype.daysToMonths = function(days) {
    return days * 4800 / 146097;
};

/**
 * Converts months to days.
 *
 * @param {Number} months - the number of months
 * @returns {Number} The number of days
 *
 * @private
 */
Aura.Utils.Duration.prototype.monthsToDays = function(months) {
    return months * 146097 / 4800;
};

Aura.Utils.Duration.prototype.absCeil = function(number) {
    return number < 0? Math.floor(number) : Math.ceil(number);
};

Aura.Utils.Duration.prototype.absFloor = function(number) {
    return number < 0?  Math.ceil(number) || 0 : Math.floor(number);
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.humanize = function(withSuffix) {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            null, "Duration.humanize");
    return this.momentDuration["humanize"](withSuffix);
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.milliseconds = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationService.getMillisecondsInDuration()'", "Duration.milliseconds");
    return this.momentDuration["milliseconds"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.asMilliseconds = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationService.displayDurationInMilliseconds()'", "Duration.asMilliseconds");
    return this.momentDuration["asMilliseconds"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.seconds = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationSerivce.displayDurationInSeconds()'", "Duration.seconds");
    return this.momentDuration["seconds"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.asSeconds = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationService.displayDurationInSeconds()'", "Duration.asSeconds");
    return this.momentDuration["asSeconds"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.minutes = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationService.getMinutesInDuration()", "Duration.minutes");
    return this.momentDuration["minutes"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.asMinutes = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationService.displayDurationInMinutes()'", "Duration.asMinutes");
    return this.momentDuration["asMinutes"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.hours = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationService.getHoursInDuration()'", "Duration.hours");
    return this.momentDuration["hours"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.asHours = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationService.displayDurationInHours()'", "Duration.asHours");
    return this.momentDuration["asHours"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.days = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationService.getDaysInDuration()'", "Duration.days");
    return this.momentDuration["days"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.asDays = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationService.displayDurationInDays()'", "Duration.asDays");
    return this.momentDuration["asDays"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.weeks = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            null, "Duration.weeks");
    return this.momentDuration["weeks"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.asWeeks = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            null, "Duration.asWeeks");
    return this.momentDuration["asWeeks"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.months = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationService.getMonthsInDuration()'", "Duration.months");
    return this.momentDuration["months"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.asMonths = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationService.displayDurationInMonths()'", "Duration.asMonths");
    return this.momentDuration["asMonths"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.years = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationService.getYearsInDuration()'", "Duration.years");
    return this.momentDuration["years"]();
};

/**
 * @deprecated
 * @export
 * @platform
 */
Aura.Utils.Duration.prototype.asYears = function() {
    $A.deprecated("This method is not officially supported by framework and will be removed in upcoming release.",
            "Use '$A.localizationService.displayDurationInYears()'", "Duration.asYears");
    return this.momentDuration["asYears"]();
};
