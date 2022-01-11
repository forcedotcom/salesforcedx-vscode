---
title: Java Setup
lang: en
---

The Apex Language Server, shipped as part of the Salesforce Apex Extension for VS Code, depends on the Java Platform, Standard Edition Development Kit (JDK). It requires an installation of either JDK version 11 (Recommended) or JDK version 8. By default, the extension attempts to locate your local Java installation by looking for a `JAVA_HOME` or `JDK_HOME` environment variable on your computer. If the extension can't find your Java installation, or if you want it to use a different installation, change the `salesforcedx-vscode-apex.java.home` setting.

1. Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Preferences** > **Settings** (macOS).
2. Search for `apex`.
3. Change the `salesforcedx-vscode-apex.java.home` setting to the full pathname of your Java Runtime. Do **not** set it to the Java executable itself. Note that this pathname can't point to a location inside your project folder.

![Apex Java Setting](../../../images/apex-java-home-setting.png)

Below you'll find instructions on how to download and configure different versions of Java.

## AdoptOpenJDK

[AdoptOpenJDK](https://adoptopenjdk.net/) provides prebuilt OpenJDK binaries for free without authentication or complications.

1. Navigate to [AdoptOpenJDK](https://adoptopenjdk.net/?variant=openjdk11&jvmVariant=hotspot)
1. Select **OpenJDK 11 (LTS)**
1. Select **HotSpot**
1. Click the **Latest Release** button to download.
1. After the file has downloaded, open it and complete the installation steps.

Inside Visual Studio Code, set `salesforcedx-vscode-apex.java.home` to one of the following values.

MacOS:

For Mac OS X 10.5 or later, run `/usr/libexec/java_home` in your Terminal to get the default JDK location. To find all installed JDKs, use `/usr/libexec/java_home -V`.

```json
{
  "salesforcedx-vscode-apex.java.home": "/Library/Java/JavaVirtualMachines/adoptopenjdk-11.jdk/Contents/Home"
}
```

Windows:

```json
{
  "salesforcedx-vscode-apex.java.home": "C:\\Program Files\\AdoptOpenJDK\\jdk-11.0.3.7-hotspot"
}
```

Linux (Pop! OS 20.04, installation via aptitude):

```json
{
  "salesforcedx-vscode-apex.java.home": "/usr/lib/jvm/java-11-openjdk-amd64"
}
```

## Zulu

Zulu Java builds are TCK-tested and free to download and use without restrictions.

1. Navigate to the [Zulu download page](https://www.azul.com/downloads/zulu/)
1. Select version **11**
1. Select your OS
1. Download the installer
1. For macOS download the zip or dmg version.
1. For Windows Download the "11", "JDK", "Client" version.
1. Once the file is downloaded open it and complete the installation steps.

Inside Visual Studio Code, set `salesforcedx-vscode-apex.java.home` to one of the following values.

MacOS:

For Mac OS X 10.5 or later, run `/usr/libexec/java_home` in your Terminal to get the default JDK location. To find all installed JDKs, use `/usr/libexec/java_home -V`.

```json
{
  "salesforcedx-vscode-apex.java.home": "/Library/Java/JavaVirtualMachines/zulu-11.jdk/Contents/Home"
}
```

Windows:

```json
{
  "salesforcedx-vscode-apex.java.home": "C:\\Program Files\\Zulu\\zulu-11"
}
```

## Oracle Java 11 (Officially Tested)

1. Navigate to the [download page](https://www.oracle.com/technetwork/java/javase/downloads/jdk11-downloads-5066655.html)
1. Click the **Download** button for **Java SE 11.x.y (LTS)**
1. Accept the license agreement
1. Click the download link that applies to your OS
1. For macOS download the dmg version.
1. For Windows Download exe version.
1. If prompted to log in, use your Oracle account.
1. Once the file is downloaded open it and complete the installation steps.

Inside Visual Studio Code, set `salesforcedx-vscode-apex.java.home` to one of the following values.

MacOS:

For Mac OS X 10.5 or later, run `/usr/libexec/java_home` in your Terminal to get the default JDK location. To find all installed JDKs, use `/usr/libexec/java_home -V`.

```json
{
  "salesforcedx-vscode-apex.java.home": "/Library/Java/JavaVirtualMachines/jdk-11.0.3.jdk/Contents/Home"
}
```

Windows:

```json
{
  "salesforcedx-vscode-apex.java.home": "C:\\Program Files\\Java\\jdk11.0.3"
}
```

## Oracle Java 8 (Legacy)

If you are still running Java 8 the values for `salesforcedx-vscode-apex.java.home` are as follows.

MacOS:

For Mac OS X 10.5 or later, run `/usr/libexec/java_home` in your Terminal to get the default JDK location. To find all installed JDKs, use `/usr/libexec/java_home -V`.

```json
{
  "salesforcedx-vscode-apex.java.home": "/Library/Java/JavaVirtualMachines/jdk1.8.0_131.jdk/Contents/Home"
}
```

Windows:

```json
{
  "salesforcedx-vscode-apex.java.home": "C:\\Program Files\\Java\\jdk1.8.0_131"
}
```

## Advanced Setup

By default, a JVM allocates up to one fourth of the system's physical memory to the Apex Language Server process. If you are working on projects with more memory requirements, use the `salesforcedx-vscode-apex.java.memory` setting to override the defaults. Use this setting to specify the maximum size of memory allocation in megabytes and in multiples of 1024.

```json
{
  "salesforcedx-vscode-apex.java.memory": 4096
}
```
