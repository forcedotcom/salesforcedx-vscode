// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

function getComponentLibraryLink(name) {
    return '[View in Component Library](https://developer.salesforce.com/docs/component-library/bundle/' + name + ')';
}

function getHover(tag, name) {
    let retVal = tag.description + '\n' + getComponentLibraryLink(name) + '\n### Attributes\n';

    for (const info of tag.attributes) {
        retVal += getAttributeMarkdown(info);
        retVal += '\n';
    }

    return retVal;
}

function getAttributeMarkdown(attribute) {
    if (attribute.name && attribute.type && attribute.description) {
        return '* **' + attribute.name + '**: *' + attribute.type + '* ' + attribute.description;
    }

    if (attribute.name && attribute.type) {
        return '* **' + attribute.name + '**: *' + attribute.type + '*';
    }

    if (attribute.name) {
        return '* **' + attribute.name + '**';
    }

    return '';
}

// read old file
const lwcStandard = path.join(__dirname, '..', 'src', 'build-time-resources', 'lwc-standard.json');
const f = fs.readFileSync(lwcStandard, { encoding: 'utf-8' });
const data = JSON.parse(f.toString());

// create tags from old file
const tags = Object.keys(data).map((key) => {
    const tag = data[key];
    return {
        name: key,
        description: getHover(tag, key),
        attributes: tag.attributes.map(({ name, description }) => ({
            name,
            description,
        })),
    };
});

// make globalAttribute changes here, not in transformed-lwc-standard.json as they'll be overwritten
const globalAttributes = [
    {
        name: 'for:each',
        description: 'Renders the element or template block multiple times based on the expression value.',
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
    {
        name: 'for:item',
        description: 'Bind the current iteration item to an identifier.',
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
    {
        name: 'for:index',
        description: 'Bind the current iteration index to an identifier.',
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
    {
        name: 'if:true',
        description:
            'Renders the element or template if the expression value is truthy. This directive is deprecated and no longer recommended. It may be removed in the future. Use lwc:if, lwc:elseif, and lwc:else instead.',
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
    {
        name: 'if:false',
        description:
            'Renders the element or template if the expression value is falsy. This directive is deprecated and no longer recommended. It may be removed in the future. Use lwc:if, lwc:elseif, and lwc:else instead.',
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
    {
        name: 'lwc:if',
        description: 'Renders the element or template if the expression value is truthy.',
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
    {
        name: 'lwc:elseif',
        description: 'Renders the element or template if the expression value is truthy.',
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
    {
        name: 'lwc:else',
        description: 'Renders the element or template if none of the expressions values of the preceding lwc:if or lwc:elseif are truthy.',
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
    {
        name: 'iterator:it',
        description: {
            kind: 'markdown',
            value: 'Bind the current iteration item to an identifier. Contains properties (`value`, `index`, `first`, `last`) that let you apply special behaviors to certain items.',
        },
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
];

const newJson = {
    version: '1.1',
    tags,
    globalAttributes,
};

const transformedLWC = path.join(__dirname, '..', 'src', 'resources', 'transformed-lwc-standard.json');
fs.writeFileSync(transformedLWC, JSON.stringify(newJson, null, 2));

console.log('done building transformed-lwc-standard.json');
