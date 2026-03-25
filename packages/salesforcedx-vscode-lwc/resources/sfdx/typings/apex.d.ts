declare module '@salesforce/apex' {
    /**
     * Identifier for an object's field.
     */
    export interface FieldId {
        /** The field's API name. */
        fieldApiName: string;
        /** The object's API name. */
        objectApiName: string;
    }

    /**
     * Services for Apex.
     */
    export interface ApexServices {
        /**
         * Refreshes a property annotated with @wire. Queries the server for updated data and refreshes the cache.
         * @param wiredTargetValue A property annotated with @wire.
         * @returns Promise that resolves to the refreshed value. If an error occurs, the promise is rejected.
         */
        refreshApex: (wiredTargetValue: any) => Promise<any>;

        /**
         * Gets a field value from an Apex sObject.
         * @param sObject The sObject holding the field.
         * @param field The field to return.
         * @returns The field's value. If it doesn't exist, undefined is returned.
         */
        getSObjectValue: (sObject: object, field: string | FieldId) => any;
    }
}
