import { type Page } from "@playwright/test";
export declare function softNavigate(page: Page, url: string): Promise<void>;
export declare function querySelector(page: Page, selector: string): Promise<import("playwright-core").Locator>;
export declare function clickSelector(page: Page, selector: string): Promise<void>;
export declare function prepare(page: Page, link: string): Promise<void>;
export declare function compareSelectedItems(page: Page, selector: string, data: string | any[], decodeJson?: boolean): Promise<void>;
