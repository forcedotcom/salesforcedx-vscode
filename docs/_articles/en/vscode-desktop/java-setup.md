---
title: Java Setup
lang: en
---

The Apex Language Server, shipped as part of the Salesforce Apex Extension for VS Code, depends on the Java Platform, Standard Edition Development Kit (JDK). It requires an installation of either JDK version 21 (Recommended), JDK version 17, or JDK version 11. By default, the extension attempts to locate your local Java installation by looking for a `JAVA_HOME` or `JDK_HOME` environment variable on your computer. If the extension can't find your Java installation, or if you want it to use a different installation, change the `salesforcedx-vscode-apex.java.home` setting.

## Download and Install JDK
You can download the JDK from one of these locations.

### Adoptium

[Adoptium](https://adoptium.net) provides prebuilt OpenJDK binaries for free without authentication or complications.

1. Navigate to the [Adoptium] (https://adoptium.net/?variant=openjdk21) JDK 21 download page.
2. Select the installer applicable to your system.
3. Download and open the downloaded file and complete the installation steps.

### Zulu

Zulu Java builds are TCK-tested and free to download and use without restrictions.

1. Navigate to the [Zulu download page](https://www.azul.com/downloads/?package=jdk#zulu).
2. Scroll down to Java Version **Java 21 (LTS)**.
3. Select your OS.
4. Select your Architecture.
5. Select your Java Package (JDK).
6. Click the **Download** button..
8. Once the file is downloaded, open it and complete the installation steps.

### Oracle Java 21 (Officially Tested)

1. Navigate to the [download page](https://www.oracle.com/java/technologies/downloads/#java21).
2. Click the download link that applies to your OS.
3. If prompted to log in, use your Oracle account.
4. Once the file is downloaded, open it and complete the installation steps.

**Note**: Installing from the executable correctly installs Java in the standard Java Home path (C:\Program Files\) making setting the JDK path straightforward.

## Update JDK Path

Update the salesforcedx-vscode-apex.java.home setting to the full pathname of the Java Runtime that is used to launch your Apex server.

1. Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Settings...** > **Settings** (macOS).
2. Search for `apex`.
3. Change the `salesforcedx-vscode-apex.java.home` setting to the full pathname of your Java Runtime. Do not set it to the Java executable itself.

**Note**: This pathname can’t point to a location inside your project folder. Also note that backslashes must be escaped on Windows.

![Apex Java Setting](./images/apex-java-home-setting.png)

Some examples of folder paths to the Java 21 runtime:

**MacOS**:

```json
{
  "salesforcedx-vscode-apex.java.home": "/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home"
}
```

**Windows**:

```json
{
  "salesforcedx-vscode-apex.java.home": "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.3.9-hotspot"
}
```

**Linux**:

**Pop! OS 20.04 (installation via aptitude)**:

```json
{
  "salesforcedx-vscode-apex.java.home": "/usr/lib/jvm/java-21-openjdk-amd64"
}
```

**Arch Linux (installation via AUR using package `jdk21-adoptopenjdk`)**:

```json
{
  "salesforcedx-vscode-apex.java.home": "/usr/lib/jvm/java-21-adoptopenjdk"
}
```

## Troubleshooting Tips

* If you see an error message that your Java version is not supported, open the Output tab on the bottom panel of VS Code. Filter by 'Apex'. Also review the 'Problems' tab to see that the Apex Language Server has been able to start.
* For Windows, ensure you are escaping the path to your JDK location appropriately.

  If your Java version is located at the following path:
  
              `C:\Program Files\Java\jdk-21`
  Your Java Home path should like this:
  
              `C:\\Program Files\\Java\\jdk-21`




## Advanced Setup

By default, a JVM allocates up to one fourth of the system's physical memory to the Apex Language Server process. If you are working on projects with more memory requirements, use the `salesforcedx-vscode-apex.java.memory` setting to override the defaults. Use this setting to specify the maximum size of memory allocation in megabytes and in multiples of 1024.

```json
{
  "salesforcedx-vscode-apex.java.memory": 4096
}
```
