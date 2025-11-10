declare module 'lightning/uiListApi' {
    /**
     * Identifier for an object.
     */
    export interface ObjectId {
        /** The object's API name. */
        objectApiName: string;
    }

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
     * Gets the records and metadata for a list view.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_get_list_ui
     *
     * @param objectApiName API name of the list view's object (must be specified along with listViewApiName).
     * @param listViewApiName API name of the list view (must be specified with objectApiName).
     * @param listViewId ID of the list view (may be specified without objectApiName or listViewApiName).
     * @param pageToken A token that represents the page offset. To indicate where the page starts, use this value with the pageSize parameter.
     *                The maximum offset is 2000 and the default is 0.
     * @param pageSize The number of list records viewed at one time. The default value is 50. Value can be 1–2000.
     * @param sortBy The API name of the field the list view is sorted by. If the name is preceded with `-`, the sort order is descending.
     *                For example, Name sorts by name in ascending order. `-CreatedDate` sorts by created date in descending order.
     *                Accepts only one value per request.
     * @param fields Additional fields queried for the records returned. These fields don’t create visible columns.
     *                If the field is not available to the user, an error occurs.
     * @param optionalFields Additional fields queried for the records returned. These fields don’t create visible columns.
     *                       If the field is not available to the user, no error occurs and the field isn’t included in the records.
     * @returns {Observable} See description.
     */
    export function getListUi(
        objectApiName?: string | ObjectId,
        listViewApiName?: string | symbol,
        listViewId?: string,
        pageToken?: string,
        pageSize?: number,
        sortBy?: string | FieldId,
        fields?: Array<string | FieldId>,
        optionalFields?: Array<string | FieldId>,
    ): void;
}

declare module 'lightning/uiRelatedListApi' {
    /**
     * Identifier for an object.
     */
    export interface ObjectId {
        /** The object's API name. */
        objectApiName: string;
    }

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
     *  Gets the metadata for a specific Related List
     * @param parentObjectApiName The API name of the parent object for the related list (must be specified with relatedListId)
     * @param parentRecordId The record ID of the parent record for the related list (must be specified with relatedListId)
     * @param relatedListId The ID of the related list (can be specified with either parentObjectApiName or parentRecordId)
     */
    export function getRelatedListInfo(parentObjectApiName?: string | ObjectId, parentRecordId?: string, relatedListId?: string): void;

    /**
     *  Gets the metadata for a batch of related lists
     * @param parentObjectApiName The API name of the parent object for the related lists
     * @param relatedListIds Comma separated IDs of supported related lists for the specified parent object
     */
    export function getRelatedListInfoBatch(parentObjectApiName: string | ObjectId, relatedListIds: Array<string>): void;

    /** Gets a collection of metadata for all the related lists for a specific entity
     *
     * @param parentObjectApiName The API name of the parent object
     */
    export function getRelatedListsInfo(parentObjectApiName?: string | ObjectId): void;

    /**
     * Gets a colllection of records for a given record and related list
     * @param parentRecordId The record ID of the parent record for the related list
     * @param relatedListId The ID of the related list
     */
    export function getRelatedListRecords(parentRecordId: string, relatedListId: string): void;

    /**
     *  Gets record data for a batch of related lists
     * @param parentRecordId The ID of the parent record you want to get related lists for
     * @param relatedListIds Comma separated IDs of supported related lists for the specified parent record
     */
    export function getRelatedListRecordsBatch(parentRecordId: string, relatedListIds: Array<string>): void;

    /**
     * Gets the count of records for a related list on a specific given record
     * @param parentRecordId The record ID of the parent record for the related list
     * @param relatedListId The ID of the related list
     */
    export function getRelatedListCount(parentRecordId: string, relatedListId: string): void;
}

declare module 'lightning/uiObjectInfoApi' {
    /**
     * Identifier for an object.
     */
    export interface ObjectId {
        /** The object's API name. */
        objectApiName: string;
    }

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
     * Gets the metadata for a specific object.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_object_info
     *
     * @param objectApiName The API name of the object to retrieve.
     */
    export function getObjectInfo(objectApiName: string | ObjectId): void;

    /**
     * Wire adapter for multiple object metadatas.
     *
     * @param objectApiNames The API names of the objects to retrieve.
     */
    export function getObjectInfos(objectApiNames: Array<string | ObjectId>): void;

    /**
     * Wire adapter for values for a picklist field.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_picklist_values
     *
     * @param fieldApiName The picklist field's object-qualified API name.
     * @param recordTypeId The record type ID. Pass '012000000000000AAA' for the master record type.
     */
    export function getPicklistValues(fieldApiName: string | FieldId, recordTypeId: string): void;

    /**
     * Wire adapter for values for all picklist fields of a record type.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_picklist_values_record
     *
     * @param objectApiName API name of the object.
     * @param recordTypeId Record type ID. Pass '012000000000000AAA' for the master record type.
     */
    export function getPicklistValuesByRecordType(objectApiName: string, recordTypeId: string): void;
}

/**
 * JavaScript API to Create and Update Records.
 */
declare module 'lightning/uiRecordApi' {
    /**
     * Identifier for an object.
     */
    export interface ObjectId {
        /** The object's API name. */
        objectApiName: string;
    }

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
     * Contains both the raw and displayable field values for a field in a Record.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_responses_field_value.htm
     *
     * Keys:
     *    (none)
     */
    export interface FieldValueRepresentation {
        displayValue: string | null;
        value: RecordRepresentation | boolean | number | string | null;
    }
    export type FieldValueRepresentationValue = FieldValueRepresentation['value'];

    /**
     * Record Collection Representation.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_responses_record_collection.htm
     *
     * Keys:
     *    (none)
     */
    export interface RecordCollectionRepresentation {
        count: number;
        currentPageToken: string | null;
        currentPageUrl: string;
        nextPageToken: string | null;
        nextPageUrl: string | null;
        previousPageToken: string | null;
        previousPageUrl: string | null;
        records: Array<RecordRepresentation>;
    }

    /**
     * Record type.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_responses_record_type_info.htm
     *
     * Keys:
     *    (none)
     */
    export interface RecordTypeInfoRepresentation {
        available: boolean;
        defaultRecordTypeMapping: boolean;
        master: boolean;
        name: string;
        recordTypeId: string;
    }

    /**
     * Record.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_responses_record.htm
     *
     * Keys:
     *    recordId (string): id
     */
    export interface RecordRepresentation {
        apiName: string;
        childRelationships: {
            [key: string]: RecordCollectionRepresentation;
        };
        eTag: string;
        fields: {
            [key: string]: FieldValueRepresentation;
        };
        id: string;
        lastModifiedById: string | null;
        lastModifiedDate: string | null;
        recordTypeId: string | null;
        recordTypeInfo: RecordTypeInfoRepresentation | null;
        systemModstamp: string | null;
        weakEtag: number;
    }

    /**
     * Description of a record input.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_requests_record_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface RecordInputRepresentation {
        allowSaveOnDuplicate?: boolean;
        apiName?: string;
        fields: {
            [key: string]: string | number | null | boolean;
        };
    }

    export interface ClientOptions {
        ifUnmodifiedSince?: string;
    }

    /**
     * Child Relationship.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_responses_child_relationship.htm
     *
     * Keys:
     *    (none)
     */
    export interface ChildRelationshipRepresentation {
        childObjectApiName: string;
        fieldName: string;
        junctionIdListNames: Array<string>;
        junctionReferenceTo: Array<string>;
        relationshipName: string;
    }

    /**
     * Information about a reference field's referenced types and the name field names of those types.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_responses_reference_to_info.htm
     *
     * Keys:
     *    (none)
     */
    export interface ReferenceToInfoRepresentation {
        apiName: string;
        nameFields: Array<string>;
    }

    /**
     * Filtered lookup info.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_responses_filtered_lookup_info.htm
     *
     * Keys:
     *    (none)
     */
    export interface FilteredLookupInfoRepresentation {
        controllingFields: Array<string>;
        dependent: boolean;
        optionalFilter: boolean;
    }

    export const enum ExtraTypeInfo {
        ExternalLookup = 'ExternalLookup',
        ImageUrl = 'ImageUrl',
        IndirectLookup = 'IndirectLookup',
        PersonName = 'PersonName',
        PlainTextArea = 'PlainTextArea',
        RichTextArea = 'RichTextArea',
        SwitchablePersonName = 'SwitchablePersonName',
    }

    export const enum RecordFieldDataType {
        Address = 'Address',
        Base64 = 'Base64',
        Boolean = 'Boolean',
        ComboBox = 'ComboBox',
        ComplexValue = 'ComplexValue',
        Currency = 'Currency',
        Date = 'Date',
        DateTime = 'DateTime',
        Double = 'Double',
        Email = 'Email',
        EncryptedString = 'EncryptedString',
        Int = 'Int',
        Location = 'Location',
        MultiPicklist = 'MultiPicklist',
        Percent = 'Percent',
        Phone = 'Phone',
        Picklist = 'Picklist',
        Reference = 'Reference',
        String = 'String',
        TextArea = 'TextArea',
        Time = 'Time',
        Url = 'Url',
    }

    /**
     * Field metadata.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_responses_field.htm
     *
     * Keys:
     *    (none)
     */
    export interface FieldRepresentation {
        apiName: string;
        calculated: boolean;
        compound: boolean;
        compoundComponentName: string | null;
        compoundFieldName: string | null;
        controllerName: string | null;
        controllingFields: Array<string>;
        createable: boolean;
        custom: boolean;
        dataType: string;
        extraTypeInfo: string | null;
        filterable: boolean;
        filteredLookupInfo: FilteredLookupInfoRepresentation | null;
        highScaleNumber: boolean;
        htmlFormatted: boolean;
        inlineHelpText: string | null;
        label: string;
        length: number;
        nameField: boolean;
        polymorphicForeignKey: boolean;
        precision: number;
        reference: boolean;
        referenceTargetField: string | null;
        referenceToInfos: Array<ReferenceToInfoRepresentation>;
        relationshipName: string | null;
        required: boolean;
        scale: number;
        searchPrefilterable: boolean;
        sortable: boolean;
        unique: boolean;
        updateable: boolean;
    }

    /**
     * Theme info.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_responses_theme_info.htm
     *
     * Keys:
     *    (none)
     */
    export interface ThemeInfoRepresentation {
        color: string;
        iconUrl: string | null;
    }

    /**
     * Object metadata.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_responses_object_info.htm
     *
     * Keys:
     *    apiName (string): apiName
     */
    export interface ObjectInfoRepresentation {
        apiName: string;
        associateEntityType: string | null;
        associateParentEntity: string | null;
        childRelationships: Array<ChildRelationshipRepresentation>;
        createable: boolean;
        custom: boolean;
        defaultRecordTypeId: string | null;
        deletable: boolean;
        dependentFields: {
            [key: string]: {};
        };
        eTag: string;
        feedEnabled: boolean;
        fields: {
            [key: string]: FieldRepresentation;
        };
        keyPrefix: string | null;
        label: string;
        labelPlural: string;
        layoutable: boolean;
        mruEnabled: boolean;
        nameFields: Array<string>;
        queryable: boolean;
        recordTypeInfos: {
            [key: string]: RecordTypeInfoRepresentation;
        };
        searchable: boolean;
        themeInfo: ThemeInfoRepresentation | null;
        updateable: boolean;
    }

    /**
     * Wire adapter for a record.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_record
     *
     * @param recordId ID of the record to retrieve.
     * @param fields Object-qualified field API names to retrieve. If a field isn’t accessible to the context user, it causes an error.
     *               If specified, don't specify layoutTypes.
     * @param layoutTypes Layouts defining the fields to retrieve. If specified, don't specify fields.
     * @param modes Layout modes defining the fields to retrieve.
     * @param optionalFields Object-qualified field API names to retrieve. If an optional field isn’t accessible to the context user,
     *                       it isn’t included in the response, but it doesn’t cause an error.
     * @returns An observable of the record.
     */
    export function getRecord(
        recordId: string,
        fields?: Array<string | FieldId>,
        layoutTypes?: string[],
        modes?: string[],
        optionalFields?: Array<string | FieldId>,
    ): void;

    /**
     * Wire adapter for default field values to create a record.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_create_record_values
     *
     * @param objectApiName API name of the object.
     * @param formFactor Form factor. Possible values are 'Small', 'Medium', 'Large'. Large is default.
     * @param recordTypeId Record type id.
     * @param optionalFields Object-qualified field API names to retrieve. If an optional field isn’t accessible to the context user,
     *                       it isn’t included in the response, but it doesn’t cause an error.
     */
    export function getRecordCreateDefaults(
        objectApiName: string | ObjectId,
        formFactor?: string,
        recordTypeId?: string,
        optionalFields?: Array<string | FieldId>,
    ): void;

    /**
     * Wire adapter for record data, object metadata and layout metadata
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_record_ui
     *
     * @param recordIds ID of the records to retrieve.
     * @param layoutTypes Layouts defining the fields to retrieve.
     * @param modes Layout modes defining the fields to retrieve.
     * @param optionalFields Object-qualified field API names to retrieve. If an optional field isn’t accessible to the context user,
     *                       it isn’t included in the response, but it doesn’t cause an error.
     */
    export function getRecordUi(
        recordIds: string | string[],
        layoutTypes: string | string[],
        modes: string | string[],
        optionalFields: Array<string | FieldId>,
    ): void;

    /**
     * Updates a record using the properties in recordInput. recordInput.fields.Id must be specified.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_update_record
     *
     * @param recordInput The record input representation to use to update the record.
     * @param clientOptions Controls the update behavior. Specify ifUnmodifiedSince to fail the save if the record has changed since the provided value.
     * @returns A promise that will resolve with the patched record.
     */
    export function updateRecord(recordInput: RecordInputRepresentation, clientOptions?: ClientOptions): Promise<RecordRepresentation>;

