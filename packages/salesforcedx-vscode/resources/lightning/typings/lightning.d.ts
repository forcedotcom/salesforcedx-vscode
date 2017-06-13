declare namespace $A {
    /**
     * Create a component from a type and a set of attributes.
     * It accepts the name of a type of component, a map of attributes,
     * and a callback to notify callers.
     */
    export function createComponent(
        type: string,
        attributes: Object,
        callback: (component: Component, status: any, errorMessage: any) => void): any;

    /**
     * Create an array of components from a list of types and attributes.
     * It accepts a list of component names and attribute maps, and a callback
     * to notify callers.
     */
    export function createComponents(
        type: Object[][],
        attributes: Object,
        callback: (component: Component[], status: any, errorMessage: any) => void): any;

    /**
     * This function must be called from within an event loop.
     */
    export function enqueueAction(action: Action, background: boolean): any;

    /**
     * Returns the value referenced using property syntax. Gets the value from the specified global value provider
     */
    export function get(key: string, callback: (any: any) => void): any;

    /**
     * Returns a callback which is safe to invoke from outside Aura, e.g. as an event handler or in a setTimeout.
     * The $A.getCallback() call ensures that the framework rerenders the modified component
     * and processes any enqueued actions.
     */
    export function getCallback(callback: (any: any) => void): any;

    /**
     * Gets an instance of a component from either a GlobalId or a DOM element that was created via a Component Render.
     */
    export function getComponent(idenfitier: Object): Component;

    /**
     * Gets the root component or application. For example, $A.getRoot().get("v.attrName"); returns the attribute from the root component.
     */
    export function getRoot(): Component;

    /**
     *  Logs to the browser's JavaScript console if it is available.
     *  This method doesn't log in PROD or PRODDEBUG modes.
     *  If both value and error are passed in, value shows up in the console as a group with value logged within the group.
     *  If only value is passed in, value is logged without grouping.
     */
    export function log(value: Object, error: Object): any;

    /**
     * Report error to the server after handling it.
     * Note that the method should only be used if try-catch mechanism
     * of error handling is not desired or not functional (ex: in nested promises)
     */
    export function reportError(message: string, error: Error): any;

    /**
     * Sets the value referenced using property syntax on the specified global value provider.
     */
    export function set(key: string, value: Object): any;


    /**
     * $A.warning() should be used in the case where poor programming practices have been used.
     *
     * These warnings will not, in general, be displayed to the user, but they will appear in the console (if
     * available), and in the aura debug window.
     */
    export function warning(warning: string, error: Error): any;

    /**
     * Instance of the AuraLocalizationService which provides utility methods for localizing data or getting formatters for numbers, currencies, dates, etc.
     */
    export const localizationService: AuraLocalizationService;

    /**
     * Collection of basic utility methods to operate on the DOM and Aura Components. 
     */
    export const util: Util;

}

interface AuraLocalizationService {

    /**
     * Converts a datetime from UTC to a specified timezone.
     */
    UTCToWallTime(date: Date, timezone: string, callback: (any: any) => void): any;

    /**
     * Converts a datetime from a specified timezone to UTC.
     */
    WallTimeToUTC(date: Date, timezone: string, callback: (any: any) => void): any;

    /**
     * Displays a length of time.
     */
    displayDuration(d: Duration, noSuffix: boolean): string;

    /**
     * Displays a length of time in days.
     */
    displayDurationInDays(d: Duration): number;

    /**
     * Displays a length of time in hours.
     */
    displayDurationInHours(d: Duration): number;

    /**
     * Displays a length of time in milliseconds
     */
    displayDurationInMilliseconds(d: Duration): number;

    /**
     *Displays a length of time in minutes. 
     */
    displayDurationInMinutes(d: Duration): number;

    /**
     * Displays a length of time in months.
     */
    displayDurationInMonths(d: Duration): number;

    /**
     * Displays a length of time in seconds.
     */
    displayDurationInSeconds(d: Duration): number;

    /** 
     * Creates an Object representing a length of time.
     */
    duration(num: number | Object, unit: string): Duration

    /**
     * Converts the passed in Date by setting it to the end of a unit of time.
     */
    endOf(date: string | number | Date, unit: string): Date;

    /**
     * Returns a currency number based on the default currency format.
     */
    formatCurrency(number: number): number

    /**
     * Formats a date.
     */
    formatDate(date: string | number | Date, formatString: string, locale: string): string;

    /**
     * Formats a datetime.
     */
    formatDateTime(date: string | number | Date, formatString: string, locale: string): string;

    /**
     * Formats a datetime in UTC.
     */
    formatDateTimeUTC(date: string | number | Date, formatString: string, locale: string): string;

    /**
     * Formats a date in UTC.
     */
    formatDateUTC(date: string | number | Date, formatString: string, locale: string): string;

