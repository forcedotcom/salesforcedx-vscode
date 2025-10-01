#!/usr/bin/env python3
"""
Parse XML files in the objects directory and create a JSON map of title to shortdesc.
"""

import os
import json
import xml.etree.ElementTree as ET
from pathlib import Path
import re


def clean_text(text):
    """Clean up text by removing extra whitespace and XML tags."""
    if not text:
        return ""

    # Remove XML tags while preserving text content
    text = re.sub(r'<[^>]+>', '', text)
    # Normalize whitespace
    text = ' '.join(text.split())
    return text.strip()


def extract_fields_from_table(root):
    """Extract field information from table structures in the XML."""
    fields = []

    # Look for tables with Field Name, Field Type, Description headers
    tables = root.findall('.//table')

    for table in tables:
        # Check if this table has the right header structure
        header_row = table.find('.//thead/row')
        if header_row is not None:
            entries = header_row.findall('entry')
            if len(entries) >= 3:
                headers = [clean_text(''.join(entry.itertext())) for entry in entries[:3]]
                if (headers[0].lower().replace(' ', '') == 'fieldname' and
                    headers[1].lower().replace(' ', '') == 'fieldtype' and
                    'description' in headers[2].lower()):

                    # Extract field rows from tbody
                    tbody = table.find('.//tbody')
                    if tbody is not None:
                        rows = tbody.findall('row')
                        for row in rows:
                            entries = row.findall('entry')
                            if len(entries) >= 3:
                                # Extract field name (look for parmname tag first, then fallback to text)
                                field_name_elem = entries[0].find('.//parmname')
                                if field_name_elem is not None:
                                    field_name = clean_text(''.join(field_name_elem.itertext()))
                                else:
                                    field_name = clean_text(''.join(entries[0].itertext()))

                                # Extract field type
                                field_type = clean_text(''.join(entries[1].itertext()))

                                # Extract description
                                description = clean_text(''.join(entries[2].itertext()))

                                if field_name and field_type:  # Only add if we have at least name and type
                                    fields.append({
                                        "Field Name": field_name,
                                        "Field Type": field_type,
                                        "Description": description
                                    })

    return fields


def extract_title_shortdesc_fields_and_url(xml_file_path):
    """Extract title, shortdesc, fields, and reference URL from an XML file."""
    try:
        tree = ET.parse(xml_file_path)
        root = tree.getroot()

        # Find title element
        title_elem = root.find('.//title')
        title = ""
        if title_elem is not None:
            # Get all text content including nested elements
            title = ''.join(title_elem.itertext())
            title = clean_text(title)

        # Find shortdesc element
        shortdesc_elem = root.find('.//shortdesc')
        shortdesc = ""
        if shortdesc_elem is not None:
            # Get all text content including nested elements
            shortdesc = ''.join(shortdesc_elem.itertext())
            shortdesc = clean_text(shortdesc)

        # Extract fields
        fields = extract_fields_from_table(root)

        # Extract reference ID from the root element
        reference_id = ""
        if root.tag == 'reference' and 'id' in root.attrib:
            reference_id = root.attrib['id']

        # Build URL
        url = ""
        if reference_id:
            url = f"https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/{reference_id}.htm"

        return title, shortdesc, fields, url

    except ET.ParseError as e:
        print(f"Error parsing {xml_file_path}: {e}")
        return None, None, None, None
    except Exception as e:
        print(f"Unexpected error processing {xml_file_path}: {e}")
        return None, None, None, None


def main():
    """Main function to process all XML files and create JSON output."""
    # Define the objects directory path
    objects_dir = Path("/Users/daphne.yang/Downloads/api_meta/objects")

    if not objects_dir.exists():
        print(f"Error: Directory {objects_dir} does not exist")
        return

    # Dictionary to store metadata type information
    metadata_types = {}

    # Track statistics
    total_files = 0
    processed_files = 0
    error_files = 0
    total_fields = 0

    # Process all XML files in the objects directory
    for xml_file in objects_dir.glob("*.xml"):
        total_files += 1
        print(f"Processing: {xml_file.name}")

        title, shortdesc, fields, url = extract_title_shortdesc_fields_and_url(xml_file)

        if title is not None and shortdesc is not None and fields is not None and url is not None:
            if title:  # Only add if title is not empty
                metadata_types[title] = {
                    "short_description": shortdesc,
                    "fields": fields,
                    "url": url
                }
                processed_files += 1
                total_fields += len(fields)
                if fields:
                    print(f"  Found {len(fields)} fields")
                if url:
                    print(f"  URL: {url}")
            else:
                print(f"Warning: Empty title in {xml_file.name}")
                error_files += 1
        else:
            error_files += 1

    # Save to JSON file
    output_file = objects_dir.parent / "metadata_types_map.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(metadata_types, f, indent=2, ensure_ascii=False, sort_keys=True)

    # Print statistics
    print(f"\n=== Processing Summary ===")
    print(f"Total XML files found: {total_files}")
    print(f"Successfully processed: {processed_files}")
    print(f"Files with errors/empty titles: {error_files}")
    print(f"Unique metadata types extracted: {len(metadata_types)}")
    print(f"Total fields extracted: {total_fields}")
    print(f"Main output saved to: {output_file}")

    # Print a few examples
    if metadata_types:
        print(f"\n=== Sample Results ===")
        for i, (title, data) in enumerate(sorted(metadata_types.items())):
            if i >= 3:  # Show first 3 examples
                break
            print(f"Title: {title}")
            print(f"Short Description: {data['short_description'][:100]}{'...' if len(data['short_description']) > 100 else ''}")
            print(f"Number of Fields: {len(data['fields'])}")
            print(f"URL: {data['url']}")
            if data['fields']:
                print("Sample Fields:")
                for j, field in enumerate(data['fields'][:2]):  # Show first 2 fields
                    print(f"  - {field['Field Name']} ({field['Field Type']}): {field['Description'][:80]}{'...' if len(field['Description']) > 80 else ''}")
            print("-" * 80)


if __name__ == "__main__":
    main()
