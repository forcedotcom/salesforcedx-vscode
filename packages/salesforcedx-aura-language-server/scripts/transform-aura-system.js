// NOTE: This script is not used in the build.js, but needs to be run manually to update the aura-system.json file
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'src', 'build-time-resources', 'aura-system.json');
const outputPath = path.join(__dirname, '..', 'src', 'resources', 'transformed-aura-system.json');

const tags = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

const tagkeys = Object.keys(tags);
for (const key of tagkeys) {
    const tag = tags[key];
    tag.namespace = 'aura';
    const a = [];
    for(const attr of Object.keys(tag.attributes)) {
        const new_attribute = {
            ...tag.attributes[attr]
        }
        new_attribute.name = attr;
        a.push(new_attribute);
        if (new_attribute.required) {
            new_attribute.required = 'true';
        } else {
            new_attribute.required = 'false';
        }
        new_attribute.access = 'global';
    }
    tag.attributes = a;
}
const out = JSON.stringify(tags, null, 3);
fs.writeFileSync(outputPath, out, 'utf-8');