    /**
     * Formats a number with the default number format.
     */
    formatNumber(number: number): number;

    /**
     * Returns a formatted percentage number based on the default percentage format.
     */
    formatPercent(number: number): number;

    /**
     * Formats a time.
     */
    formatTime(date: string | number | Date, formatString: string, locale: string): string;

    /**
     * Formats a time in UTC.
     */
    formatTimeUTC(date: string | number | Date, formatString: string, locale: string): string;

    /**
     * Get the date's date string based on a time zone.
     */
    getDateStringBasedOnTimezone(timezone: string, date: Date, callback: (any: any) => void): string;

    /**
     * Gets the number of days in a duration.
     */
    getDaysInDuration(d: Duration): number;

    /**
     * Returns the default currency format.
     */
    getDefaultCurrencyFormat(): number;

    /**
     * Returns the default NumberFormat Object.
     */
    getDefaultNumberFormat(): number;

    /**
     * Returns the default percentage Object.
     */
    getDefaultPercentFormat(): number;

    /**
     * Get the number of hours in a duration.
     */
    getHoursInDuration(d: Duration): number;

    /** 
     * Get the date time related labels (month name, weekday name, am/pm etc.).
     */
    getLocalizedDateTimeLabels(): Object;

    /**
     *  Gets the number of milliseconds in a duration.
     */
    getMillisecondsInDuration(d: Duration): number;

    /**
     *  Gets the number of minutes in a duration.
     */
    getMinutesInDuration(d: Duration): number;

    /**
     *  Gets the number of months in a duration.
     */
    getMonthsInDuration(d: Duration): number;

    /**
     *  Returns a NumberFormat Object.
     */
    getNumberFormat(format: string, symbols: string): number;

    /**
     *  Gets the number of seconds in a duration.
     */
    getSecondsInDuration(d: Duration): number;

    /**
     *  Get today's date based on a time zone. 
     */
    getToday(timezone: string, callback: (any: any) => void): string;

    /**
     *  Gets the number of years in a duration.
     */
    getYearsInDuration(d: Duration): number;

    /**
     * Checks if date1 is after date2
     */
    isAfter(date1: string | number | Date, date2: string | number | Date, unit: string): boolean;

    /**
     * Checks if date1 is before date2
     */
    isBefore(date1: string | number | Date, date2: string | number | Date, unit: string): boolean;

    /**
     * A utility function to check if a datetime pattern string uses a 24-hour or period (12 hour with am/pm) time view.
     */
    isPeriodTimeView(pattern: string): boolean;

    /**
     * Checks if date1 is same as date2
     */
    isSame(date1: string | number | Date, date2: string | number | Date, unit: string): boolean;

    /**
     *  Parses a string to a JavaScript Date.
     */
    parseDateTime(dateTimeString: string, targetFormat: string, locale: string, strictParsing: boolean): Date;

    /** 
     * Parses a date time string in an ISO-8601 format.
    */
    parseDateTimeISO8601(dateTimeString: string): Date;

    /**
     *  Parses a string to a JavaScript Date in UTC.
     */
    parseDateTimeUTC(dateTimeString: string, targetFormat: string, locale: string, strictParsing: boolean): Date;

    /**
     * Converts the passed in Date by setting it to the start of a unit of time.
     */
    startOf(date: string | number | Date, unit: string): Date;

    /**
     Most modern browsers support this method on Date Object. But that is not the case for IE8 and older.
     */
    toISOString(date: Date): string;

    /**
     * Translate the localized digit string to a string with Arabic digits if there is any.
     */
    translateFromLocalizedDigits(input: string): string;

    /**
     * Translate the input date from other calendar system (for example, Buddhist calendar) to Gregorian calendar based on the locale.
     */
    translateFromOtherCalendar(date: Date): Date;

    /**
     * Translate the input string to a string with localized digits (different from Arabic) if there is any.
     */
    translateToLocalizedDigits(input: string): string;

    /**
     * Translate the input date to a date in other calendar system, for example, Buddhist calendar based on the locale.
     */
    translateToOtherCalendar(date: Date): Date;
}

type Duration = Object;

interface Action {
    /**
     * Returns an array of error Objects only for server-side actions.
     * Each error Object has a message field.
     * In any mode except PROD mode, each Object also has a stack field, which is a list
     * describing the execution stack when the error occurred.
     */
    getError(): Object[];

    /**
     * Gets an action parameter value for a parameter name.
     */
    getParam(name: string): Object;

    /**
    * Gets the collection of parameters for this Action.
    */
    getParams(): Object;

    /**
    * Gets the return value of the Action. A server-side Action can return any Object containing serializable JSON data.
    */
    getReturnValue(): any;

    /**
     * Gets the current state of the Action. You should check the state of the action
     * in the callback after the server-side action completes.
     */
    getState(): string;

