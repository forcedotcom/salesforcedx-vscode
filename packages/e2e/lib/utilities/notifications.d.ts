import { Duration } from './miscellaneous';
export declare function waitForNotificationToGoAway(notificationMessage: string, durationInSeconds: Duration): Promise<void>;
export declare function notificationIsPresent(notificationMessage: string): Promise<boolean>;
export declare function notificationIsPresentWithTimeout(notificationMessage: string, durationInSeconds: Duration): Promise<boolean>;
export declare function notificationIsAbsent(notificationMessage: string): Promise<boolean>;
export declare function notificationIsAbsentWithTimeout(notificationMessage: string, durationInSeconds: Duration): Promise<boolean>;
export declare function dismissNotification(notificationMessage: string, timeout?: Duration): Promise<void>;
export declare function acceptNotification(notificationMessage: string, actionName: string, timeout: Duration): Promise<boolean>;
export declare function dismissAllNotifications(): Promise<void>;
