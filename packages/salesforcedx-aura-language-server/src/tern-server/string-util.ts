const isAlphaNumberic = (code: number): boolean => {
    if (code > 47 && code < 58) {
        // numeric
        return true;
    }
    if ((code > 64 && code < 91) || (code > 96 && code < 123)) {
        // alpha
        return true;
    }
    if (code === 95 || code === 45) {
        // _ and -
        return true;
    }
    return false;
};

export const findWord = (str: string, offset: number): { start: number; end: number } => {
    let start = -1;
    let end = -1;

    let pos: number = offset;
    let c: number;

    while (pos >= 0) {
        c = str.charCodeAt(pos);
        if (c === 10 || c === 13) {
            // \n and \r
            break;
        } else if (!isAlphaNumberic(c)) {
            pos++;
            break;
        }
        --pos;
    }
    start = pos;

    pos = offset;
    const length = str.length;

    while (pos < length) {
        c = str.charCodeAt(pos);
        if (c === 10 || c === 13) {
            // \n and \r
            break;
        } else if (!isAlphaNumberic(c)) {
            break;
        }
        ++pos;
    }
    end = pos;

    if (start > -1 && end > -1) {
        return {
            start,
            end,
        };
    }
};

export const countPreviousCommas = (str: string, offset: number): number => {
    let commas = 0;
    let pos: number = offset;
    let c: number;
    while (pos >= 0) {
        c = str.charCodeAt(pos);
        if (c === 10 || c === 13 || c === 40) {
            // \n and \r and ()
            break;
        } else if (c === 44) {
            // ,
            commas++;
        }
        --pos;
    }
    return commas;
};

export const findPreviousLeftParan = (str: string, offset: number): number => {
    let start = -1;
    let pos: number = offset;
    let c: number;
    while (pos >= 0) {
        c = str.charCodeAt(pos);
        if (c === 10 || c === 13) {
            // \n and \r
            break;
        } else if (c === 40) {
            start = pos;
            break;
        }
        --pos;
    }
    return start;
};

export const findPreviousWord = (str: string, offset: number): { start: number; end: number } => {
    let start = -1;
    let end = -1;

    let seenWordBoundary = false;
    let boundaryOffset = 0;

    let pos: number = offset;
    let c: number;

    while (pos >= 0) {
        c = str.charCodeAt(pos);
        if (c === 10 || c === 13) {
            // \n and \r
            break;
        } else if ((c === 46 || c === 40) && !seenWordBoundary) {
            // . and (
            seenWordBoundary = true;
            boundaryOffset = offset - pos + 1;
        } else if (!isAlphaNumberic(c)) {
            pos++;
            break;
        }
        --pos;
    }
    if (!seenWordBoundary) {
        return {
            start: offset,
            end: offset,
        };
    }
    start = pos;

    pos = offset;
    const length: number = str.length;

    while (pos < length) {
        c = str.charCodeAt(pos);
        if (c === 10 || c === 13) {
            // \n and \r
            break;
        } else if (!isAlphaNumberic(c)) {
            break;
        }
        ++pos;
    }
    end = pos;

    if (start > -1 && end > -1) {
        return { start, end: end - boundaryOffset };
    }
};