    /**
     * Creates a new record using the properties in recordInput.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_create_record
     *
     * @param recordInput The RecordInput object to use to create the record.
     * @returns A promise that will resolve with the newly created record.
     */
    export function createRecord(recordInput: RecordInputRepresentation): Promise<RecordRepresentation>;

    /**
     * Deletes a record with the specified recordId.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_delete_record
     *
     * @param recordId ID of the record to delete.
     * @returns A promise that will resolve to undefined.
     */
    export function deleteRecord(recordId: string): Promise<undefined>;

    /**
     * Returns an object with its data populated from the given record. All fields with values that aren't nested records will be assigned.
     * This object can be used to create a record with createRecord().
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_generate_record_input_create
     *
     * @param record The record that contains the source data.
     * @param objectInfo The ObjectInfo corresponding to the apiName on the record. If provided, only fields that are createable=true
     *        (excluding Id) are assigned to the object return value.
     * @returns RecordInput
     */
    export function generateRecordInputForCreate(record: RecordRepresentation, objectInfo?: ObjectInfoRepresentation): RecordInputRepresentation;

    /**
     * Returns an object with its data populated from the given record. All fields with values that aren't nested records will be assigned.
     * This object can be used to update a record.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_generate_record_input_update
     *
     * @param record The record that contains the source data.
     * @param objectInfo The ObjectInfo corresponding to the apiName on the record.
     *        If provided, only fields that are updateable=true (excluding Id) are assigned to the object return value.
     * @returns RecordInput.
     */
    export function generateRecordInputForUpdate(record: RecordRepresentation, objectInfo?: ObjectInfoRepresentation): RecordInputRepresentation;

    /**
     * Returns a new RecordInput containing a list of fields that have been edited from their original values. (Also contains the Id
     * field, which is always copied over.)
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_create_record_input_update
     *
     * @param recordInput The RecordInput object to filter.
     * @param originalRecord The Record object that contains the original field values.
     * @returns RecordInput.
     */
    export function createRecordInputFilteredByEditedFields(
        recordInput: RecordInputRepresentation,
        originalRecord: RecordRepresentation,
    ): RecordInputRepresentation;

    /**
     * Gets a field's value from a record.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_get_field_value
     *
     * @param record The record.
     * @param field Object-qualified API name of the field to return.
     * @returns The field's value (which may be a record in the case of spanning fields), or undefined if the field isn't found.
     */
    export function getFieldValue(record: RecordRepresentation, field: FieldId | string): FieldValueRepresentationValue | undefined;

    /**
     * Gets a field's display value from a record.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_get_field_display_value
     *
     * @param record The record.
     * @param field Object-qualified API name of the field to return.
     * @returns The field's display value, or undefined if the field isn't found.
     */
    export function getFieldDisplayValue(record: RecordRepresentation, field: FieldId | string): FieldValueRepresentationValue | undefined;
}

declare module 'lightning/industriesEducationPublicApi' {
    /**
     * Representation of the benefit assignment record updated with provider information.
     * Keys:
     *    id (string): id
     */
    export interface MentoringBenefitAssignment {
        /** The ID of the benefit associated with the benefit assignment. */
        benefitId: string;
        /** The contact ID of the provider associated with the benefit assignment. */
        providerId: string;
        /** The ID of the user who created the benefit assignment. */
        createdById: string;
        /** The date that the benefit assignment was created. */
        createdDate: string;
        /** The last date and time that the benefit assignment is available. */
        endDateTime: string;
        /** The ID of the enrollee assoicated with the benefit assignment. */
        enrolleeId: string;
        /** The default quantity associated with the benefit assignment. */
        enrollmentCount: string;
        /** The amount of the entitlement associated with the benefit assignment. */
        entitlementAmount: string;
        /** The ID of the benefit assignment */
        id: string;
        /** The ID of the user who updated the benefit assignment. */
        lastModifiedById: string;
        /** The date of the most recent update to the benefit assignment. */
        lastModifiedDate: string;
        /** The maximum amount of the benefit associated with the benefit assignment. */
        maximumBenefitAmount: string;
        /** The minimum amount of the benefit associated with the benefit. */
        minimumBenefitAmount: string;
        /** The name of the benefit assignment. */
        name: string;
        /** The ID of the parent record associated with the benefit assignment. */
        parentRecordId: string;
        /** The priority associated with the benefit assignment. */
        priority: string;
        /** The ID of the program enrollment created for the participant to whom you want to assign this benefit. */
        programEnrollmentId: string;
        /** The date and time when the benefit assignment is first available. */
        startDateTime: string;
        /** The status associated with the benefit assignment. */
        status: string;
        /** The status of the task job associated with the benefit assignment. */
        taskJobStatus: string;
        /** The status message of the task job associated with the benefit assignment. */
        taskJobStatusMessage: string;
        /** The ID of the unit of measure associated with the benefit assignment. */
        unitOfMeasureId: string;
    }

    /**
     * Representation of the output for the benefit assignment request.
     */
    export interface MentoringBenefitAssignmentOutputRepresentation {
        /** Representation of the benefit assignment record updated with provider information. */
        mentoringBenefitAssignment: MentoringBenefitAssignment;
    }

    /**
     * Return the benefit assignment record with updated provider record lookup.
     * @param benefitAssignmentId The ID of the benefit assignment record.
     * @param providerId The ID of the provider offering associated with the benefit assignment.
     */
    export function postBenefitAssignment({
        benefitAssignmentId,
        providerId,
    }: {
        benefitAssignmentId: string;
        providerId: string;
    }): Promise<MentoringBenefitAssignmentOutputRepresentation>;
}

declare module 'lightning/industriesSchedulerApi' {
    /**
     * Wire adapter for getting Engagment ChannelTypes.
     */
    export function getEngagementChannelTypes(): void;

    /**
     * Wire adapter for creating a Service Appointment.
     */
    export function createServiceAppointment(): void;

    /**
     * Wire adapter for updating a Service Appointment.
     */
    export function updateServiceAppointment(): void;
}

declare module 'lightning/platformScaleCenterApi' {
    /**
     * Wire adapter for a Scale Center observability metrics.
     *
     * @param request a serialized list of ScaleCenterRequests that define which metrics are to be queried
     * @returns a serialized list of the requested metric data
     */
    export function getMetrics(request: string): void;
}

declare module 'lightning/placeQuoteApi' {
    /**
     * Wire adapter for updates using Place Quote API
     */
    export function updateQuote(): void;
}

declare module 'lightning/salesAutomationRulesApi' {
    /**
     * Wire adapter for Automation Rules apply reminder
     *
     * @param id the ID string of the reminder to be applied
     */
    export function applyReminder(id: string): void;
}

declare module 'lightning/salesEnablementProgramApi' {
    /**
     * Wire adapter for getting Sales Enablement Program templates list.
     */
    export function getProgramTemplates(): void;

    /**
     * Wire adapter for getting Sales Enablement Program details of the programTemplateName passed as url param.
     * @param programTemplateName name of the template for which details are required
     */
    export function getProgramTemplate(programTemplateName: string): void;
}

declare module 'lightning/salesUserWorkingHoursApi' {
    /**
     * Wire adapter for getting sales user working hours availability.
     */
    export function getSalesUserWorkingHours(): void;

    /**
     * Wire adapter for updating sales user working hours availability.
     */
    export function updateSalesUserWorkingHours(): void;

    /**
     * Wire adapter for creating sales user working hours availability.
     */
    export function createSalesUserWorkingHours(): void;

    /**
     * Wire adapter for deleting sales user working hours availability.
     */
    export function deleteSalesUserWorkingHours(): void;
}

declare module 'lightning/salesEngagementWorkspaceApi' {
    /**
     * Wire adapter for getting sales user workspace personalization.
     */
    export function getWorkspaceUserPersonalization(): void;

    /**
     * Wire adapter for getting sales user workspace supported objects.
     */
    export function getEngagementWorkspaceObjects(): void;

    /**
     * Wire adapter for updating sales user workspace personalization.
     */
    export function updateWorkspaceUserPersonalization(): void;

    /**
     * Wire adapter for deleting sales user workspace personalization.
     */
    export function deleteWorkspaceUserPersonalization(): void;
}

declare module 'lightning/analyticsWaveApi' {
    /**
     * A Tableau CRM dataflow node.
     *
     * Keys:
     *    (none)
     */
    export interface AbstractDataflowNodeRepresentation {
        /** Node action */
        action: string;
        /** Node sources */
        sources: Array<string>;
    }

