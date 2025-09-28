#!/usr/bin/env python3
"""
Convert metadata_types_map.json to clean XSD file in the style of metadata-types.xsd.
"""

import json
import re
from pathlib import Path
from datetime import datetime


def clean_xsd_name(name):
    """Clean a name to be valid for XSD element names."""
    # Replace spaces and special characters with underscores
    cleaned = re.sub(r'[^\w]', '_', name)
    # Ensure it starts with a letter or underscore
    if cleaned and not cleaned[0].isalpha() and cleaned[0] != '_':
        cleaned = 'field_' + cleaned
    # Remove multiple consecutive underscores
    cleaned = re.sub(r'_+', '_', cleaned)
    # Remove trailing underscores
    cleaned = cleaned.rstrip('_')
    return cleaned or 'unknown_field'


def map_field_type_to_xsd(field_type):
    """Map Salesforce field types to XSD types."""
    field_type = field_type.lower().strip()

    # Basic types
    if 'string' in field_type or 'text' in field_type:
        return 'xsd:string'
    elif 'boolean' in field_type:
        return 'xsd:boolean'
    elif 'int' in field_type or 'integer' in field_type:
        return 'xsd:int'
    elif 'double' in field_type or 'decimal' in field_type or 'number' in field_type:
        return 'xsd:double'
    elif 'date' in field_type:
        if 'time' in field_type:
            return 'xsd:dateTime'
        else:
            return 'xsd:date'
    elif 'base64' in field_type:
        return 'xsd:base64Binary'
    elif 'reference' in field_type:
        return 'xsd:string'  # References are typically string IDs
    elif 'picklist' in field_type or 'enumeration' in field_type:
        return 'xsd:string'  # Picklists are string values
    elif 'multipicklist' in field_type:
        return 'xsd:string'  # Multi-picklists are string values
    elif 'email' in field_type:
        return 'xsd:string'
    elif 'url' in field_type:
        return 'xsd:anyURI'
    elif 'phone' in field_type:
        return 'xsd:string'
    elif field_type.endswith('[]'):
        return 'xsd:string'  # Arrays - simplified as string
    else:
        return 'xsd:string'  # Default to string for unknown types


def escape_xml(text):
    """Escape XML special characters."""
    if not text:
        return ''

    text = str(text)
    # Basic XML escaping
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    text = text.replace('"', '&quot;')
    text = text.replace("'", '&apos;')

    # Remove or replace problematic characters
    text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)

    return text


