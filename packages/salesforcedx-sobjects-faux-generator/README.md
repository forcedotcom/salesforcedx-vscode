# salesforcedx-sobjects-faux-generator

This repository contains a generator that transforms Salesforce objects and their fields
into faux classes understood by the Apex Language Server.

## Process

there are 2 paths: "startup" and "startupmin"

- controlled by a vscode setting `ENABLE_SOBJECT_REFRESH_ON_STARTUP`
- min loads from the `minSobjects.json` file
- regular does the following
  - get the list of sbojects from describe (OrgObjectRetriever)
  - describe each object (in batches, using the composite API) (OrgObjectDetailRetriever)

Then the 2 paths merge and the "generators" run

- faux classes (standard obj)
- faux classes (custom obj)
- typings (d.ts files)
- json equivalents of all objects (for soql purposes)

these use iterators to provide cancellability

## Proposed Pipeline

- get names (min or orgDescribe)
- filter by standard/custom if required
- get describe (min or orgDescribe)
- organize by standard/custom
- file outputs. in parallel
  - write the faux classes for the objects
  - write the typings
  - write the json

between steps, check for cancellation and handle errors
