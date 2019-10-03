---
title: Source Format
lang: en
---

The commands that Salesforce Extensions for VS Code uses to push, pull, deploy, and retrieve your source assume that your files are in source format (rather than metadata format). Source format is optimized for working with version control systems. For details, see [Salesforce DX Project Structure and Source Format](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_source_file_format.htm) in the _Salesforce DX Developer Guide_.

Because Force.com IDE used metadata format, you can’t open your Force.com IDE projects in VS Code. To work with the commands described in this article, either convert your metadata to source format (using `sfdx force:mdapi:convert`) or create a new project and then retrieve the metadata from your org using the manifest (`package.xml` file) that you used in your previous IDE.

For information about converting to source format and maintaining Git history, see [this blog post](https://ntotten.com/2018/05/11/convert-metadata-to-source-format-while-maintain-git-history/).
