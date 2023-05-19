import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as cp from 'child_process';

type packageResultType = {
  messages: string[];
  varMessageRefs: {
    file: string;
    variable: string;
  }[];
};

type resultType = Record<string, packageResultType>[];

function findUnusedAndMissingMessages(
  srcPath: string,
  sourceFiles: string[],
  messageMap: Record<string, string>
) {
  const srcMessages = sourceFiles
    .map(file => {
      return {
        name: file,
        path: path.join(srcPath, file)
      } as { name: string; path: string };
    })
    .map(file => {
      return {
        ...file,
        source: fs.readFileSync(file.path, 'utf8')
      };
    })
    // find all the messages references in the source by looking for the nls.localize calls
    .map(file => {
      const result = {
        ...file,
        messages: [],
        varMessageRefs: []
      } as {
        name: string;
        source: string;
        messages: string[];
        varMessageRefs: { file: string; variable: string }[];
      };
      const matches = file.source.match(/\.localize\(\s*['"](.*?)['"]/g);
      if (matches) {
        result.messages = matches.map(match =>
          match.replace(/\.localize\(\s*['"](.*?)['"]/g, '$1')
        );
      }
      const varMatches = Array.from(
        file.source.matchAll(/\.localize\(\s*((?:\w+)(\.\w+)?)/g)
      );
      if (varMatches) {
        result.varMessageRefs = varMatches.map(match => {
          const variable = match[1];
          return {
            file: file.name,
            variable
          };
        });
      }
      // TODO: remove this
      result.source = '';
      return result;
    })
    .map(file => ({
      messages: file.messages,
      varMessageRefs: file.varMessageRefs
    }));

  // find all the messages that are not referenced in srcMessages
  const unusedMessages = Object.keys(messageMap.messages)
    .filter(
      message =>
        !srcMessages.some(srcMessage => srcMessage.messages.includes(message))
    )
    .sort();

  // find all missing messages
  const missingMessages = srcMessages
    .map(srcMessage => srcMessage.messages)
    .flat()
    .filter(srcMessage => !messageMap.messages[srcMessage])
    .sort();
  return {
    [path.basename(srcPath)]: {
      unusedMessages,
      missingMessages,
      varMessageRefs: srcMessages
        .map(srcMessage => srcMessage.varMessageRefs)
        .filter(srcMessage => srcMessage.length > 0)
    }
  };
}

const messageDirs = glob.sync('!(node_modules)/**/messages/i18n.js', {
  cwd: './packages',
  ignore: ['**/node_modules/**']
});

const packageDirs = cp
  .execSync('ls -d */', {
    cwd: './packages'
  })
  .toString()
  .split('\n')
  .filter(dir => dir.length > 0);

// find all the projects that have messages
const projectsWithMessages = packageDirs.filter(dir =>
  messageDirs.find(messageDir => messageDir.startsWith(dir))
);

// find sources files for each project
const projectSourceFiles = projectsWithMessages.map(project => {
  const files = glob.sync('src/**/*.ts', {
    cwd: `./packages/${project}`,
    ignore: ['**/node_modules/**']
  });
  return {
    project,
    files
  };
});

// load the message file for each project
const projectMessages = projectsWithMessages.map(project => {
  const i18n = glob.sync('!(node_modules)/**/messages/i18n.js', {
    cwd: `./packages/${project}`,
    ignore: ['**/node_modules/**']
  });
  return {
    project,
    messages: require(path.resolve('packages', project, i18n[0]))
  };
});

// resolve messages for each project
const resolvedMessages = projectMessages.map(projectMessage => {
  console.log(
    `\nResolving messages for project ${projectMessage.project.replace(
      '/',
      ''
    )}`
  );
  return findUnusedAndMissingMessages(
    `./packages/${projectMessage.project}`,
    projectSourceFiles.find(
      projectSourceFile => projectSourceFile.project === projectMessage.project
    )?.files ?? [],
    projectMessage.messages
  );
});

fs.writeFileSync(
  'auditMessages.json',
  JSON.stringify(resolvedMessages, null, 2)
);