def create_clean_xsd_from_json(json_file_path, output_file_path):
    """Convert JSON metadata to clean XSD schema in the style of metadata-types.xsd."""

    # Load JSON data
    with open(json_file_path, 'r', encoding='utf-8') as f:
        metadata_types = json.load(f)

    # Create XSD header
    current_time = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    num_types = len(metadata_types)

    xsd_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!--',
        f'Salesforce Metadata Types XSD - Generated from metadata documentation',
        f'This file contains all metadata type definitions for hover documentation and IDE support.',
        '',
        f'Generated on: {current_time}',
        f'Total metadata types: {num_types}',
        '-->',
        '<xsd:schema',
        ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"',
        ' targetNamespace="http://soap.sforce.com/2006/04/metadata"',
        ' xmlns:tns="http://soap.sforce.com/2006/04/metadata"',
        ' elementFormDefault="qualified">'
    ]

    # Add base Metadata type
    xsd_lines.extend([
        ' <xsd:complexType name="Metadata">',
        '  <xsd:choice>',
        '   <xsd:element name="fullName" minOccurs="0" type="xsd:string"/>',
        '  </xsd:choice>',
        ' </xsd:complexType>'
    ])

    # Process each metadata type
    for type_name, type_data in sorted(metadata_types.items()):
        # Skip the base Metadata type to avoid duplicate definition
        if type_name == 'Metadata':
            continue

        clean_type_name = clean_xsd_name(type_name)
        fields = type_data.get('fields', [])

        # Create complex type
        short_desc = type_data.get('short_description', '')
        url = type_data.get('url', '')

        xsd_lines.append(f' <xsd:complexType name="{clean_type_name}">')

        # Add type-level documentation
        if short_desc or url:
            xsd_lines.append('  <xsd:annotation>')
            if short_desc:
                escaped_desc = escape_xml(short_desc)
                xsd_lines.append(f'   <xsd:documentation>{escaped_desc}</xsd:documentation>')
            if url:
                escaped_url = escape_xml(url)
                xsd_lines.append(f'   <xsd:appinfo>Documentation: {escaped_url}</xsd:appinfo>')
            xsd_lines.append('  </xsd:annotation>')

        if fields:
            xsd_lines.append('  <xsd:complexContent>')
            xsd_lines.append('   <xsd:extension base="tns:Metadata">')
            xsd_lines.append('    <xsd:choice>')

            # Add fields
            for field in fields:
                field_name = field.get('Field Name', '')
                field_type = field.get('Field Type', '')
                description = field.get('Description', '')

                if field_name:
                    clean_field_name = clean_xsd_name(field_name)
                    xsd_type = map_field_type_to_xsd(field_type)

                    xsd_lines.append(f'     <xsd:element name="{clean_field_name}" minOccurs="0" type="{xsd_type}">')

                    # Add field-level documentation
                    if description or field_type:
                        xsd_lines.append('      <xsd:annotation>')
                        if description:
                            escaped_desc = escape_xml(description)
                            xsd_lines.append(f'       <xsd:documentation>{escaped_desc}</xsd:documentation>')
                        if field_type:
                            escaped_type = escape_xml(field_type)
                            xsd_lines.append(f'       <xsd:appinfo>Type: {escaped_type}</xsd:appinfo>')
                        xsd_lines.append('      </xsd:annotation>')

                    xsd_lines.append('     </xsd:element>')

            xsd_lines.extend([
                '    </xsd:choice>',
                '   </xsd:extension>',
                '  </xsd:complexContent>'
            ])
        else:
            # No fields, just extend base Metadata
            xsd_lines.extend([
                '  <xsd:complexContent>',
                '   <xsd:extension base="tns:Metadata">',
                '    <xsd:choice/>',
                '   </xsd:extension>',
                '  </xsd:complexContent>'
            ])

        xsd_lines.append(' </xsd:complexType>')

    # Add element declarations for all metadata types
    xsd_lines.append('')
    xsd_lines.append(' <!-- Element declarations for all metadata types -->')
    for type_name, type_data in sorted(metadata_types.items()):
        # Skip the base Metadata type to avoid duplicate definition
        if type_name == 'Metadata':
            continue

        clean_type_name = clean_xsd_name(type_name)
        short_desc = type_data.get('short_description', '')
        url = type_data.get('url', '')

        xsd_lines.append(f' <xsd:element name="{clean_type_name}" type="tns:{clean_type_name}"/>')

    # Close schema
    xsd_lines.append('</xsd:schema>')

    # Write to file
    with open(output_file_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(xsd_lines))

    return len(metadata_types)


def main():
    """Main function to convert JSON to clean XSD."""
    json_file = Path("/Users/daphne.yang/Downloads/api_meta/metadata_types_map.json")
    xsd_file = Path("/Users/daphne.yang/Downloads/api_meta/salesforce_metadata_api_clean.xsd")

    if not json_file.exists():
        print(f"Error: {json_file} not found")
        return

    print(f"Converting {json_file} to clean XSD format...")

    try:
        num_types = create_clean_xsd_from_json(json_file, xsd_file)
        print(f"Successfully converted {num_types} metadata types to clean XSD")
        print(f"Output saved to: {xsd_file}")

        # Print file size
        file_size = xsd_file.stat().st_size / 1024  # KB
        print(f"XSD file size: {file_size:.1f} KB")

    except Exception as e:
        print(f"Error during conversion: {e}")
        raise


if __name__ == "__main__":
    main()
