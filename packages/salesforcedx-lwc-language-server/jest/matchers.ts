import { isAbsolute } from 'path';
import * as fs from 'fs';

expect.extend({
    toExist(path) {
        const pass = fs.existsSync(path);
        if (pass) {
            return {
                message: () => `expected ${path} not to exist`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${path} to exist`,
                pass: false,
            };
        }
    },
    toBeAbsolutePath(path) {
        const pass = isAbsolute(path);
        if (pass) {
            return {
                message: () => `expected ${path} not to be absolute`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${path} to be absolute`,
                pass: false,
            };
        }
    },
});