    /**
     * Base representation for fields in Tableau CRM.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#AbstractFieldRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface AbstractFieldRepresentation {
        defaultValue?: string | number | null | boolean;
        description?: string;
        fieldType: string;
        format?: string;
        label: string;
        multiValue?: boolean;
        multiValueSeparator?: string;
        name: string;
        precision?: number;
        scale?: number;
        systemField?: boolean;
        uniqueId?: boolean;
    }

    /**
     * Wave Data Connector Advanced Property input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_advanced_property_value_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface AdvancedPropertyValueInputRepresentation {
        /** The name of the advanced property. */
        name: string;
        /** The value of the advanced property */
        value: string;
    }

    /**
     * An advanced property Name and Value.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#AdvancedPropertyValueReprensentation
     *
     * Keys:
     *    (none)
     */
    export interface AdvancedPropertyValueRepresentation {
        name: string;
        value: string;
    }

    /**
     * Asset reference representation.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#AssetReferenceRepresentation
     *
     * Keys:
     *    (none)
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface AssetReferenceRepresentation extends BaseAssetReferenceRepresentation {}

    /**
     * Simple, reference input representation for wave assets.
     *
     * Keys:
     *    (none)
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface AssetReferenceInputRepresentation extends BaseAssetReferenceInputRepresentation {}

    /**
     * Base Tableau CRM Asset input Representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#BaseAssetInputRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface BaseAssetInputRepresentation {
        description?: string;
        label?: string;
        name?: string;
    }

    /**
     * Base class for Asset reference input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#AssetReferenceInputRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface BaseAssetReferenceInputRepresentation {
        /** ID of the asset */
        id?: string;
        /** Developer name of the asset */
        name?: string;
        /** The namespace that qualifies the asset name */
        namespace?: string;
    }

    /**
     * Base asset reference representation.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#AssetReferenceRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface BaseAssetReferenceRepresentation {
        /** The 18 character ID of the asset. */
        id: string;
        /** The asset label. */
        label?: string;
        /** The asset developer name. */
        name?: string;
        /** The namespace that qualifies the asset name */
        namespace?: string;
        /** The asset URL. */
        url?: string;
    }

    /**
     * Base Tableau CRM asset representation.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#BaseWaveAssetRepresentation
     * Keys:
     *    id (string): id
     */
    export interface BaseWaveAssetRepresentation {
        /** Sharing URL for the asset. */
        assetSharingUrl?: string | null;
        /** The user that created the asset. */
        createdBy?: WaveUserRepresentation;
        /** Time the asset was created. */
        createdDate?: string;
        /** Short description of the asset. */
        description?: string;
        /** The 18 character asset ID. */
        id: string;
        /** The label of the asset. */
        label?: string;
        /** Last time the asset was accessed. */
        lastAccessedDate?: string | null;
        /** The user that last updated the asset. */
        lastModifiedBy?: WaveUserRepresentation | null;
        /** Last time the asset was modified. */
        lastModifiedDate?: string | null;
        /** The name of the asset. */
        name?: string;
        /** The namespace of the Asset. */
        namespace?: string;
        /** Represents permissions for the present user. */
        permissions?: PermissionsRepresentation | null;
        /** The asset type. */
        type: string;
        /** URL to get the definition of the asset. */
        url: string;
    }

    /**
     * Extended metadata for property in conditional formatting linked to a Dimension / Measure.
     *
     * Keys:
     *    (none)
     */
    export interface ConditionalFormattingPropertyInputRepresentation {
        /** Valid conditional formatting parameters based on its type */
        parameters?: {
            [key: string]: unknown;
        };
        /** Conditional Formatting based on Reference field if any. */
        referenceField?: string;
        /** The type of the conditional formatting */
        type?: string;
    }

    /**
     * A Connection Property Name and Value.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_dataconnectors.htm#ConnectionPropertyValueRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface ConnectionPropertyValueRepresentation {
        name: string;
        value: string | number | boolean;
    }

    /**
     * Daily schedule on which to execute some type of job.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#DailyScheduleInputRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface DailyScheduleInputRepresentation extends ScheduleInputRepresentation {
        frequency: 'daily' | 'Daily';
    }

    /**
     * Daily schedule on which to execute some type of job.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#DailyScheduleRepresentation
     *
     * Keys:
     *    id (string): assetId
     */
    export interface DailyScheduleRepresentation extends ScheduleRepresentation {
        frequency: 'daily' | 'Daily';
    }

    /**
     * Tableau CRM Data Connector input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_dataconnectors.htm#DataConnectorInputRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface DataConnectorInputRepresentation extends BaseAssetInputRepresentation {
        /** Connection properties for the connector */
        connectionProperties?: Array<any>;
        /** Third party driver used for connection */
        connectorHandler?: string;
        /** The type of the Data Connector. */
        connectorType?: string;
        /** Folder for the Live connector */
        folder?: {
            [key: string]: string;
        };
        /** AssetReference containing ID or API name of target connector associated with the current source connector */
        targetConnector?: {
            [key: string]: string;
        };
    }

    /**
     * A Data Connector represents a connection.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_dataconnectors.htm#DataConnectorRepresentation
     *
     * Keys:
     *    id (string): id
     */
    export interface DataConnectorRepresentation extends BaseWaveAssetRepresentation {
        connectionProperties: Array<ConnectionPropertyValueRepresentation>;
        connectorHandler?: string;
        connectorType: string;
        folder?: AssetReferenceRepresentation;
        ingestionSchedule:
            | HourlyScheduleRepresentation
            | MonthlySpecificScheduleRepresentation
            | MinutelyScheduleRepresentation
            | EventDrivenScheduleRepresentation
            | WeeklyScheduleRepresentation
            | MonthlyRelativeScheduleRepresentation
            | DailyScheduleRepresentation
            | EmptyScheduleRepresentation;
        targetConnector?: AssetReferenceRepresentation;
        type: 'dataConnector';
    }

    /**
     * A collection of Dataflows.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_dataflows.htm#DataflowCollectionRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface DataflowCollectionRepresentation {
        dataflows: Array<DataflowRepresentation>;
    }

    /**
     * A Tableau CRM dataflow definition.
     *
     * Keys:
     *    (none)
     */
    export interface DataflowDefinitionRepresentation {
        /** node definitions */
        nodes: {
            [key: string]: AbstractDataflowNodeRepresentation;
        };
    }

    /**
     * DataflowJob input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_dataflowjobs_id.htm#DataflowJobInputRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface DataflowJobInputRepresentation {
        /** Dataflow Job command */
        command: string;
        /** Dataflow ID */
        dataflowId?: string;
    }

    /**
     * Tableau CRM dataflow job representation.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_dataflowjobs_id.htm#DataflowJobRepresentation
     *
     * Keys:
     *    id (string): id
     */
    export interface DataflowJobRepresentation extends BaseWaveAssetRepresentation {
        /** The runtime in seconds of a dataflow job */
        duration?: number;
        /** The start date of a job's execution. */
        executedDate?: string | null;
        /** The type of a job */
        jobType: string;
        /** The analytics license type and other properties */
        licenseAttributes?: LicenseAttributesRepresentation | null;
        /** The error or informational message of a dataflow job */
        message?: string | null;
        /** The URL of job nodes */
        nodesUrl: string;
        /** The progress of a job */
        progress: number;
        /** The source of a job */
        source?: AssetReferenceRepresentation | null;
        /** The start date of a dataflow job */
        startDate?: string;
        /** The runtime status of a dataflow job */
        status: string;
        /** The dataflows to sync when the job is triggered. */
        syncDataflows: DataflowCollectionRepresentation;
        type: 'DataflowJob';
    }

    /**
     * Tableau CRM dataflow asset representation.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_dataflows_id.htm#DataflowRepresentation
     *
     * Keys:
     *    id (string): id
     */
    export interface DataflowRepresentation extends BaseWaveAssetRepresentation {
        /** Current version of dataflow. */
        current?: DataflowVersionRepresentation | null;
        /** The representation of the dataflow nodes */
        definition: {
            [key: string]: string;
        };
        /** Email notification level of dataflow. */
        emailNotificationLevel?: string | null;
        /** The URL for the dataflow histories associated with the dataflow. */
        historiesUrl?: string | null;
        /** Next scheduled run of dataflow. */
        nextScheduledDate?: string | null;
        /** Schedule attributes of dataflow. */
        scheduleAttributes?: string | null;
        type: 'Dataflow';
    }

    /**
     * A Tableau CRM dataflow version.
     *
     * Keys:
     *    (none)
     */
    export interface DataflowVersionRepresentation {
        /** The user that created the asset. */
        createdBy: WaveUserRepresentation;
        /** Time the asset was created. */
        createdDate: string;
        /** Dataflow definition */
        definition: DataflowDefinitionRepresentation;
        /** The 18 character asset ID. */
        id: string;
    }

    /** Wave Dataset input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_dataset_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface DatasetInputRepresentation extends BaseAssetInputRepresentation {
        /** Type of the dataset */
        datasetType?: string;
        /** Folder in which this dataset is stored */
        folder?: AssetReferenceInputRepresentation;
        liveConnection?: LiveConnectionInputRepresentation;
        userXmd?: XmdInputRepresentation;
        /** If dataset should be hidden from users with view access */
        visibility?: string;
    }

    /**
     * A Wave dataset.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_dataset.htm
     *
     * Keys:
     *    id (string): id
     */
    export interface DatasetRepresentation extends BaseWaveAssetRepresentation {
        /** The URL for dataset shards. */
        clientShardsUrl?: string;
        currentVersionCreatedBy?: WaveUserRepresentation;
        /** Date on which the current version was created. */
        currentVersionCreatedDate?: string;
        /** The 18 character ID of the current DatasetVersion. */
        currentVersionId?: string;
        currentVersionLastModifiedBy?: WaveUserRepresentation;
        /** Date on which the current version was last modified. */
        currentVersionLastModifiedDate?: string;
        /** Current dataset version supports new date format */
        currentVersionSupportsNewDates?: boolean;
        /** The total number of rows in the dataset. */
        currentVersionTotalRowCount?: number;
        /** The URL for the current DatasetVersion. */
        currentVersionUrl?: string;
        /** Date/time when this dataset was last updated by a dataflow. */
        dataRefreshDate?: string;
        /** The type of the dataset. */
        datasetType: string;
        /** A reference to the folder in which this dataset is stored. */
        folder: AssetReferenceRepresentation;
        /** Date/time when the metadata(Edgemart's Folder, MasterLabel, Current, EdgemartData's Sharing and security predicate) of dataset was last changed. */
        lastMetadataChangedDate?: string;
        /** Date/time when this dataset was last queried. */
        lastQueriedDate?: string;
        licenseAttributes?: LicenseAttributesRepresentation;
        liveConnection?: LiveConnectionRepresentation;
        userXmd?: XmdInnerRepresentation;
        /** The URL for dataset versions. */
        versionsUrl: string;
        /** If dataset should be hidden from users with view access */
        visibility: string;
    }

    /**
     * Input representation for wave Dataset Version.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_dataset_version_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface DatasetVersionInputRepresentation {
        /** Indicates whether the Dataset Version is complete */
        isComplete?: boolean;
        /** The row level security predicate to be applied to this Dataset Version. */
        predicate?: string;
        /** Entity from which sharing rules should be inherited */
        sharingSource?: AssetReferenceInputRepresentation | null;
        /** The total number of rows for the dataset version */
        totalRowCount?: number;
    }

    /**
     * An instantiated version of a Wave dataset.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_dataset_version.htm
     *
     * Keys:
     *    id (string): id
     */
    export interface DatasetVersionRepresentation extends BaseWaveAssetRepresentation {
        /** A reference to the dataset. */
        dataset?: AssetReferenceRepresentation;
        /** Information about the data files that make up the dataset version. */
        files?: Array<WaveFileMetadataRepresentation>;
        /** The URL of the files resource for this dataset version. */
        filesUrl?: string;
        /** The row level security predicate. */
        predicate?: string;
        /** The version of the row level security predicate. */
        predicateVersion?: number;
        /** Dataset sharing inheritance coverage information resource. */
        securityCoverageUrl: string;
        /** Entity from which sharing rules will be inherited for this dataset version */
        sharingSource?: DatasetVersionSharingSourceRepresentation;
        /** The parent dataflow or file for this dataset version. */
        source?: AssetReferenceRepresentation;
        /** Dataset version supports new date format */
        supportsNewDates?: boolean;
        /** Total number of rows for this dataset version */
        totalRowCount?: number;
        xmdMain?: XmdInnerRepresentation;
        /** The URL of the Xmd Collection resource for this dataset version. */
        xmdsUrl?: string;
    }

    /**
     * Asset reference representation.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_asset_reference.htm
     *
     * Keys:
     *    (none)
     */
    export interface DatasetVersionSharingSourceRepresentation {
        /** The asset developer name. */
        name: string;
        /** The namespace that qualifies the asset name */
        namespace?: string;
    }

    /**
     * Represents an empty schedule on an asset
     *
     * Keys:
     *    id (string): assetId
     */
    export interface EmptyScheduleRepresentation extends ScheduleRepresentation {
        frequency: 'none' | 'None';
    }

    /**
     * A schedule triggered by an event, e.g., the completion of a data sync job.
     *
     * Keys:
     *    (none)
     */
    export interface EventBasedScheduleInputRepresentation extends ScheduleInputRepresentation {
        frequency: 'eventdriven' | 'EventDriven';
        /** The expression defining the events that trigger the scheduling of the target asset. Currently, only accepting scheduling of Dataflows and Recipes as the target asset. */
        triggerRule?: string;
    }

    /**
     * A schedule triggered by an event, e.g., the completion of a data sync job.
     *
     * Keys:
     *    id (string): assetId
     */
    export interface EventDrivenScheduleRepresentation extends ScheduleRepresentation {
        frequency: 'eventdriven' | 'EventDriven';
    }

    /**
     * A schedule which can run multiple times a day.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#HourlyScheduleInputRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface HourlyScheduleInputRepresentation extends ScheduleInputRepresentation {
        frequency: 'hourly' | 'Hourly';
        /** Days of the week on which the schedule will run. */
        daysOfWeek: Array<string>;
        /** Hours in between each queueing of task. */
        hourlyInterval: number;
        /** Hour at which schedule stops queueing. */
        lastHour?: number;
    }

    /**
     * A schedule which can run multiple times a day.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#HourlyScheduleRepresentation
     *
     * Keys:
     *    id (string): assetId
     */
    export interface HourlyScheduleRepresentation extends ScheduleRepresentation {
        frequency: 'hourly' | 'Hourly';
        /** Days of the week on which the schedule will run. */
        daysOfWeek: Array<string>;
        /** Hours in between each queueing of task. */
        hourlyInterval: number;
        /** Hour at which schedule stops queueing. */
        lastHour?: number;
    }

    /**
     * Input representation for analytics license attributes.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_license_attributes_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface LicenseAttributesInputRepresentation {
        /** Analytics license type associated with the asset. */
        type: string;
    }

    /**
     * The analytics license type and other properties
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_limits.htm#LicenseAttributesRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface LicenseAttributesRepresentation {
        /** The associated analytics license type */
        type: string;
    }

    /**
     * Connection details of a live dataset
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_live_connection.htm
     *
     * Keys:
     *    (none)
     */
    export interface LiveConnectionRepresentation {
        /** The label of the connection */
        connectionLabel: string;
        /** The developer name of the connection */
        connectionName: string;
        /** The type of the connection */
        connectionType: string;
        /** The source object name from the connection */
        sourceObjectName: string;
    }

    /**
     * Connection details for a live dataset
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_live_connection_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface LiveConnectionInputRepresentation {
        /** The developer name of the connection */
        connectionName: string;
        /** The source object name from the connection */
        sourceObjectName: string;
    }

    /**
     * A schedule which can run multiple times an hour.
     *
     * Keys:
     *    (none)
     */
    export interface MinutelyScheduleInputRepresentation extends ScheduleInputRepresentation {
        frequency: 'minutely' | 'Minutely';
        /** Days of the week on which the schedule will run. */
        daysOfWeek: Array<string>;
        /** Hour at which schedule stops queueing. */
        lastHour?: number;
        /** Minutes in between each queueing of task. */
        minutelyInterval: number;
    }

    /**
     * A schedule which can run multiple times an hour.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#MinutelyScheduleRepresentation
     *
     * Keys:
     *    id (string): assetId
     */
    export interface MinutelyScheduleRepresentation extends ScheduleRepresentation {
        frequency: 'minutely' | 'Minutely';
        /** Days of the week on which the schedule will run. */
        daysOfWeek: Array<string>;
        /** Hour at which schedule stops queueing. */
        lastHour?: number;
        /** Minutes in between each queueing of task. */
        minutelyInterval: number;
    }

    /**
     * Schedule which runs monthly on a relative day within the month.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#MonthlyRelativeScheduleInputRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface MonthlyRelativeScheduleInputRepresentation extends ScheduleInputRepresentation {
        frequency: 'monthlyrelative' | 'MonthlyRelative';
        /** Day within a week. */
        dayInWeek: string;
        /** Week within a month. */
        weekInMonth: string;
    }

    /**
     * Schedule which runs monthly on a relative day within the month.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#MonthlyRelativeScheduleRepresentation
     *
     * Keys:
     *    id (string): assetId
     */
    export interface MonthlyRelativeScheduleRepresentation extends ScheduleRepresentation {
        frequency: 'monthlyrelative' | 'MonthlyRelative';
        /** Day within a week. */
        dayInWeek: string;
        /** Week within a month. */
        weekInMonth: string;
    }

    /**
     * A schedule which runs once a month on specific (numerical) days of the month or on the 'last' day of the month.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#MonthlySpecificScheduleInputRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface MonthlySpecificScheduleInputRepresentation extends ScheduleInputRepresentation {
        frequency: 'monthly' | 'Monthly';
        /** Days of the month on which the schedule will run (-1, 1-31). Note that months lacking specific days will skip the job. Can specify a single value of -1 to indicate the last day of the month (-1 cannot be used with additional days). */
        daysOfMonth: Array<number>;
    }

    /**
     * A schedule which runs once a month on specific (numerical) days of the month or on the 'last' day of the month.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#MonthlySpecificScheduleRepresentation
     *
     * Keys:
     *    id (string): assetId
     */
    export interface MonthlySpecificScheduleRepresentation extends ScheduleRepresentation {
        frequency: 'monthly' | 'Monthly';
        /** Days of the month on which the schedule will run (-1, 1-31). Note that months lacking specific days will skip the job. Can specify a single value of -1 to indicate the last day of the month (-1 cannot be used with additional days). */
        daysOfMonth: Array<number>;
    }

    /**
     * Wave XMD measure format number input representation with numeric separators
     *
     * Keys:
     *    (none)
     */
    export interface NumericSeparatorsInputRepresentation {
        /** Decimal separator */
        decimal?: string;
        /** Thousands separator */
        thousands?: string;
    }

    /**
     * Thousands and decimal numeric separators
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_numeric_separators.htm
     *
     * Keys:
     *    (none)
     */
    export interface NumericSeparatorsRepresentation {
        /** Decimal separator */
        decimal?: string;
        /** Thousand separator */
        thousands?: string;
    }

    /**
     * output source for output objects
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_replicateddatasets.htm#OutputSourceRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface OutputSourceRepresentation {
        inputRows?: number;
        isSyncOut: boolean;
        name: string;
        nextScheduledDate?: string;
        outputRows?: number;
    }

    /**
     * Permissions of the user on an asset.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#PermissionsRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface PermissionsRepresentation {
        /** The value which indicates whether the user can create an asset */
        create?: boolean;
        /** The value which indicates whether the user can manage access control on an asset */
        manage?: boolean;
        /** The value which indicates whether the user can modify an asset */
        modify?: boolean;
        /** The value which indicates whether the user can view an asset. */
        view?: boolean;
    }

    /**
     * Replicates data from an external source object into Tableau CRM as a dataset. Replicated Datasets are not intended to be visualized directly, but are used like a cache to speed up other workflows which refer to the same source object.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_replicateddatasets.htm#ReplicatedDatasetInputRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface ReplicatedDatasetInputRepresentation {
        advancedProperties?: Array<{
            [key: string]: any;
        }>;
        connectionMode?: string;
        connectorId?: string;
        fullRefresh?: boolean;
        passThroughFilter?: string;
        rowLevelSharing?: boolean;
        sourceObjectName?: string;
    }

    /**
     * The conversion detail that will be kept
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_requests_recipe_conversion_detail_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface RecipeConversionDetailInputRepresentation {
        /** conversion detail id */
        conversionDetailId: number;
        /** conversion detail message */
        message: string;
        /** conversion detail node name */
        nodeName: string;
        /** conversion detail severity */
        severity?: string;
    }

    /**
     * Recipe conversion details during upconversion
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_responses_recipe_conversion_detail.htm
     *
     * Keys:
     *    (none)
     */
    export interface RecipeConversionDetailRepresentation {
        /** Message */
        message: string;
        /** Node name */
        nodeName: string;
        /** Severity */
        severity: string;
    }

    /**
     * Input representation of 3.0 Recipe Definition format.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_requests_recipe_definition_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface RecipeDefinitionInputRepresentation {
        /** Recipe Name */
        name: string;
        /** Recipe nodes */
        nodes: {
            [key: string]: RecipeNodeInputRepresentation;
        };
        /** Recipe ui metadata */
        ui: {
            [key: string]: unknown;
        };
        /** Recipe version */
        version: string;
    }

    /**
     * Representation of 3.0 Recipe Definition
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_responses_recipe_definition.htm
     *
     * Keys:
     *    (none)
     */
    export interface RecipeDefinitionRepresentation {
        /** Recipe name */
        name?: string;
        /** Recipe nodes */
        nodes: {
            [key: string]: unknown;
        };
        /** Recipe ui metadata */
        ui: {
            [key: string]: unknown;
        };
        /** Recipe version */
        version: string;
    }

    /**
     * Input representation of a Data Prep recipe.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_requests_recipe_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface RecipeInputRepresentation {
        /** The list of conversion detail ids that will be kept */
        conversionDetails?: Array<RecipeConversionDetailInputRepresentation>;
        /** The recipe's dataflow definition. */
        dataflowDefinition?: string;
        /** The recipe's execution engine. Spark or Dataflow. */
        executionEngine?: string;
        /** The recipe's file content, base64 encoded. Consider using multipart form data instead. */
        fileContent?: string;
        /** The recipe's publish folder. */
        folder?: AssetReferenceInputRepresentation;
        /** Recipe format type (2.0 or 3.0) */
        format?: string;
        /** A short label for the recipe. */
        label?: string;
        /** An optional representation to tag the license attributes of the recipe being saved. */
        licenseAttributes?: LicenseAttributesInputRepresentation;
        /** The name of the recipe. */
        name?: string;
        /** Target system or format to publish the recipe to. Dataset, DataPool, or IoT */
        publishingTarget?: string;
        /** Recipe definition for 3.0 format */
        recipeDefinition?: RecipeDefinitionInputRepresentation;
        /** The recipe's target dataset's security predicate. */
        rowLevelSecurityPredicate?: string;
        /** The recipe's schedule dataflow run. */
        schedule?: string;
        /** The source dataflow asset which will be converted to the recipe 3.0 */
        sourceDataflow?: AssetReferenceInputRepresentation;
    }

    /**
     * Represents a single step used in building a dashboard.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_requests_recipe_node_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface RecipeNodeInputRepresentation {
        /** Node action. */
        action: string;
        schema?: SchemaParametersInputRepresentation;
        /** Source node ids. */
        sources: Array<string>;
    }

    /**
     * Input required to create recipe notifications that are sent to the current user.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_requests_recipe_notification_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface RecipeNotificationInputRepresentation {
        /** Number of minutes that a recipe can run before sending an alert. */
        longRunningAlertInMins?: number | null;
        /** Notification level for emails. */
        notificationLevel: string;
    }

    /**
     * Notification conditions on a recipe for the current user.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_responses_recipe_notification.htm
     *
     * Keys:
     *    id (string): recipe.id
     */
    export interface RecipeNotificationRepresentation {
        /** Number of minutes that a recipe can run before sending an alert. */
        longRunningAlertInMins?: number;
        /** Notification level for emails. */
        notificationLevel: string;
        /** A reference to the Recipe that the notification belongs to. */
        recipe: AssetReferenceRepresentation;
    }

    /**
     * A Data Prep recipe.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_responses_recipe.htm
     *
     * Keys:
     *    id (string): id
     */
    export interface RecipeRepresentation extends BaseWaveAssetRepresentation {
        /** The upconversion details when converting dataflow to R3 */
        conversionDetails: Array<RecipeConversionDetailRepresentation>;
        /** Last dataflow update. */
        dataflowLastUpdate?: string;
        /** Target Dataset */
        dataset?: AssetReferenceRepresentation;
        /** URL to get the recipe's file content. */
        fileUrl?: string;
        /** The format of the recipe */
        format?: string;
        /** The URL for the version histories associated with the recipe. */
        historiesUrl?: string;
        /** The analytics license attributes associated with the recipe. */
        licenseAttributes?: LicenseAttributesRepresentation;
        /** The next scheduled run of this recipe. */
        nextScheduledDate?: string;
        /** The target format or system to publish to. Dataset, DataPool, or IoT. */
        publishingTarget?: string;
        /** Recipe definition for 3.0 format */
        recipeDefinition?: RecipeDefinitionRepresentation;
        /** The security predicate of the target dataset */
        rowLevelSecurityPredicate?: string;
        /** The schedule cron expression current dataflow. */
        schedule?: string;
        scheduleAttributes:
            | DailyScheduleRepresentation
            | EmptyScheduleRepresentation
            | EventDrivenScheduleRepresentation
            | HourlyScheduleRepresentation
            | MinutelyScheduleRepresentation
            | MonthlyRelativeScheduleRepresentation
            | MonthlySpecificScheduleRepresentation
            | WeeklyScheduleRepresentation;
        /** The schedule type of the recipe */
        scheduleType?: string;
        /** dataflow from which the current recipe was upconverted to or was reverted from. */
        sourceDataflow?: string;
        /** Recipe from which the current recipe was upconverted to or was reverted from. */
        sourceRecipe?: string;
        /** The status of recipe. */
        status?: string;
        /** Target Dataflow ID. */
        targetDataflowId?: string;
        /** The validation details for the recipe 3.0 */
        validationDetails: Array<RecipeValidationDetailRepresentation>;
    }

    /**
     * Validation detail on recipe graph or recipe node
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_responses_recipe_validation_detail.htm
     *
     * Keys:
     *    (none)
     */
    export interface RecipeValidationDetailRepresentation {
        /** Message */
        message?: string;
        /** Node name */
        nodeName?: string;
        /** Node type */
        nodeType?: string;
        /** Severity */
        severity?: string;
        /** Validation action */
        validationAction?: string;
        /** Validation code */
        validationCode?: number;
    }

    /**
     * Replicates data from an external source object into Tableau CRM as a dataset. Replicated Datasets are not intended to be visualized directly, but are used like a cache to speed up other workflows which refer to the same source object.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_replicateddatasets.htm#ReplicatedDatasetRepresentation
     *
     * Keys:
     *    id (string): uuid
     */
    export interface ReplicatedDatasetRepresentation {
        assetSharingUrl?: string | null;
        createdBy?: WaveUserRepresentation;
        createdDate?: string;
        description?: string;
        id: string;
        label?: string;
        lastAccessedDate?: string | null;
        lastModifiedBy?: WaveUserRepresentation | null;
        lastModifiedDate?: string | null;
        name?: string;
        namespace?: string;
        permissions?: PermissionsRepresentation | null;
        type: string;
        url: string;
        advancedProperties: Array<AdvancedPropertyValueRepresentation>;
        connectionMode?: string;
        connector: DataConnectorRepresentation;
        datasetId?: string;
        fieldCount?: number;
        fieldsUrl: string;
        filterApplied: boolean;
        lastRefreshedDate?: string;
        outputSource?: OutputSourceRepresentation;
        passThroughFilter?: string;
        replicationDataflowId?: string;
        rowLevelSharing?: boolean;
        sourceObjectName: string;
        status?: string;
        supportedConnectionModes?: Array<string>;
        uuid: string;
    }

    /**
     * A list of configuration metadata that specifies how to replicate each field of a Replicated Dataset.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_replicateddatasets_id_fields.htm#ReplicatedFieldCollectionInputRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface ReplicatedFieldCollectionInputRepresentation {
        fields: Array<{}>;
    }

    /**
     * A list of Replicated Fields.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_replicateddatasets_id_fields.htm#ReplicatedFieldCollectionInputRepresentation#ReplicatedFieldCollectionRepresentation
     *
     * Keys:
     *    id (string): replicatedDataset.id
     */
    export interface ReplicatedFieldCollectionRepresentation {
        fields: Array<ReplicatedFieldRepresentation>;
        replicatedDataset: AssetReferenceRepresentation;
        url: string;
    }

    /**
     * Metadata/configuration for a single field of a Replicated Dataset.
     *
     * Keys:
     *    (none)
     */
    export interface ReplicatedFieldRepresentation extends AbstractFieldRepresentation {
        skipped: boolean;
        fieldType: 'replicatedField';
    }

    /**
     * Input representation for Restore Dataset Version.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_restore_dataset_version_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface RestoreDatasetVersionInputRepresentation {
        /** Source Version to which restore should happen */
        sourceVersion: AssetReferenceInputRepresentation;
    }

    /**
     * Representation of a dataset version restore.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_dataconnectors_connectorid_ingest.htm#RestoreDatasetVersionRepresentation
     *
     * Keys:
     *    id (string): url
     */
    export interface RestoreDatasetVersionRepresentation {
        message: string;
        url: string;
    }

    /**
     * Analtyics query specification.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_query.htm#SaqlQueryInputRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface SaqlQueryInputRepresentation {
        metadata?: SaqlQueryMetadataInputRepresentation;
        /** The query name */
        name?: string;
        /** The query */
        query: string;
        /** The language in which the query is written: Saql, Sql. */
        queryLanguage?: string;
        /** The timezone requested. */
        timezone?: string;
    }

    /**
     * Query metadata contains query Id and query sequence Id used for performance tracking and monitoring purposes.
     *
     * Keys:
     *    (none)
     */
    export interface SaqlQueryMetadataInputRepresentation {
        [key: string]: any;
    }

    /**
     * Schema node field
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_requests_schema_field_parameters_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface SchemaFieldParametersInputRepresentation {
        /** Value to output on error */
        errorValue?: string;
        /** Schema field name */
        name?: string;
        /** Field Properties */
        newProperties?: SchemaFieldPropertiesInputRepresentation;
    }

    /**
     * Common Field Properties
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_requests_schema_field_properties_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface SchemaFieldPropertiesInputRepresentation {
        /** Field label */
        label?: string;
        /** Field name */
        name?: string;
        typeProperties: SchemaTypePropertiesCastInputRepresentation;
    }

    /**
     * Format for symbols
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_requests_schema_field_format_symbols_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface SchemaFormatSymbolsInputRepresentation {
        /** Currency symbol format */
        currencySymbol?: string;
        /** Decimal symbol format */
        decimalSymbol?: string;
        /** Grouping symbol format */
        groupingSymbol?: string;
    }

    /**
     * Schema Node in Recipes
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_requests_schema_parameters_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface SchemaParametersInputRepresentation {
        /** Schema Fields */
        fields: Array<SchemaFieldParametersInputRepresentation>;
        slice?: SchemaSliceInputRepresentation;
    }

    /**
     * Slice definition
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_requests_schema_slice_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface SchemaSliceInputRepresentation {
        /** Fields for SELECT or DROP */
        fields: Array<string>;
        /** Ignore missing fields */
        ignoreMissingFields?: boolean;
        /** Slice mode SELECT or DROP */
        mode?: string;
    }

    /**
     * Cast for types
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_requests_schema_field_type_properties_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface SchemaTypePropertiesCastInputRepresentation {
        /** DateTime Format */
        format?: string;
        /** Total length of text */
        length?: number;
        /** Length of arbitrary precision value */
        precision?: number;
        /** Number of digits to right of decimal point */
        scale?: number;
        /** Number Format */
        symbols?: SchemaFormatSymbolsInputRepresentation;
        /** DataType to Convert to */
        type?: string;
    }

    /**
     * Input representation for specifying a schedule on which to execute some type of job.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#ScheduleInputRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface ScheduleInputRepresentation {
        /** Frequency on which this schedule is run. This is case-insensitive. */
        frequency: string;
        /** Level of subscription for the related job. */
        notificationLevel?: string;
        /** When the schedule should be run. */
        time?: {
            [key: string]: any;
        };
    }

    /**
     * Schedule on which to execute some type of job
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_schedule.htm#ScheduleRepresentation
     *
     * Keys:
     *    id (string): assetId
     */
    export interface ScheduleRepresentation {
        /** The 18 character ID of the asset. */
        assetId: string;
        frequency: string;
        /** Next scheduled time (in UTC) for this schedule. */
        nextScheduledDate?: string;
        /** Email notification level of dataflow associated with this schedule. */
        notificationLevel?: string;
        /** Hour and timezone in which this schedule is run. */
        time?: TimeRepresentation;
    }

    /**
     * Input representation for getting source object data given a list of fields and advanced properties
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_source_object_data_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface SourceObjectDataInputRepresentation {
        /** List of user-specified advanced properties associated with this object. */
        advancedProperties?: Array<AdvancedPropertyValueInputRepresentation>;
        /** List of fields as a way to filter the fields returned in the response. */
        sourceObjectFields: Array<string>;
    }

    /**
     * An Analytics template asset reference.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_asset_reference.htm
     *
     * Keys:
     *    (none)
     */
    export interface TemplateAssetReferenceRepresentation {
        /** The 18 character ID of the asset. */
        id?: string;
        /** The asset label. */
        label?: string;
        /** The asset developer name. */
        name?: string;
        /** The namespace that qualifies the asset name */
        namespace?: string;
        /** The asset URL. */
        url?: string;
    }

    /**
     * Representation for individual validation task
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_template_readiness_item.htm
     *
     * Keys:
     *    (none)
     */
    export interface TemplateReadinessItemRepresentation {
        /** The icon/image associated with the validation task. */
        image: TemplateAssetReferenceRepresentation | null;
        /** The task specific label. */
        label: string | null;
        /** The task specific message. */
        message: string | null;
        /** The status for the readiness task */
        readinessStatus: string | null;
        /** The collection of tags describing the purpose of the validation. */
        tags: Array<string>;
        /** The task specific type, associated with readiness check type. */
        type: string | null;
    }

    /**
     * Representation for a single Wave Template verification.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_template_validate.htm
     *
     * Keys:
     *    id (string): id
     */
    export interface TemplateValidateRepresentation {
        /** The ID or fully qualified API name of this template. */
        id: string;
        /** The individual validation tasks for this template */
        tasks: Array<TemplateReadinessItemRepresentation>;
    }

    /**
     * Time at which something should happen
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#TimeRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface TimeRepresentation {
        /** Hour at which this schedule is run (0-23). */
        hour: number;
        /** Minute at which this schedule is run (0-59). */
        minute: number;
        /** Time zone of the hour at which the schedule is run. */
        timeZone: TimeZoneRepresentation;
    }

    /**
     * Information about a time zone.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#TimeZoneRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface TimeZoneRepresentation {
        /** The signed offset, in hours, from GMT. */
        gmtOffset: number;
        /** The display name of this time zone. */
        name: string;
        /** The zone ID of this time zone. */
        zoneId: string;
    }

    /**
     * Information about a file.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_wave_file_metadata.htm
     *
     * Keys:
     *    (none)
     */
    export interface WaveFileMetadataRepresentation {
        createdBy?: WaveUserRepresentation;
        /** created date */
        createdDate?: string;
        /** The 18 character lens file ID. */
        id?: string;
        /** last accessed date */
        lastAccessedDate?: string;
        /** last modified date */
        lastModifiedDate?: string;
        /** size of the lens file */
        length?: number;
        /** name of lens file */
        name?: string;
        /** url of file. */
        url?: string;
    }

    /**
     * Information about a user.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#WaveUserRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface WaveUserRepresentation {
        /** The 18 character user ID. */
        id: string;
        /** The name of the user. */
        name?: string;
        /** The Chatter profile photo of the user. */
        profilePhotoUrl?: string | null;
    }

    /**
     * Weekly schedule on which to execute some type of job.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#WeeklyScheduleInputRepresentation
     *
     * Keys:
     *    (none)
     */
    export interface WeeklyScheduleInputRepresentation extends ScheduleInputRepresentation {
        frequency: 'weekly' | 'Weekly';
        /** Days of the week on which the schedule will run. */
        daysOfWeek: Array<string>;
    }

    /**
     * Weekly schedule on which to execute some type of job.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#WeeklyScheduleRepresentation
     *
     * Keys:
     *    id (string): assetId
     */
    export interface WeeklyScheduleRepresentation extends ScheduleRepresentation {
        frequency: 'weekly' | 'Weekly';
        /** Days of the week on which the schedule will run. */
        daysOfWeek: Array<string>;
    }

    /**
     * Base class for XMD Dimension and Derived Dimension Action.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_derived_dimension_salesforce_action_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdBaseDimensionActionInputRepresentation {
        /** Whether the Action is enabled. */
        enabled: boolean;
        /** Name of the action. */
        name: string;
    }

    /**
     * Base class for Wave XMD Dimension and Dervied Dimension Custom Action input representation
     *
     * Keys:
     *    (none)
     */
    export interface XmdBaseDimensionCustomActionInputRepresentation extends XmdBaseDimensionActionInputRepresentation {
        /** icon for the action. */
        icon?: string;
        /** method for the action. */
        method?: string;
        /** target for the action. */
        target?: string;
        /** tooltip for the action. */
        tooltip?: string;
        /** Url for the action. */
        url?: string;
    }

    /**
     * Base class for Wave XMD Dimension and Derived Dimension input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_dimension_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdBaseDimensionInputRepresentation {
        /** Conditional formatting for a Dimension. */
        conditionalFormatting?: {
            [key: string]: ConditionalFormattingPropertyInputRepresentation;
        };
        /** Whether the Dimension has custom actions enabled. */
        customActionsEnabled?: boolean;
        /** Date format to be used for a Date that is a dimension. */
        dateFormat?: string;
        /** Default action for the dimension. */
        defaultAction?: string;
        /** Description of the Dimension. */
        description?: string;
        /** Field name of the Dimension (used in queries). */
        field: string;
        /** Fully qualified name of the dimension. */
        fullyQualifiedName?: string;
        /** Image template. */
        imageTemplate?: string;
        /** Label for the Dimension. */
        label?: string;
        /** Template for formatting a Link. */
        linkTemplate?: string;
        /** Whether the Dimension has link templates enabled. */
        linkTemplateEnabled?: boolean;
        /** Tooltip to be displayed for links. */
        linkTooltip?: string;
        /** Origin of this dimension. */
        origin?: string;
        /** Ordered list of Dimensions and Measures. Represents the default order to show them in the UI. */
        recordDisplayFields?: Array<string>;
        /** Record Id for this dimension. */
        recordIdField?: string;
        /** Record Organization Id for this dimension. */
        recordOrganizationIdField?: string;
        /** Whether the Dimension has salesforce actions enabled. */
        salesforceActionsEnabled?: boolean;
        /** Whether the Dimension should be shown in the Explorer. */
        showInExplorer?: boolean;
    }

    /**
     * Base class for Wave XMD Dimension and Derived Dimension Member input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_derived_dimension_member_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdBaseDimensionMemberInputRepresentation {
        /** Color for the member. */
        color?: string;
        /** Label for the member. */
        label?: string;
        /** Member value. */
        member?: string;
    }

    /**
     * Base class for Wave XMD Measure and Derived Measure Format input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_derived_measure_format_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdBaseMeasureFormatInputRepresentation {
        /** displays the original xmd 1.1 format array as a String. */
        customFormat?: string;
        /** Number of digits to be displayed after the decimal place. */
        decimalDigits?: number;
        /** Thousands and decimal numeric separators for number formatting */
        delimiters?: NumericSeparatorsInputRepresentation;
        /** displays negative numbers with parenthesis or not minus sign */
        negativeParentheses?: boolean;
        /** Prefix to be placed before the field value. */
        prefix?: string;
        /** Suffix to be placed after the field value. */
        suffix?: string;
        /** Unit string for the measure. (eg. 'cm') */
        unit?: string;
        /** Multiplier for the unit. */
        unitMultiplier?: number;
    }

    /**
     * Base class for Wave XMD Measure and Derived Measure input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_derived_measure_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdBaseMeasureInputRepresentation {
        /** Conditional formatting for a Measure. */
        conditionalFormatting?: {
            [key: string]: ConditionalFormattingPropertyInputRepresentation;
        };
        /** Date format to be used for a Date that is a measure. */
        dateFormat?: string;
        /** Description of the Measure. */
        description?: string;
        /** Field name of the Measure (used in queries). */
        field: string;
        /** Fully qualified name of the Measure. */
        fullyQualifiedName?: string;
        /** Label for the Measure. */
        label?: string;
        /** Origin of the Measure. */
        origin?: string;
        /** Whether the Measure should be shown in the Explorer. */
        showInExplorer?: boolean;
    }

    /**
     * Wave XMD Dataset input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_dataset_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdDatasetInputRepresentation {
        /** Connector source for the dataset. */
        connector?: string;
        /** Description of the dataset. */
        description?: string;
        /** Fully qualified name of the dataset version. */
        fullyQualifiedName?: string;
        /** Origin representing where this dataset version comes from. */
        origin?: string;
    }

    /**
     * Extended metadata for the dataset
     *
     * Keys:
     *    (none)
     */
    export interface XmdDatasetRepresentation {
        /** Connector source for the dataset */
        connector?: string;
        /** Description of the dataset. */
        description?: string;
        /** Fully qualified name of the dataset version. */
        fullyQualifiedName?: string;
        /** Origin representing where this dataset version comes from. */
        origin?: string;
    }

    /**
     * Wave XMD Date Fields input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_date_field_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdDateFieldsInputRepresentation {
        /** day field. */
        day?: string;
        /** epochDay field. */
        epochDay?: string;
        /** epochSecond field. */
        epochSecond?: string;
        /** fiscalMonth field. */
        fiscalMonth?: string;
        /** fiscalQuarter field. */
        fiscalQuarter?: string;
        /** fiscalWeek field. */
        fiscalWeek?: string;
        /** fiscalYear field. */
        fiscalYear?: string;
        /** fullField field. */
        fullField?: string;
        /** hour field. */
        hour?: string;
        /** minute field. */
        minute?: string;
        /** month field. */
        month?: string;
        /** quarter field. */
        quarter?: string;
        /** second field. */
        second?: string;
        /** week field. */
        week?: string;
        /** year field. */
        year?: string;
    }

    /**
     * Extended metadata for the formatting of a Date Field in a Dataset.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_xmd_date_field.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdDateFieldRepresentation {
        /** day field. */
        day?: string;
        /** epochDay field. */
        epochDay?: string;
        /** epochSecond field. */
        epochSecond?: string;
        /** fiscalMonth field. */
        fiscalMonth?: string;
        /** fiscalQuarter field. */
        fiscalQuarter?: string;
        /** fiscalWeek field. */
        fiscalWeek?: string;
        /** fiscalYear field. */
        fiscalYear?: string;
        /** fullField field. */
        fullField?: string;
        /** hour field */
        hour?: string;
        /** minute field */
        minute?: string;
        /** month field. */
        month?: string;
        /** quarter field. */
        quarter?: string;
        /** second field */
        second?: string;
        /** week field. */
        week?: string;
        /** year field. */
        year?: string;
    }

    /**
     * Wave XMD Date input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_date_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdDateInputRepresentation {
        /** Alias of the Date column. */
        alias?: string;
        /** Whether the Date should be displayed as compact. */
        compact?: boolean;
        /** Description of the Date column. */
        description?: string;
        /** Formatting information for the date fields. */
        fields?: XmdDateFieldsInputRepresentation;
        /** What the first day of the week is. */
        firstDayOfWeek?: number;
        /** Offset number of months for the fiscal year in relation to the calendar year. */
        fiscalMonthOffset?: number;
        /** Fully qualified name of the date. */
        fullyQualifiedName?: string;
        /** Whether the Year End is the Fiscal year. */
        isYearEndFiscalYear?: boolean;
        /** Label of the Date column. */
        label?: string;
        /** Whether the Date should be show in the explorer. */
        showInExplorer?: boolean;
    }

    /**
     * Extended metadata for a date
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_xmd_date.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdDateRepresentation {
        /** Alias of the Date column. */
        alias?: string;
        /** Whether or not the Date should be displayed as compact. */
        compact?: boolean;
        /** Description of the Date column. */
        description?: string;
        /** Formatting information for the date fields. */
        fields: XmdDateFieldRepresentation;
        /** What the first day of the week is. */
        firstDayOfWeek?: number;
        /** Offset number of months for the fiscal year in relation to the calendar year. */
        fiscalMonthOffset?: number;
        /** Format of the date field. */
        format?: string;
        /** Fully qualified name of the date. */
        fullyQualifiedName?: string;
        /** If the DateTime type is from timezone auto conversion. */
        isConvertedDateTime?: boolean;
        /** If the Year End is the Fiscal year. */
        isYearEndFiscalYear?: boolean;
        /** Label of the Date column. */
        label?: string;
        /** Whether or not the Date should be show in the explorer. */
        showInExplorer?: boolean;
        /** Date type of the Date column. */
        type?: string;
    }

    /**
     * Wave XMD Derived Dimension input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_derived_dimension_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdDerivedDimensionInputRepresentation extends XmdBaseDimensionInputRepresentation {
        /** Custom Actions linked to this Derived Dimension. */
        customActions?: Array<XmdBaseDimensionCustomActionInputRepresentation>;
        /** Whether the Derived Dimension is multi-value. */
        isMultiValue?: boolean;
        /** Member overrides for a Derived Dimension. */
        members?: Array<XmdDerivedDimensionMemberInputRepresentation>;
        /** Salesfoce Actions linked to this Derived Dimension. */
        salesforceActions?: Array<XmdDerivedDimensionSalesforceActionInputRepresentation>;
    }

    /**
     * Wave XMD Derived Dimension Member input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_derived_dimension_member_input.htm
     *
     * Keys:
     *    (none)
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface XmdDerivedDimensionMemberInputRepresentation extends XmdBaseDimensionMemberInputRepresentation {}

    /**
     * Wave XMD Derived Dimension Salesforce Action input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_derived_dimension_salesforce_action_input.htm
     *
     * Keys:
     *    (none)
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface XmdDerivedDimensionSalesforceActionInputRepresentation extends XmdBaseDimensionActionInputRepresentation {}

    /**
     * Wave XMD Derived Measure input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_derived_measure_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdDerivedMeasureInputRepresentation extends XmdBaseMeasureInputRepresentation {
        /** Format details for the Derived Measure. */
        format?: XmdBaseMeasureFormatInputRepresentation;
    }

    /**
     * Base Action Representation for a Dimension in an Xmd.
     *
     * Keys:
     *    (none)
     */
    export interface XmdDimensionBaseActionRepresentation {
        /** If Action is enabled for a specific dimension. */
        enabled: boolean;
        /** Name of the action. */
        name: string;
    }

    /**
     * Custom Action Representation for a Dimension in an Xmd.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_xmd_dimension_custom_action.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdDimensionCustomActionRepresentation extends XmdDimensionBaseActionRepresentation {
        /** icon for the action. */
        icon?: string;
        /** method for the action. */
        method?: string;
        /** target for the action. */
        target?: string;
        /** tooltip for the action. */
        tooltip?: string;
        /** Url for the action. */
        url: string;
    }

    /**
     * Wave XMD Dimension input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_dimension_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdDimensionInputRepresentation extends XmdBaseDimensionInputRepresentation {
        /** Custom Actions linked to this Dimension. */
        customActions?: Array<XmdBaseDimensionCustomActionInputRepresentation>;
        /** Member overrides for a Dimension. */
        members?: Array<XmdDimensionMemberInputRepresentation>;
        /** Salesfoce Actions linked to this Dimension. */
        salesforceActions?: Array<XmdDimensionSalesforceActionInputRepresentation>;
    }

    /**
     * Wave XMD Dimension Member input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_dimension_member_input.htm
     *
     * Keys:
     *    (none)
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface XmdDimensionMemberInputRepresentation extends XmdBaseDimensionMemberInputRepresentation {}

    /**
     * Extended metadata a Member linked to a Dimension in a Dataset.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_xmd_dimension_member.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdDimensionMemberRepresentation {
        /** Color for the member. */
        color?: string;
        /** Label for the member. */
        label?: string;
        /** Member value. */
        member: string;
    }

    /**
     * Extended metadata a Dimension in a Dataset.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_xmd_dimension.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdDimensionRepresentation {
        /** Conditional formatting for a Dimension. */
        conditionalFormatting: {
            [key: string]: unknown;
        };
        /** Custom Actions linked to this Dimension. */
        customActions: Array<XmdDimensionCustomActionRepresentation>;
        /** Whether the Dimension has custom actions enabled. */
        customActionsEnabled?: boolean;
        /** Date format to be used for a Date that is a dimension. */
        dateFormat?: string;
        /** Default action for the dimension. */
        defaultAction?: string;
        /** Description of the Dimension. */
        description?: string;
        /** Field name of the Dimension (used in queries). */
        field: string;
        /** Fully qualified name of the dimension. */
        fullyQualifiedName?: string;
        /** Image template. */
        imageTemplate?: string;
        /** Whether the Dimension is multi-value. */
        isMultiValue?: boolean;
        /** Label for the Dimension. */
        label?: string;
        /** Template for formatting a Link. */
        linkTemplate?: string;
        /** Whether the Dimension has link templates enabled. */
        linkTemplateEnabled?: boolean;
        /** Tooltip to be displayed for links. */
        linkTooltip?: string;
        /** Member overrides for a Dimension. */
        members: Array<XmdDimensionMemberRepresentation>;
        /** Origin of this dimension. */
        origin?: string;
        /** Ordered list of Dimensions and Measures. Represents the default order to show them in the UI. */
        recordDisplayFields: Array<string>;
        /** Record Id for this dimension. */
        recordIdField?: string;
        /** Record Organization Id for this dimension. */
        recordOrganizationIdField?: string;
        /** Salesfoce Actions linked to this Dimension. */
        salesforceActions: Array<XmdDimensionSalesforceActionRepresentation>;
        /** Whether the Dimension has salesforce actions enabled. */
        salesforceActionsEnabled?: boolean;
        /** Whether the Dimension should be shown in the Explorer. */
        showInExplorer?: boolean;
    }

    /**
     * Wave XMD Dimension Salesforce Action input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_dimension_salesforce_action_input.htm
     *
     * Keys:
     *    (none)
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface XmdDimensionSalesforceActionInputRepresentation extends XmdBaseDimensionActionInputRepresentation {}

    /**
     * Salesforce Action Representation for a Dimension in an Xmd.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_xmd_dimension_salesforce_action.htm
     *
     * Keys:
     *    (none)
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface XmdDimensionSalesforceActionRepresentation extends XmdDimensionBaseActionRepresentation {}

    /**
     * Extended Metadata (Xmd) for a Dataset Version
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_xmd.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdInnerRepresentation {
        /** Represents the creator of this Xmd */
        createdBy: WaveUserRepresentation;
        /** Time the Xmd was created */
        createdDate: string;
        /** Locale specific information about the Dataset represented by this xmd. */
        dataset: XmdDatasetRepresentation;
        /** List of dates with formatting information. */
        dates: Array<XmdDateRepresentation>;
        /** List of derived dimensions with formatting information. */
        derivedDimensions: Array<XmdDimensionRepresentation>;
        /** List of derived measures with formatting information. */
        derivedMeasures: Array<XmdMeasureRepresentation>;
        /** List of dimensions with formatting information. */
        dimensions: Array<XmdDimensionRepresentation>;
        /** Message if there was error copying forward the current version's user xmd to the newly created version. */
        errorMessage?: string;
        /** The type of language this xmd is localized for */
        language: string;
        /** Represents the user who last modified this Xmd */
        lastModifiedBy: WaveUserRepresentation;
        /** Time the Xmd was last modified */
        lastModifiedDate: string;
        /** List of measures with formatting information. */
        measures: Array<XmdMeasureRepresentation>;
        /** List of organizations for multi organization support. */
        organizations: Array<XmdOrganizationRepresentation>;
        /** Ordered list of Dimensions and Measures. Represents the default order to show them in the UI. */
        showDetailsDefaultFields: Array<string>;
        /** The type of Xmd (Main, User, System) */
        type: string;
        /** Location where this XMD is stored. */
        url?: string;
    }

    /**
     * Wave XMD input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdInputRepresentation {
        /** Locale specific information about the Dataset represented by this xmd. */
        dataset?: XmdDatasetInputRepresentation;
        /** List of dates with formatting information. */
        dates?: Array<XmdDateInputRepresentation>;
        /** List of derived dimensions with formatting information. */
        derivedDimensions?: Array<XmdDerivedDimensionInputRepresentation>;
        /** List of derived measures with formatting information. */
        derivedMeasures?: Array<XmdDerivedMeasureInputRepresentation>;
        /** List of dimensions with formatting information. */
        dimensions?: Array<XmdDimensionInputRepresentation>;
        /** List of measures with formatting information. */
        measures?: Array<XmdMeasureInputRepresentation>;
        /** List of organizations for multi organization support. */
        organizations?: Array<XmdOrganizationInputRepresentation>;
        /** Ordered list of Dimensions and Measures. Represents the default order to show them in the UI. */
        showDetailsDefaultFields?: Array<string>;
    }

    /**
     * Format for a Measure in a Dataset.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_xmd_measure_format.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdMeasureFormatRepresentation {
        /** displays the original xmd 1.1 format array as a String. */
        customFormat?: string;
        /** Number of digits to be displayed after the decimal place. */
        decimalDigits?: number;
        /** Thousands and decimal numeric separators. */
        delimiters?: NumericSeparatorsRepresentation;
        /** displays negative numbers with parenthesis or not minus sign */
        negativeParentheses?: boolean;
        /** Prefix to be placed before the field value. */
        prefix?: string;
        /** Suffix to be places after the field value. */
        suffix?: string;
        /** Unit string for the measure. (eg. 'cm') */
        unit?: string;
        /** Multiplier for the unit. */
        unitMultiplier?: number;
    }

    /**
     * Wave XMD Measure input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_measure_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdMeasureInputRepresentation extends XmdBaseMeasureInputRepresentation {
        /** Format details for the Measure. */
        format?: XmdBaseMeasureFormatInputRepresentation;
    }

    /**
     * Extended metadata for a Measure in a Dataset.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_xmd_measure.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdMeasureRepresentation {
        /** Conditional formatting for a Measure. */
        conditionalFormatting: {
            [key: string]: unknown;
        };
        /** Date format to be used for a Date that is a measure. */
        dateFormat?: string;
        /** Description of the Measure. */
        description?: string;
        /** Field name of the Measure (used in queries). */
        field: string;
        /** Format details for the Measure. */
        format?: XmdMeasureFormatRepresentation;
        /** Fully qualified name of the Measure. */
        fullyQualifiedName?: string;
        /** Label for the Measure. */
        label?: string;
        /** Origin of this measure. */
        origin?: string;
        /** Whether the Measure should be shown in the Explorer. */
        showInExplorer?: boolean;
    }

    /**
     * Wave XMD Organization input representation
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_requests_xmd_organization_input.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdOrganizationInputRepresentation {
        /** ID of the organization. */
        id?: string;
        /** Instance Url for the organization. */
        instanceUrl?: string;
        /** Label for the organization. */
        label?: string;
    }

    /**
     * Extended metadata for an organization
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_xmd_organization.htm
     *
     * Keys:
     *    (none)
     */
    export interface XmdOrganizationRepresentation {
        /** id of the organization */
        id: string;
        /** Instance Url for an organization. */
        instanceUrl: string;
        /** Label for an organization. */
        label: string;
    }

    /**
     * Extended Metadata (Xmd) for a Dataset Version
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_responses_xmd.htm
     *
     * Keys:
     *    url (string): url
     */
    export interface XmdRepresentation {
        /** Represents the creator of this Xmd */
        createdBy: WaveUserRepresentation;
        /** Time the Xmd was created */
        createdDate: string;
        /** Locale specific information about the Dataset represented by this xmd. */
        dataset: XmdDatasetRepresentation;
        /** List of dates with formatting information. */
        dates: Array<XmdDateRepresentation>;
        /** List of derived dimensions with formatting information. */
        derivedDimensions: Array<XmdDimensionRepresentation>;
        /** List of derived measures with formatting information. */
        derivedMeasures: Array<XmdMeasureRepresentation>;
        /** List of dimensions with formatting information. */
        dimensions: Array<XmdDimensionRepresentation>;
        /** Message if there was error copying forward the current version's user xmd to the newly created version. */
        errorMessage?: string;
        /** The type of language this xmd is localized for */
        language: string;
        /** Represents the user who last modified this Xmd */
        lastModifiedBy: WaveUserRepresentation;
        /** Time the Xmd was last modified */
        lastModifiedDate: string;
        /** List of measures with formatting information. */
        measures: Array<XmdMeasureRepresentation>;
        /** List of organizations for multi organization support. */
        organizations: Array<XmdOrganizationRepresentation>;
        /** Ordered list of Dimensions and Measures. Represents the default order to show them in the UI. */
        showDetailsDefaultFields: Array<string>;
        /** The type of Xmd (Main, User, System) */
        type: string;
        /** Location where this XMD is stored. */
        url: string;
    }

    /**
     * Creates a Tableau CRM connector.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_create_data_connector
     *
     * @param dataConnector.connectionProperties Connection properties for the connector.
     * @param dataConnector.connectorHandler Third party driver used for connection.
     * @param dataConnector.connectorType The type of the Data Connector.
     * @param dataConnector.folder Folder for the Live connector.
     * @param dataConnector.targetConnector AssetReference containing ID or API name of target connector associated with the current source connector.
     * @return A promise that will resolve to the data connector response.
     */
    export function createDataConnector({ dataConnector }: { dataConnector: DataConnectorInputRepresentation }): Promise<DataConnectorRepresentation>;

    /**
     * Creates a Tableau CRM dataflow job, which is the equivalent of clicking Run Now for a data prep recipe, a data sync,
     * or a dataflow in the Tableau CRM Data Manager UI.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_create_dataflow_job
     *
     * @param dataflowJob.dataflowId The dataflow, data prep recipe, or data sync ID for the job.
     * @param dataflowJob.command The job command to execute. Must be `Start` to create a dataflow job.
     * @return A promise that will resolve to the dataflow job response.
     */
    export function createDataflowJob({ dataflowJob }: { dataflowJob: DataflowJobInputRepresentation }): Promise<DataflowJobRepresentation>;

    /** Creates a CRM Analytics dataset.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_analytics_create_dataset
     *
     * @param dataset The dataset to create.
     * @return A promise that will resolve to the dataset response.
     */
    export function createDataset({ dataset }: { dataset: DatasetInputRepresentation }): Promise<DatasetRepresentation>;

    /** Creates a version of a CRM Analytics dataset.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_analytics_create_dataset_version
     *
     * @param datasetIdOrApiName The ID or developer name of the dataset.
     * @param sourceVersion The Source Version to which restore should happen.
     * @return A promise that will resolve to the dataset version response.
     */
    export function createDatasetVersion({
        datasetIdOrApiName,
        sourceVersion,
    }: {
        datasetIdOrApiName: string;
        sourceVersion: RestoreDatasetVersionInputRepresentation;
    }): Promise<RestoreDatasetVersionRepresentation>;

    /**
     * Creates a Tableau CRM replicated dataset
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_create_replicated_dataset
     *
     * @param replicatedDataset.advancedProperties List of user-specified advanced properties associated with this.
     * @param replicatedDataset.connectionMode Connection mode for pulling the data from the replicated dataset.
     * @param replicatedDataset.connectorId The id of the connector object used to replicate.
     * @param replicatedDataset.fullRefresh Whether to perform a one-time full refresh (during the next run) as opposed to incremental.
     * @param replicatedDataset.passThroughFilter Passthrough filter for the replicated object.
     * @param replicatedDataset.rowLevelSharing Inherit row level sharing rules for this object.
     * @param replicatedDataset.sourceObjectName The name of the source object to be replicated.
     * @return A promise that will resolve to the replicated dataset response.
     */
    export function createReplicatedDataset({
        replicatedDataset,
    }: {
        replicatedDataset: ReplicatedDatasetInputRepresentation;
    }): Promise<ReplicatedDatasetRepresentation>;

    /** Deletes a specific CRM Analytics data connector by ID or developer name.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_analytics_delete_data_connector
     *
     * @param connectorIdOrApiName The ID or developer name of the connector.
     * @return A promise that will resolve on completion.
     */
    export function deleteDataConnector({ connectorIdOrApiName }: { connectorIdOrApiName: string }): Promise<void>;

    /**
     * Deletes a specific Tableau CRM dataset by ID or developer name.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_delete_dataset
     *
     * @param datasetIdOrApiName The ID or developer name of the dataset.
     * @return A promise that will resolve on completion.
     */
    export function deleteDataset({ datasetIdOrApiName }: { datasetIdOrApiName: string }): Promise<void>;

    /**
     * Deletes a specific Tableau CRM data prep recipe by ID.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_delete_recipe
     *
     * @param id The ID of the data prep recipe.
     * @return A promise that will resolve on completion.
     */
    export function deleteRecipe({ id }: { id: string }): Promise<void>;

    /**
     * Deletes a specific Tableau CRM replicated dataset by ID.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_delete_replicated_dataset
     *
     * @param id The ID of the replicated dataset.
     * @return A promise that will resolve on completion.
     */
    export function deleteReplicatedDataset({ id }: { id: string }): Promise<void>;

    /**
     * Wire adapter to execute a Tableau CRM query.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_execute_query
     *
     * @param query.query The query string to execute.
     * @param query.queryLanguage The query language. Valid values are `SAQL` or `SQL`. The default is `SAQL`.
     * @param query.timezone The timezone for the query.
     */
    export function executeQuery(query: SaqlQueryInputRepresentation): void;

    /** Wire adapter to retrieve a collection of Salesforce actions available to a CRM Analytics user.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_get_actions
     *
     * @param entityId The ID of the CRM Analytics user.
     */
    export function getActions(entityId: string): void;

    /**
     * Wire adapter to retrieve the Analytics limits for Tableau CRM.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_analytics_limits
     *
     * @param licenseType The Tableau CRM license types. Valid values are `EinsteinAnalytics` or `Sonic`.
     * @param types The types of limits used in Tableau CRM.
     *              Valid values are `BatchTransformationHours`, `DatasetQueries`, `DatasetRowCount`,
     *              `MaxDailyRowsHighOutputCon`, `MaxDailyRowsLowOutputCon`, `MaxDailyRowsMedOutputCon`,
     *              `MaxDailySizeHighOutputCon`, `MaxDailySizeLowOutputCon`, `MaxDailySizeMedOutputCon`,
     *              or `OutputLocalConnectorVolume`.
     */
    export function getAnalyticsLimits(licenseType?: string, types?: string[]): void;

    /**
     * Wire adapter to retrieve the Connector for Tableau CRM.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_data_connector
     *
     * @param connectorIdOrApiName The ID of the connector.
     */
    export function getDataConnector(connectorIdOrApiName: string): void;

    /**
     * Wire adapter to retrieve the collection of Connectors for Tableau CRM.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_data_connectors
     *
     * @param category The categories that the data connector belongs to. Valid values are:
     *                 AdvancedPropertiesSupport, BatchRead, Direct, FileBased, FilterSupport, MuleSoft, Output
     * @param connectorType The type of Tableau CRM connector.
     * @param scope The type of scope to be applied to the returned collection. Valid values are:
     *              Created​By​Me, Mru (Most Recently Used), Shared​With​Me
     */
    export function getDataConnectors(category?: string, connectorType?: string, scope?: string): void;

    /**
     * Wire adapter to retrieve the collection of source fields for a particular source object.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_data_connector_source_fields
     *
     * @param connectorIdOrApiName The ID of the connector.
     * @param sourceObjectName The name of the source object.
     */
    export function getDataConnectorSourceFields(connectorIdOrApiName: string, sourceObjectName: string): void;

    /**
     * Wire adapter to retrieve a source object resource for a Tableau CRM connector.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_data_connector_source_object
     *
     * @param connectorIdOrApiName The ID of the connector.
     * @param sourceObjectName The name of the source object.
     */
    export function getDataConnectorSourceObject(connectorIdOrApiName: string, sourceObjectName: string): void;

    /**
     * Wire adapter to retrieve a preview collection of source fields for a source object used by a CRM Analytics data connector.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_get_data_connector_source_object_data_preview_with_fields
     *
     * @param connectorIdOrApiName The ID of the connector.
     * @param sourceObjectName The name of the source object.
     * @param sourceObjectParam The fields of the source object.
     */
    export function getDataConnectorSourceObjectDataPreviewWithFields(
        connectorIdOrApiName: string,
        sourceObjectName: string,
        sourceObjectParam: SourceObjectDataInputRepresentation,
    ): void;

    /**
     * Wire adapter to retrieve a source object resource for a Tableau CRM connector.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_dataconnectors_connectorid_sourceobjects.htm
     *
     * @param connectorIdOrApiName The ID of the connector.
     * @param q Search terms. Individual terms are separated by spaces. A wildcard is automatically appended to the last token in the query string.
     *          If the user’s search query contains quotation marks or wildcards, those symbols are automatically removed from the query string in
     *          the URI along with any other special characters.
     * @param page Generated token that indicates the view of dataflow jobs to be returned.
     * @param pageSize Number of items to be returned in a single page. Minimum is 1, maximum is 200, and the default is 25.
     */
    export function getDataConnectorSourceObjects(connectorIdOrApiName: string, q?: string, page?: string, pageSize?: number): void;

    /**
     * Wire adapter to test the status of an external Tableau CRM connector.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_data_connector_status
     *
     * @param connectorIdOrApiName The ID of the connector.
     */
    export function getDataConnectorStatus(connectorIdOrApiName: string): void;

    /**
     * Wire adapter to retrieve a collection of Tableau CRM connector types.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_data_connector_types
     */
    export function getDataConnectorTypes(): void;

    /**
     * Wire adapter to retrieve a specific Tableau CRM dataflow job.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_dataflow_job
     *
     * @param dataflowjobId The ID of the dataflow job.
     */
    export function getDataflowJob(dataflowjobId: string): void;

    /**
     * Wire adapter to retrieve a specific Tableau CRM dataflow job node for a recipe or dataflow.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_dataflow_job_node
     *
     * @param dataflowjobId The ID of the dataflow job.
     * @param nodeId The ID of the node.
     */
    export function getDataflowJobNode(dataflowjobId: string, nodeId: string): void;

    /**
     * Wire adapter to retrieve a collection of Tableau CRM dataflow job nodes.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_dataflow_job_nodes
     *
     * @param dataflowjobId The ID of the dataflow job.
     */
    export function getDataflowJobNodes(dataflowjobId: string): void;

    /**
     * Wire adapter to retrieve a collection of Tableau CRM dataflow jobs.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_dataflow_jobs
     *
     * @param dataflowId Filters the collection to only contain dataflow jobs tied to this specific dataflow. The ID must start with '02K'.
     * @param licenseType The response includes dataflow jobs with this license type. Valid values are `EinsteinAnalytics` or `Sonic`.
     * @param page Generated token that indicates the view of dataflow jobs to be returned.
     * @param pageSize Number of items to be returned in a single page. Minimum is 1, maximum is 200, and the default is 25.
     * @param q Search terms. Individual terms are separated by spaces. A wildcard is automatically appended to the last token in the query string.
     *          If the user’s search query contains quotation marks or wildcards, those symbols are automatically removed from the query string in
     *          the URI along with any other special characters.
     * @param status Filters the collection to only contain dataflow jobs with a specific runtime status.
     *               Valid values are `Failure`, `Queued`, `Running`, `Success`, or `Warning`.
     */
    export function getDataflowJobs(dataflowId?: string, licenseType?: string, page?: string, pageSize?: number, q?: string, status?: string): void;

    /**
     * Wire adapter to retrieve a collection of Tableau CRM dataflows.
     *
     * @param q Search terms. Individual terms are separated by spaces. A wildcard is automatically appended to the last token in the query string.
     *          If the user’s search query contains quotation marks or wildcards, those symbols are automatically removed from the query string in
     *          the URI along with any other special characters.
     */
    export function getDataflows(q?: string): void;

    /**
     * Wire adapter to retrieve a specific Tableau CRM dataset by ID or developer name.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_dataset
     *
     * @param datasetIdOrApiName The ID or developer name of the dataset.
     */
    export function getDataset(datasetIdOrApiName: string): void;

    /** Wire adapter to retrieve a collection of Tableau CRM datasets.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_datasets
     *
     * @param datasetTypes Filters the collection to include only datasets of one or more of the specified types.
     *                     Valid values are `Default`, `Live`, or `Trended`.
     * @param folderId Filters the collection to only contain datasets for the specified folder. The ID can be the requesting user's ID for
     *                 datasets in the user's private folder.
     * @param hasCurrentOnly Filters the collection of datasets to include only those datasets that have a current version. The default is `false`.
     * @param ids Filter the collection to include only datasets with the specified IDs.
     * @param includeCurrentVersion Specifies if the response should include the current version metadata. The default is `false`.
     * @param licenseType The response includes dataflow jobs with this license type. Valid values are `EinsteinAnalytics` or `Sonic`.
     * @param order Ordering to apply to the collection results. Valid values are `Ascending` or `Descending`.
     * @param page Generated token that indicates the view of datasets to be returned.
     * @param pageSize Number of items to be returned in a single page. Minimum is 1, maximum is 200, and the default is 25.
     * @param q Search terms. Individual terms are separated by spaces. A wildcard is automatically appended to the last token in the query string.
     *          If the user’s search query contains quotation marks or wildcards, those symbols are automatically removed from the query string in
     *          the URI along with any other special characters.
     * @param scope Scope type to apply to the collection results.
     *              Valid values are `CreatedByMe`, `Favorites`, `IncludeAllPrivate`, `Mru` (Most Recently Used), or `SharedWithMe`.
     * @param sort Sort order to apply to the collection results.
     *             Valid values are `CreatedBy`, `CreatedDate`, `LastModified`, `LastQueried`, `LastRefreshed`,
     *             `Mru` (Most Recently Used, last viewed date), `Name`, or `TotalRows`.
     */
    export function getDatasets(
        datasetTypes?: string,
        folderId?: string,
        hasCurrentOnly?: boolean,
        ids?: string[],
        includeCurrentVersion?: boolean,
        licenseType?: string,
        order?: string,
        page?: string,
        pageSize?: number,
        q?: string,
        scope?: string,
        sort?: string,
    ): void;

    /**
     * Wire adapter to retrieve a specific CRM Analytics dataset version by dataset ID or developer name and version ID.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_get_dataset_version
     *
     * @param datasetIdOrApiName The ID or developer name of the dataset.
     * @param versionId The ID of the dataset version.
     */
    export function getDatasetVersion(datasetIdOrApiName: string, versionId: string): void;

    /**
     * Wire adapter to retrieve a list of CRM Analytics dataset versions for a specific dataset.
     *
     *  https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_get_dataset_versions
     *
     * @param datasetIdOrApiName The ID or developer name of the dataset.
     */
    export function getDatasetVersions(datasetIdOrApiName: string): void;

    /** Wire adapter to retrieve the dependencies for an asset.
     * The dependencies resource returns only assets for which the user has view access.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_get_dependencies
     *
     * @param assetId The ID of the CRM Analytics asset.
     */
    export function getDependencies(assetId: string): void;

    /**
     * Wire adapter to retrieve a specific Tableau CRM data prep recipe by ID.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_recipe
     *
     * @param id The ID of the recipe.
     * @param format Specifies the format of the returned recipe. Valid values are `R2 or `R3`. The default is `R3`.
     */
    export function getRecipe(id: string, format?: string): void;

    /**
     * Wire adapter to retrieve a Data Prep recipe job notification.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_resources_recipes_id_notification.htm
     *
     * @param id The ID of the recipe.
     */
    export function getRecipeNotification(id: string): void;

    /**
     * Wire adapter to retrieve a collection of Tableau CRM data prep recipes.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_recipes
     *
     * @param format Filters the collection to include only recipes of the specified format. Valid values are `R2` or `R3`.
     * @param licenseType The response includes dataflow jobs with this license type. Valid values are `EinsteinAnalytics` or `Sonic`.
     * @param page Generated token that indicates the view of recipes to be returned.
     * @param pageSize Number of items to be returned in a single page. Minimum is 1, maximum is 200, and the default is 25.
     * @param q Search terms. Individual terms are separated by spaces. A wildcard is automatically appended to the last token in the query string.
     *          If the user’s search query contains quotation marks or wildcards, those symbols are automatically removed from the query string in
     *          the URI along with any other special characters.
     * @param sort Sort order to apply to the collection results.
     *             Valid values are `LastModified`, `LastModifiedBy`, `Mru` (Most Recently Used, last viewed date), or `Name`.
     */
    export function getRecipes(format?: string, licenseType?: string, page?: string, pageSize?: number, q?: string, sort?: string): void;

    /**
     * Wire adapter to retrieve a specific Tableau CRM replicated dataset by ID.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_replicated_dataset
     *
     * @param id The ID of the replicated dataset.
     */
    export function getReplicatedDataset(id: string): void;

    /**
     * Wire adapter to retrieve a collection of Tableau CRM replicated datasets, also known as connected objects.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_replicated_datasets
     *
     * @param category Filters the collection to include only connected objects of the specified category. Valid values are `Input` or `Output`.
     * @param connector Filters the collection to include only connected objects belonging to the specified Tableau CRM connector.
     * @param sourceObject Filters the collection to include only connected objects belonging to the specified source object.
     */
    export function getReplicatedDatasets(category?: string, connector?: string, sourceObject?: string): void;

    /**
     * Wire adapter to retrieve a list of fields for the specified connected object.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_replicated_fields
     *
     * @param id The ID of the replicated dataset.
     */
    export function getReplicatedFields(id: string): void;

    /**
     * Wire adapter to retrieve a schedule for a Tableau CRM recipe, dataflow, or data sync.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_schedule
     *
     * @param assetId The ID of the dataflow, recipe, or data sync.
     */
    export function getSchedule(assetId: string): void;

    /** Wire adapter to retrieve the security coverage, also known as sharing inheritance, for a particular dataset version.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_get_security_coverage_dataset_version
     *
     * @param datasetIdOrApiName The ID or developer name of the dataset.
     * @param versionId The ID of the dataset version.
     */
    export function getSecurityCoverageDatasetVersion(datasetIdOrApiName: string, versionId: string): void;

    /**
     * Wire adapter to retrieve a collection of Tableau CRM apps or folders.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_wave_folders
     *
     * @param isPinned Filters the collection to include only folders which are pinned (`true`) or not (`false`). The default is `false`.
     * @param mobileOnlyFeaturedAssets Filters the collection to only contain folders which contain dashboards that are enabled for the
     *                                 Tableau CRM mobile app. The default is `false`.
     * @param page Generated token that indicates the view of folders to be returned.
     * @param pageSize Number of items to be returned in a single page. Minimum is 1, maximum is 200, and the default is 25.
     * @param q Search terms. Individual terms are separated by spaces. A wildcard is automatically appended to the last token in the query string.
     *          If the user’s search query contains quotation marks or wildcards, those symbols are automatically removed from the query string in
     *          the URI along with any other special characters.
     * @param scope Scope type to apply to the collection results.
     *              Valid values are `CreatedByMe`, `Favorites`, `IncludeAllPrivate`, `Mru` (Most Recently Used), or `SharedWithMe`.
     * @param sort Sort order to apply to the collection results.
     *             Valid values are `LastModified`, `LastModifiedBy`, `Mru` (Most Recently Used, last viewed date), or `Name`.
     * @param templateSourceId Filters the collection to include only folders that are created from a specific template source
     */
    export function getWaveFolders(
        isPinned?: boolean,
        mobileOnlyFeaturedAssets?: boolean,
        page?: string,
        pageSize?: number,
        q?: string,
        scope?: string,
        sort?: string,
        templateSourceId?: string,
    ): void;

    /**
     * Wire adapter to retrieve a CRM Analytics template.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_get_wave_template
     *
     * @param templateIdOrApiName The ID or developer name of the template.
     * @param options Template visibility options to apply to the collection results.
     *                Valid values are `CreateApp`, `ManageableOnly`, or `ViewOnly`.
     */
    export function getWaveTemplate(templateIdOrApiName: string, options?: string): void;

    /**
     * Wire adapter to retrieve the configuration for a CRM Analytics template.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_get_wave_template_config
     *
     * @param templateIdOrApiName The ID or developer name of the template.
     * @param disableApex Indicates whether Apex integration hooks are disabled (true) or not (false).
     * @param options Template visibility options to apply to the collection results.
     *                Valid values are `CreateApp`, `ManageableOnly`, or `ViewOnly`.
     */
    export function getWaveTemplateConfig(templateIdOrApiName: string, disableApex?: boolean, options?: string): void;

    /**
     * Wire adapter to retrieve the release notes for a CRM Analytics template.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_get_wave_template_release_notes
     *
     * @param templateIdOrApiName The ID or developer name of the template.
     */
    export function getWaveTemplateReleaseNotes(templateIdOrApiName: string): void;

    /**
     * Wire adapter to retrieve a collection of CRM Analytics templates.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_wire_adapters_get_wave_templates
     *
     * @param options Template visibility options to apply to the collection results.
     *                Valid values are `CreateApp`, `ManageableOnly`, or `ViewOnly`.
     * @param type Template type to apply to the collection results.
     *             Valid values are `App`, `Dashboard`, `Data`, `Embedded`, or `Lens`.
     */
    export function getWaveTemplates(options?: string, type?: string): void;

    /**
     * Wire adapter to retrieve a specific Tableau CRM extended metadata type (Xmd) for a version of a dataset.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_wire_adapters_get_xmd
     *
     * @param datasetIdOrApiName The ID or developer name of the dataset.
     * @param versionId The ID of the dataset version.
     * @param xmdType The xmd type. Valid values are `Asset`, `Main`, `System`, or `User`.
     */
    export function getXmd(datasetIdOrApiName: string, versionId: string, xmdType: string): void;

    /**
     * Wire adapter to trigger the Tableau CRM connector to run a data sync. This API is the equivalent of the “Run Now” UI feature.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_ingest_data_connector
     *
     * @param connectorIdOrApiName The ID or developer name of the dataset.
     * @return A promise that will resolve to the ingest data connector response.
     */
    export function ingestDataConnector({ connectorIdOrApiName }: { connectorIdOrApiName: string }): Promise<RestoreDatasetVersionRepresentation>;

    /**
     * Wire adapter to updates Tableau CRM connectors.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_update_data_connector
     *
     * @param connectorIdOrApiName The ID or developer name of the dataset.
     * @param dataConnector.connectionProperties Connection properties for the connector.
     * @param dataConnector.connectorHandler Third party driver used for connection.
     * @param dataConnector.connectorType The type of the Data Connector.
     * @param dataConnector.folder Folder for the Live connector.
     * @param dataConnector.targetConnector AssetReference containing ID or API name of target connector associated with the current source connector.
     * @return A promise that will resolve to the data connector response.
     */
    export function updateDataConnector({
        connectorIdOrApiName,
        dataConnector,
    }: {
        connectorIdOrApiName: string;
        dataConnector: DataConnectorInputRepresentation;
    }): Promise<DataConnectorRepresentation>;

    /**
     * Updates a Tableau CRM dataflow job, which is the equivalent of clicking Stop for a data prep recipe, a data sync, or a dataflow in the Tableau CRM Data Manager UI.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_update_dataflow_job
     *
     * @param dataflowJobId The dataflow job ID.
     * @param dataflowJob.command The job command to execute. Must be `stop` to update a dataflow job.
     * @return A promise that will resolve to the dataflow job response.
     */
    export function updateDataflowJob({
        dataflowJobId,
        dataflowJob,
    }: {
        dataflowJobId: string;
        dataflowJob: DataflowJobInputRepresentation;
    }): Promise<DataflowJobRepresentation>;

    /**
     * Updates a specific CRM Analytics dataset by ID.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_analytics_update_dataset
     *
     * @param datasetIdOrApiName The ID or API name of the dataset.
     * @param dataset The dataset to update.
     * @return A promise that will resolve to the dataset response.
     */
    export function updateDataset({
        datasetIdOrApiName,
        dataset,
    }: {
        datasetIdOrApiName: string;
        dataset: DatasetInputRepresentation;
    }): Promise<DatasetRepresentation>;

    /**
     * Updates a specific CRM Analytics dataset version by dataset ID and version ID.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_analytics_update_dataset_version
     *
     * @param datasetIdOrApiName The ID or API name of the dataset.
     * @param versionId The ID of the dataset version.
     * @param datasetVersion The dataset version to update.
     * @return A promise that will resolve to the dataset version response.
     */
    export function updateDatasetVersion({
        datasetIdOrApiName,
        versionId,
        datasetVersion,
    }: {
        datasetIdOrApiName: string;
        versionId: string;
        datasetVersion: DatasetVersionInputRepresentation;
    }): Promise<DatasetVersionRepresentation>;

    /**
     * Updates a specific CRM Analytics recipe by ID.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_analytics_update_recipe
     *
     * @param id The ID of the recipe.
     * @param enableEditorValidation Indicates whether editor validation for the recipe is enabled (true) or not ( false).
     * @param validationContext The recipe validation context. Valid values are `Default` or `Editor`.
     * @param recipeObject  The recipe to update.
     * @return A promise that will resolce to the recipe response.
     */
    export function updateRecipe({
        id,
        enableEditorValidation,
        validationContext,
        recipeObject,
    }: {
        id: string;
        enableEditorValidation?: boolean;
        validationContext?: string;
        recipeObject: RecipeInputRepresentation;
    }): Promise<RecipeRepresentation>;

    /**
     * Updates a Data Prep recipe job notification.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.salesforce_recipes_api.meta/salesforce_recipes_api/sforce_recipes_api_resources_recipes_id_notification.htm
     *
     * @param id The ID of the recipe.
     * @param recipeNotification The recipe notification to update.
     * @return A promise that will resolve to the recipe notification response.
     */
    export function updateRecipeNotification({
        id,
        recipeNotification,
    }: {
        id: string;
        recipeNotification: RecipeNotificationInputRepresentation;
    }): Promise<RecipeNotificationRepresentation>;

    /**
     * Wire adapter to update the Tableau CRM replicated dataset.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_update_replicated_dataset
     *
     * @param id The ID of the replicated dataset.
     * @param replicatedDataset.advancedProperties List of user-specified advanced properties associated with this.
     * @param replicatedDataset.connectionMode Connection mode for pulling the data from the replicated dataset.
     * @param replicatedDataset.connectorId The id of the connector object used to replicate.
     * @param replicatedDataset.fullRefresh Whether to perform a one-time full refresh (during the next run) as opposed to incremental.
     * @param replicatedDataset.passThroughFilter Passthrough filter for the replicated object.
     * @param replicatedDataset.rowLevelSharing Inherit row level sharing rules for this object.
     * @param replicatedDataset.sourceObjectName The name of the source object to be replicated.
     * @return A promise that will resolve to the replicated dataset response.
     */
    export function updateReplicatedDataset({
        id,
        replicatedDataset,
    }: {
        id: string;
        replicatedDataset: ReplicatedDatasetInputRepresentation;
    }): Promise<ReplicatedDatasetRepresentation>;

    /**
     * Wire adapter to update the Tableau CRM replicated fields.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_update_replicated_dataset_fields
     *
     * @param id The ID of the replicated dataset.
     * @param replicatedFields.fields A list of configuration metadata that specifies how to replicate each field of a Replicated Dataset.
     * @return A promise that will resolve to the replicated fields response.
     */
    export function updateReplicatedFields({
        id,
        replicatedFields,
    }: {
        id: string;
        replicatedFields: ReplicatedFieldCollectionInputRepresentation;
    }): Promise<ReplicatedFieldCollectionRepresentation>;

    /**
     * Updates the schedule for a Tableau CRM data prep recipe, data sync, or dataflow.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_update_schedule
     *
     * @param assetId The ID of the dataflow, recipe, or data sync.
     * @param schedule The schedule to create or update for the dataflow, recipe, or data sync. Use a
     *                 {@link https://developer.salesforce.com/docs/atlas.en-us.bi_dev_guide_rest.meta/bi_dev_guide_rest/bi_resources_appendix.htm#ScheduleInputRepresentation|ScheduleInputRepresentation}.
     *                 Schedules are hourly, daily, weekly, monthly (relative), monthly (specific), and event based.
     * @return A promise that will resolve to the schedule response.
     */
    export function updateSchedule({
        assetId,
        schedule,
    }: {
        assetId: string;
        schedule: ScheduleInputRepresentation;
    }): Promise<
        | DailyScheduleRepresentation
        | EmptyScheduleRepresentation
        | EventDrivenScheduleRepresentation
        | HourlyScheduleRepresentation
        | MinutelyScheduleRepresentation
        | MonthlyRelativeScheduleRepresentation
        | MonthlySpecificScheduleRepresentation
        | WeeklyScheduleRepresentation
    >;

    /**
     * Updates a specific CRM Analytics user Xmd by dataset ID.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_analytics_update_xmd
     *
     * @param datasetIdOrApiName The ID or developer name of the dataset.
     * @param versionId The ID of the dataset version.
     * @param xmdType The xmd type. Valid values are `Asset`, `Main`, `System`, or `User`.
     * @param xmd
     */
    export function updateXmd({
        datasetIdOrApiName,
        versionId,
        xmdType,
        xmd,
    }: {
        datasetIdOrApiName: string;
        versionId: string;
        xmdType: string;
        xmd: XmdInputRepresentation;
    }): Promise<XmdRepresentation>;

    /**
     * Validates an Analytics template for org readiness.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/reference_analytics_validate_wave_template
     *
     * @param templateIdOrApiName The ID of template to retrieve the validation value for.
     * @param templateValidateParam The input to validate an Analytics template.
     * @param templateValidateParam.values A map of runtime template values to use during validation. These values override any default values.
     */
    export function validateWaveTemplate({
        templateIdOrApiName,
        templateValidateParam,
    }: {
        templateIdOrApiName: string;
        templateValidateParam: { values?: { [key: string]: unknown } };
    }): Promise<TemplateValidateRepresentation>;
}