    /**
     * Returns true if the actions should be enqueued in the background, false if it should be run in the foreground.
     */
    isBackground(): boolean

    /**
     * Set the action as abortable. Abortable actions are not sent to the server if the component is not valid.
     * A component is automatically destroyed and marked invalid by the framework when it is unrendered.
     *
     * Actions not marked abortable are always sent to the server regardless of the validity of the component.
     * For example, a save/modify action should not be set abortable to ensure it's always sent to the server
     * even if the component is deleted.
     *
     * Setting an action as abortable cannot be undone
     */
    setAbortable(): any;

    /**
     * Sets the action to run as a background action. This cannot be unset. Background actions are usually long running and
     * lower priority actions. A background action is useful when you want your app to remain responsive to a user while it
     * executes a low priority, long-running action. A rough guideline is to use a background action if it takes more than
     * five seconds for the response to return from the server.
     */
    setBackground(): any;

    /**
     * Sets the callback function that is executed after the server-side action returns. Call a server-side action from a
     * client-side controller using <code>callback</code>.
     *
     * Note that you can register a callback for an explicit state, or you can use 'ALL' which registers callbacks for
     * "SUCCESS", "ERROR", and "INCOMPLETE" (but not "ABORTED" for historical compatibility). It is recommended that you
     * use an explicit name, and not the default 'undefined' to signify 'ALL'.
     *
     * The valid names are:
     *  * SUCCESS: if the action successfully completes.
     *  * ERROR: if the action has an error (including javascript errors for client side actions)
     *  * INCOMPLETE: if a server side action failed to complete because there is no connection
     *  * ABORTED: if the action is aborted via abort()
     *  * REFRESH: for server side storable actions, this will be called instead of the SUCCESS action when the storage is refreshed.
     */
    setCallback(scope: Object, callback: (any: any) => void, name: string): any;

    /**
     * Sets a single parameter for the Action.
     */
    setParam(key: string, value: Object): any;

    /**
     * Sets parameters for the Action.
     */
    setParams(config: Object): any;

    /**
     * Marks the Action as storable. For server-side Actions only.
     * Mark an action as storable to have its response stored in the client-side cache by the framework. Caching can be useful
     * if you want your app to be functional for devices that temporarily don’t have a network connection.
     */
    setStorable(config: Object): any;
}

interface Component {
    /**
     * Adds an event handler. Resolving the handler Action happens at Event-handling
     * time, so the Action reference may be altered at runtime, and that change is
     * reflected in the handler.
     */
    addHandler(eventName: string, valueProvider: Object, actionExpression: Object, insert: boolean, phase: string, includeFacets: boolean): any;

    /**
     * Adds handlers to Values owned by the Component.
     */
    addValueHandler(config: Object): any;

    /**
     * Adds Custom ValueProviders to a component
     */
    addValueProvider(key: string, valueProvider: Object): any;

    /**
     * Sets a flag to tell the rendering service whether or not to destroy this component when it is removed
     * from its rendering facet. Set to false if you plan to keep a reference to a component after it has
     * been unrendered or removed from a parent facet. Default is true: destroy once orphaned.
     */
    autoDestroy(destroy: boolean): any;

    /**
     * Clears a live reference for the value indicated using property syntax.
     * For example, if you use aura:set to set a value and later want to reset the value using <code>component.set()</code>,
     * clear the reference before resetting the value.
     */
    clearReference(key: string): any;

    /**
     * Destroys the component and cleans up memory.
     * After a component that is declared in markup is no longer in use, the framework automatically destroys it
     * and frees up its memory.
     * If you create a component dynamically in JavaScript and that component isn't added to a facet (v.body or another
     * attribute of type Aura.Component[]), you have to destroy it manually using destroy() to avoid memory leaks.
     * destroy() destroys the component.
     */
    destroy(sync: boolean): any;

    /**
     * Locates a component using the localId. Shorthand: get("asdf"),
     * where "asdf" is the <code>aura:id</code> of the component to look for.
     * Returns different types depending on the result.
     * 	If the local ID is unique, find() returns the component.
     *	If there are multiple components with the same local ID, find() returns an array of the components.
     *  If there is no matching local ID, find() returns undefined.
     * Returns instances of a component using the format
     * cmp.find({ instancesOf : "auradocs:sampleComponent" }).
     */
    find(name: string | Object): any;

    /**
     * Returns the value referenced using property syntax.
     * For example, cmp.get("v.attr") returns the value of the attr aura:attribute.
     */
    get(key: string): any;

    /**
     * Gets the concrete implementation of a component. If the component is
     * concrete, the method returns the component itself. For example, call this
     * method to get the concrete component of a super component.
     */
    getConcreteComponent(): any;

    /**
     * If the component only rendered a single element, return it. Otherwise, you should use getElements().
     */
    getElement(): any;

