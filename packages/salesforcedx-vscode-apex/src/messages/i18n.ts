/**
 * Conventions:
 * _message: is for unformatted text that will be shown as-is to
 * the user.
 * _text: is for text that will appear in the UI, possibly with
 * decorations, e.g., $(x) uses the https://octicons.github.com/ and should not
 * be localized
 *
 * If ommitted, we will assume _message.
 */
export const messages = {
  source_java_home_setting_text:
    'The salesforcedx-vscode-apex.java.home setting defined in VS Code settings',
  source_jdk_home_env_var_text: 'The JDK_HOME environment variable',
  source_java_home_env_var_text: 'The JAVA_HOME environment variable',
  source_missing_text: '%s points to a missing folder',
  java_runtime_missing_text:
    'Java runtime could not be located. Set one using the salesforcedx-vscode-apex.java.home VS Code setting',
  wrong_java_version_text:
    'Java 8 (or higher) is required to turn. Please download and install it.'
};
