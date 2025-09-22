#!/usr/bin/env python3
"""
Simple Salesforce Metadata API Scraper

A focused script to extract metadata type URLs from the Salesforce Metadata API Developer Guide.
Based on the pattern: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_<type>.htm

Usage:
    python simple_metadata_scraper.py

Requirements:
    pip install requests beautifulsoup4
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import sys


def extract_metadata_name_from_href(href, text):
    """
    Extract a clean metadata type name from the href and text.
    """
    # Remove meta_ prefix and .htm suffix from href
    base_name = href.replace('meta_', '').replace('.htm', '')

    # Convert common patterns to proper metadata type names
    name_mappings = {
        'classes': 'ApexClass',
        'trigger': 'ApexTrigger',
        'pages': 'ApexPage',
        'components': 'ApexComponent',
        'customobject': 'CustomObject',
        'customfield': 'CustomField',
        'customapplication': 'CustomApplication',
        'customtab': 'CustomTab',
        'customlabel': 'CustomLabel',
        'custommetadata': 'CustomMetadata',
        'permissionset': 'PermissionSet',
        'remotesitesetting': 'RemoteSiteSetting',
        'emailtemplate': 'EmailTemplate',
        'staticresource': 'StaticResource'
    }

    if base_name in name_mappings:
        return name_mappings[base_name]

    # For other cases, use the text if it looks like a proper name
    if text and re.match(r'^[A-Za-z][A-Za-z0-9_]*$', text) and len(text) > 2:
        return text

    # Otherwise, convert snake_case to PascalCase
    parts = base_name.split('_')
    if len(parts) > 0:
        return ''.join(word.capitalize() for word in parts)

    return None

def get_metadata_types_mapping():
    """
    Scrape metadata types from the official Salesforce Metadata API documentation.
    Uses the API endpoint that powers the documentation website.

    Returns:
        dict: Mapping of metadata type names to their documentation URLs
    """

    # This is the actual API endpoint that provides the TOC for the documentation
    api_url = "https://developer.salesforce.com/docs/get_document/atlas.en-us.api_meta.meta"
    base_url = "https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/"

    metadata_mapping = {}
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_types_list.htm'
    })

    print("🎯 Reading from official Salesforce Metadata API documentation...")
    print(f"API Source: {api_url}")

    try:
        response = session.get(api_url, timeout=30)
        response.raise_for_status()

        # Parse the JSON response
        data = response.json()
        print(f"✅ Successfully fetched API data ({len(response.text):,} characters)")

        def search_toc_recursively(toc_items):
            """Recursively search through TOC structure for metadata types."""
            if not toc_items:
                return

            for item in toc_items:
                if isinstance(item, dict):
                    # Check if this item has an href pointing to a metadata type
                    if 'a_attr' in item and 'href' in item['a_attr']:
                        href = item['a_attr']['href']
                        text = item.get('text', '')

                        # Look for metadata type links
                        if href.startswith('meta_') and href.endswith('.htm'):
                            # Skip navigation pages
                            skip_patterns = [
                                'meta_intro', 'meta_types_list', 'meta_metadata',
                                'meta_unsupported', 'meta_coverage', 'meta_deploy',
                                'meta_retrieve', 'meta_file', 'meta_crud', 'meta_result',
                                'meta_standardvalueset', 'meta_quick_start', 'meta_whats_new',
                                'meta_headers', 'meta_call', 'meta_session', 'meta_debugging',
                                'meta_allornone', 'meta_rns', 'meta_support_policy',
                                'meta_quickstart', 'meta_use_cases', 'meta_editions',
                                'meta_developer_tools', 'meta_dev_platforms', 'meta_standards',
                                'meta_api_eol', 'meta_related_resources', 'meta_user_references',
                                'meta_rest_intro', 'meta_rest_deploy', 'meta_error_handling',
                                'meta_utility_calls', 'meta_objects_intro', 'meta_special_behavior',
                                'meta_data_cloud_types', 'meta_field_types', 'meta_settings'
                            ]

                            if not any(pattern in href for pattern in skip_patterns):
                                full_url = base_url + href
                                clean_name = extract_metadata_name_from_href(href, text)
                                if clean_name and clean_name not in metadata_mapping:
                                    metadata_mapping[clean_name] = full_url
                                    print(f"✓ Found: {clean_name}")

                    # Recursively search children
                    if 'children' in item:
                        search_toc_recursively(item['children'])

        # Look for the TOC structure in the response
        if 'toc' in data:
            print("📋 Parsing Table of Contents structure...")
            search_toc_recursively(data['toc'])
        else:
            print("⚠️ No TOC structure found in API response")
            return {}

        print(f"\n📊 Successfully extracted {len(metadata_mapping)} metadata types from official API")

    except requests.RequestException as e:
        print(f"❌ Failed to fetch metadata API documentation: {e}")
        print("Cannot proceed without access to the official API.")
        return {}

    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse API response as JSON: {e}")
        print("The API response format may have changed.")
        return {}

    return metadata_mapping

def main():
    """Main execution function"""
    print("🔍 Salesforce Metadata Types Scraper")
    print("Reading from official Salesforce Metadata API Developer Guide")
    print("=" * 60)

    try:
        # Get the mapping from official page only
        mapping = get_metadata_types_mapping()

        if not mapping:
            print("\n❌ No metadata types were found in the official page.")
            print("\nThis is likely because the page uses JavaScript to dynamically load")
            print("the sidebar navigation (show-tree container) that contains the metadata type links.")
            print("\nTo fully parse this page, the script would need:")
            print("- A headless browser like Selenium to render JavaScript")
            print("- Or access to the underlying API that populates the sidebar")
            sys.exit(1)

        # Save to JSON file
        output_file = 'metadata_types_mapping.json'
        with open(output_file, 'w') as f:
            json.dump(mapping, f, indent=2, sort_keys=True)

        print(f"\n✅ Successfully read {len(mapping)} metadata types from official documentation!")
        print(f"💾 Saved mapping to {output_file}")

        # Display some examples
        print("\n📄 Sample mappings:")
        count = 0
        for metadata_type, url in sorted(mapping.items()):
            if count < 5:
                print(f"  {metadata_type}: {url}")
                count += 1

        if len(mapping) > 5:
            print(f"  ... and {len(mapping) - 5} more")

        # Print the full mapping
        print(f"\n📋 Complete Metadata Types Mapping:")
        print("=" * 50)
        print(json.dumps(mapping, indent=2, sort_keys=True))

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