    /**
     * Returns a map of the elements previously rendered by this component.
     */
    getElements(): any;

    /**
     * Returns a new event instance of the named component event.
     */
    getEvent(name: string): any;

    /**
     * Gets the globalId. This is the generated globally unique id of the component. It can be used to locate the instance later, but will change across page loads.
     */
    getGlobalId(): any;

    /**
     * Gets the id set using the aura:id attribute. Can be passed into find() on the parent to locate this child.
     */
    getLocalId(): any;

    /**
     * Returns the component's canonical name, e.g. 'ui:button'.
     */
    getName(): any;

    /**
     * Returns a live reference to the value indicated using property syntax. This is useful when you dynamically create a component.
     */
    getReference(key: string): PropertyReferenceValue;

    /**
     * Returns the super component.
     */
    getSuper(): Component;

    /**
     * Get the expected version number of a component based on its caller's requiredVersionDefs Note that for various rendering methods, we cannot rely on access stack. We use creation version instead.
     */
    getVersion(): any;

    /**
     * Returns true if the component is concrete, or false otherwise.
     */
    isConcrete(): boolean;

    /**
     * Checks whether the component is an instance of the given component name (or interface name).
     */
    isInstanceOf(name: string): boolean;

    /**
     * Returns true if the component has not been destroyed.
     */
    isValid(): any;

    /**
     * Sets the value referenced using property syntax.
     */
    set(key: string, value: Object): any;

}

interface PropertyReferenceValue {

}

interface Event {
    /**
     * Fires the Event. Checks if the Event has already been fired before firing. Maps the component handlers to the event dispatcher
     */
    fire(params: Object): any;

    /**
     * Gets the name of the Event.
     */
    getName(): string;

    /**
     * Gets an Event parameter. 
     */
    getParam(name: string): string;

    /**
     * Gets all the Event parameters.
     */
    getParams(): Object;

    /**
     * Gets the current phase of this event.
     * Returns undefined if the event has not yet been fired.
     * Possible return values for APPLICATION and COMPONENT events
     * are "capture", "bubble", and "default" once fired.
     * VALUE events return "default" once fired.
     */
    getPhase(): any;

    /**
     * Gets the source component that fired this event.
     */
    getSource(): Object;

    /**
     * Pauses this event such that event handlers will not be processed until
     * Event.resume() is called. The handling process will pause in the current
     * position of the event handler processing sequence. If the event is already
     * paused, calling this does nothing. This will throw an error
     * if called in the "default" phase.
     */
    pause(): any;

    /**
     * Prevents the default phase execution for this event. This will throw
     * an error if called in the "default" phase.
     * The default is true.
     */
    preventDefault(): any;

    /**
     * Resumes event handling for this event from the same position in the event
     * handler processing sequence from which it was previously paused.
     * If the event is not paused, calling this does nothing. This will throw an error
     * if called in the "default" phase.
     * This API does not define whether or not any remaining event handlers will
     * execute in the current call stack or be deferred and executed in a new call stack,
     * therefore the exact timing behavior is not dependable.
     */
    resume(): any;

    /**
     * Sets a parameter for the Event. Does not modify an event that has already been fired.
     */
    setParam(key: string, value: Object): any;

    /**
     * Sets parameters for the Event. Does not modify an event that has already been fired. Maps key in config to attributeDefs.
     */
    setParams(config: Object): any;

    /**
     * Sets whether the event can bubble or not. This will throw an error if called in the "default" phase. The default is false.
     */
    stopPropagation(): any;
}

interface Util {

    /**
     * Adds a CSS class to a component.
     */
    addClass(element: Component, newClass: string): any;

    /**
     * Coerces truthy and falsy values into native booleans
     */
    getBooleanValue(val: Object): boolean;

    /**
     * Checks whether the component has the specified CSS class.
     */
    hasClass(element: Object, className: string): boolean;

    /**
     * Checks whether the specified Object is an array.
     */
    isArray(obj: Object): boolean;

    /**
     * Checks if the Object is empty. An empty Object's value is undefined, null, an empty array, or empty string. An Object with no native properties is not considered empty.
     */
    isEmpty(obj: Object): boolean;

    /**
     * Checks whether the specified Object is a valid Object. A valid Object: Is not a DOM element, is not a native browser class (XMLHttpRequest) is not falsey, and is not an array, error, function string or number
     */
    isObject(obj: Object): boolean;

    /**
     * Checks if the Object is undefined.
     */
    isUndefined(obj: Object): boolean;

    /**
     * Checks if the Object is undefined or null.
     */
    isUndefinedOrNull(obj: Object): boolean;

    /**
     * Removes a CSS class from a component.
     */
    removeClass(element: Object, newClass: string): any;

    /**
     * Toggles (adds or removes) a CSS class from a component.
     */
    toggleClass(element: Object, className: string): any;

}
