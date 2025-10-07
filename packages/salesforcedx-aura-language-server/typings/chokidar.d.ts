import 'chokidar';

declare module 'chokidar' {
    interface FSWatcher {
        ref(): this;
        unref(): this;
    }
}
