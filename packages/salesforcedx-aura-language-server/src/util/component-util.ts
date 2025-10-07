import * as path from 'path';

// TODO investigate more why this happens
const splitPath = (filePath: path.ParsedPath): string[] => {
    let pathElements = filePath.dir.split(path.sep);
    // Somehow on windows paths are occassionally using forward slash
    if (path.sep === '\\' && filePath.dir.indexOf('\\') === -1) {
        pathElements = filePath.dir.split('/');
    }
    return pathElements;
};

export const nameFromFile = (file: string, sfdxProject: boolean, converter: (a: string, b: string) => string): string => {
    const filePath = path.parse(file);
    const fileName = filePath.name;
    const pathElements = splitPath(filePath);
    const parentDirName = pathElements.pop();
    if (fileName === parentDirName) {
        const namespace = sfdxProject ? 'c' : pathElements.pop();
        return converter(namespace, parentDirName);
    }
    return null;
};

export const nameFromDirectory = (file: string, sfdxProject: boolean, converter: (a: string, b: string) => string): string => {
    const filePath = path.parse(file);
    if (sfdxProject) {
        return converter('c', filePath.name);
    } else {
        // TODO verify
        return converter(splitPath(filePath).pop(), filePath.name);
    }
};

export const moduleName = (namespace: string, tag: string): string => {
    if (namespace === 'interop') {
        // treat interop as lightning, i.e. needed when using extension with lightning-global
        // TODO: worth to add WorkspaceType.LIGHTNING_GLOBAL?
        namespace = 'lightning';
    }

    // convert camel-case to hyphen-case/kebab-case
    return namespace + '/' + tag;
    // TODO confirm we shouldn't be doing this anymore
    // + decamelize(tag, '-');
};

const componentName = (namespace: string, tag: string): string => namespace + ':' + tag;

export const componentFromFile = (file: string, sfdxProject: boolean): string => nameFromFile(file, sfdxProject, componentName);

export const componentFromDirectory = (file: string, sfdxProject: boolean): string => nameFromDirectory(file, sfdxProject, componentName);
