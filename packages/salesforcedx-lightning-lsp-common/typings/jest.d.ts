import 'jest-extended';

declare global {
    namespace jest {
        interface Matchers<R, T> {
            toExist(): R;
            toBeAbsolutePath(): R;
        }
    }
}
