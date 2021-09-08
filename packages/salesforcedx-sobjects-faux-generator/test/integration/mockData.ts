/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SObject } from '../../src/types';

export const mockAPIResponse = {
  hasErrors: false,
  results: [
    {
      statusCode: 200,
      result: {
        actionOverrides: [],
        activateable: false,
        childRelationships: [],
        compactLayoutable: false,
        createable: false,
        custom: false,
        customSetting: false,
        deletable: false,
        deprecatedAndHidden: false,
        feedEnabled: false,
        fields: [
          {
            aggregatable: true,
            aiPredictionField: false,
            autoNumber: false,
            byteLength: 18,
            calculated: false,
            calculatedFormula: null,
            cascadeDelete: false,
            caseSensitive: false,
            compoundFieldName: null,
            controllerName: null,
            createable: false,
            custom: false,
            defaultValue: null,
            defaultValueFormula: null,
            defaultedOnCreate: true,
            dependentPicklist: false,
            deprecatedAndHidden: false,
            digits: 0,
            displayLocationInDecimal: false,
            encrypted: false,
            externalId: false,
            extraTypeInfo: null,
            filterable: true,
            filteredLookupInfo: null,
            formulaTreatNullNumberAsZero: false,
            groupable: true,
            highScaleNumber: false,
            htmlFormatted: false,
            idLookup: true,
            inlineHelpText: null,
            label: 'Apex Page Info ID',
            length: 18,
            mask: null,
            maskType: null,
            name: 'Id',
            nameField: false,
            namePointing: false,
            nillable: false,
            permissionable: false,
            picklistValues: [],
            polymorphicForeignKey: false,
            precision: 0,
            queryByDistance: false,
            referenceTargetField: null,
            referenceTo: [],
            relationshipName: null,
            relationshipOrder: null,
            restrictedDelete: false,
            restrictedPicklist: false,
            scale: 0,
            searchPrefilterable: false,
            soapType: 'tns:ID',
            sortable: true,
            type: 'id',
            unique: false,
            updateable: false,
            writeRequiresMasterRead: false
          }
        ],
        hasSubtypes: false,
        isSubtype: false,
        keyPrefix: '4ve',
        label: 'Apex Page Info',
        labelPlural: 'Apex Pages Info',
        layoutable: false,
        listviewable: null,
        lookupLayoutable: null,
        mergeable: false,
        mruEnabled: false,
        name: 'ApexPageInfo',
        namedLayoutInfos: [],
        networkScopeFieldName: null,
        queryable: true,
        recordTypeInfos: [],
        replicateable: false,
        retrieveable: false,
        searchLayoutable: false,
        searchable: false,
        supportedScopes: [{ label: 'All apex pages info', name: 'everything' }],
        triggerable: false,
        undeletable: false,
        updateable: false,
        urls: {
          rowTemplate: '/services/data/v46.0/sobjects/ApexPageInfo/{ID}',
          defaultValues:
            '/services/data/v46.0/sobjects/ApexPageInfo/defaultValues?recordTypeId&fields',
          describe: '/services/data/v46.0/sobjects/ApexPageInfo/describe',
          sobject: '/services/data/v46.0/sobjects/ApexPageInfo'
        }
      }
    }
  ]
};

// Minimal version of result[0] above, using smaller SObject representation
export const mockMinimizedResponseResult: SObject = {
  childRelationships: [],
  custom: false,
  fields: [
    {
      aggregatable: true,
      custom: false,
      defaultValue: null,
      extraTypeInfo: null,
      filterable: true,
      groupable: true,
      inlineHelpText: null,
      label: 'Apex Page Info ID',
      name: 'Id',
      nillable: false,
      picklistValues: [],
      referenceTo: [],
      relationshipName: null,
      sortable: true,
      type: 'id'
    }
  ],
  label: 'Apex Page Info',
  name: 'ApexPageInfo',
  queryable: true
};

export const mockBatchResponse = {
  hasErrors: false,
  results: [
    {
      statusCode: 200,
      result: { name: 'Account' }
    },
    {
      statusCode: 200,
      result: { name: 'Attachment' }
    },
    {
      statusCode: 200,
      result: { name: 'Case' }
    },
    {
      statusCode: 200,
      result: { name: 'Contact' }
    },
    {
      statusCode: 200,
      result: { name: 'Contract' }
    },
    {
      statusCode: 200,
      result: { name: 'Lead' }
    },
    {
      statusCode: 200,
      result: { name: 'Note' }
    },
    {
      statusCode: 200,
      result: { name: 'Opportunity' }
    },
    {
      statusCode: 200,
      result: { name: 'Order' }
    },
    {
      statusCode: 200,
      result: { name: 'Pricebook2' }
    },
    {
      statusCode: 200,
      result: { name: 'PricebookEntry' }
    },
    {
      statusCode: 200,
      result: { name: 'Product2' }
    },
    {
      statusCode: 200,
      result: { name: 'RecordType' }
    },
    {
      statusCode: 200,
      result: { name: 'Report' }
    },
    {
      statusCode: 200,
      result: { name: 'Task' }
    },
    {
      statusCode: 200,
      result: { name: 'User' }
    }
  ]
};
