import { countPreviousCommas, findPreviousLeftParan, findPreviousWord, findWord } from '../string-util';

describe('string-util', () => {
    describe('findWord', () => {
        it('should find start and end of word', () => {
            const testWord = 'test';
            const testString = `   ${testWord}   `;
            const result = findWord(testString, Math.floor(testString.length / 2));

            expect(result).toBeDefined();
            expect(result.start).toEqual(testString.indexOf(testWord));
            expect(result.end).toEqual(testString.indexOf(testWord) + testWord.length);
        });

        it('should find start and end of word with number and underscore', () => {
            const testWord = 'test_1';
            const testString = `   ${testWord}   `;
            const result = findWord(testString, Math.floor(testString.length / 2));

            expect(result).toBeDefined();
            expect(result.start).toEqual(testString.indexOf(testWord));
            expect(result.end).toEqual(testString.indexOf(testWord) + testWord.length);
        });

        it('should find start and end of word in multiline string', () => {
            const testWord = 'test';
            const testString: string = '\n\n' + testWord + '\n\n';
            const result = findWord(testString, Math.floor(testString.length / 2));

            expect(result).toBeDefined();
            expect(result.start).toEqual(testString.indexOf(testWord) - 1);
            expect(result.end).toEqual(testString.indexOf(testWord) + testWord.length);
        });
    });

    describe('countPreviousCommas', () => {
        it('should find number of preceding commas', () => {
            const testWord = 'test';
            const commas = ',,,';
            const testString = `${commas}${testWord}`;
            const result = countPreviousCommas(testString, commas.length + Math.floor(testString.length / 2));

            expect(result).toBeDefined();
            expect(result).toEqual(commas.length);
        });

        it('should find number of preceding commas with chars between', () => {
            const testWord = 'test';
            const threeCommaString = 'value1, value2, value3, ';
            const testString = `${threeCommaString}${testWord}`;
            const result = countPreviousCommas(testString, threeCommaString.length + Math.floor(testString.length / 2));

            expect(result).toBeDefined();
            expect(result).toEqual(3);
        });

        it('should find number of preceding commas with new line', () => {
            const testWord = 'test';
            const commaString = ',\n,, ';
            const testString = `${commaString}${testWord}`;
            const result = countPreviousCommas(testString, commaString.length + Math.floor(testString.length / 2));

            expect(result).toBeDefined();
            expect(result).toEqual(2);
        });
    });

    describe('findPreviousLeftParan', () => {
        it('should find index of preceding left bracket', () => {
            const testWord = 'test';
            const testString = `(${testWord})`;
            const result = findPreviousLeftParan(testString, Math.floor(testString.length / 2));

            expect(result).toBeDefined();
            expect(result).toEqual(testString.indexOf('('));
        });

        it('should find index of preceding left bracket with chars between', () => {
            const testWord = 'test';
            const testString = `func(anotherParameter, ${testWord})`;
            const result = findPreviousLeftParan(testString, Math.floor(testString.length / 2));

            expect(result).toBeDefined();
            expect(result).toEqual(testString.indexOf('('));
        });

        it('should return -1 with new line', () => {
            const testWord = 'test';
            const testString = `(\n${testWord})`;
            const result = findPreviousLeftParan(testString, Math.floor(testString.length / 2));

            expect(result).toBeDefined();
            expect(result).toEqual(-1);
        });
    });

    describe('findPreviousWord', () => {
        it('should find start and end of preceding word before "."', () => {
            const testWord = 'test';
            const previousWord = 'word';
            const testString = `   ${previousWord}.${testWord}   `;
            const result = findPreviousWord(testString, testString.indexOf(testWord) + 2);

            expect(result).toBeDefined();
            expect(result.start).toEqual(testString.indexOf(previousWord));
            expect(result.end).toEqual(testString.indexOf(previousWord) + previousWord.length + 1);
        });

        it('should find new line char before "." with new line', () => {
            const testWord = 'test';
            const previousWord = 'word';
            const testString = `   ${previousWord}\n.${testWord}   `;
            const result = findPreviousWord(testString, testString.indexOf(testWord) + 2);

            expect(result).toBeDefined();
            expect(result.start).toEqual(testString.indexOf('\n'));
            expect(result.end).toEqual(testString.indexOf(testWord));
        });

        it('should return index of start char for testWord', () => {
            const testWord = 'test';
            const previousWord = 'word';
            const testString = `   ${previousWord} ${testWord}   `;
            const offset = testString.indexOf(testWord) + 2;
            const result = findPreviousWord(testString, offset);

            expect(result).toBeDefined();
            expect(result.start).toEqual(offset);
            expect(result.end).toEqual(offset);
        });

        it('should return index previous word after ","', () => {
            const testWord = 'test';
            const previousWord = 'word';
            const testString = `   ,${previousWord}.${testWord}\n   `;
            const offset = testString.indexOf(testWord) + 2;
            const result = findPreviousWord(testString, offset);

            expect(result).toBeDefined();
            expect(result.start).toEqual(testString.indexOf(previousWord));
            expect(result.end).toEqual(testString.indexOf(testWord));
        });
    });
});
