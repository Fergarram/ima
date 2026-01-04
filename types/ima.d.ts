/**
 * @typedef {Object} TagOptions
 * @property {string} [namespace] - XML namespace for elements (e.g., SVG namespace)
 * @property {Document} [iframe_document] - Document to use for creating elements
 * @property {(name: string, value: any) => { name: string, value: any }} [attr] - Custom attribute processor
 */
/**
 * @typedef {Object} Ref
 * @property {Element|null} current - Reference to the DOM element
 */
/**
 * @typedef {Object} ParsedTagArgs
 * @property {Record<string, any>} props - Element attributes/properties
 * @property {any[]} children - Child elements or content
 * @property {Ref} [ref] - Optional ref object
 * @property {string | (() => string)} [innerHTML] - Optional innerHTML content
 */
/**
 * @typedef {(...args: any[]) => HTMLElement | Element} TagFunction
 */
/**
 * @typedef {(...args: any[]) => string} StaticTagFunction
 */
/**
 * @typedef {Record<string, TagFunction>} TagProxy
 */
/**
 * @typedef {Record<string, StaticTagFunction>} StaticTagProxy
 */
/**
 * Creates a proxy object for generating static HTML strings.
 * Used for server-side rendering.
 *
 * @returns {StaticTagProxy} Proxy that generates HTML strings for any tag name
 *
 * @example
 * const h = useStaticTags();
 * const html = h.div({ class: "container" }, h.p("Hello"));
 * // Returns: '<div class="container"><p>Hello</p></div>'
 */
export function useStaticTags(): StaticTagProxy;
/**
 * Creates a proxy object for generating DOM elements or static HTML strings.
 * Automatically detects environment and returns appropriate generator.
 *
 * @param {TagOptions|string} [options] - Configuration options or namespace string
 * @returns {TagProxy|StaticTagProxy} Proxy that generates elements or HTML strings
 *
 * @example
 * // Basic usage
 * const h = useTags();
 * const el = h.div({ class: "container" }, h.p("Hello"));
 *
 * @example
 * // With SVG namespace
 * const svg = useTags({ namespace: "http://www.w3.org/2000/svg" });
 * const circle = svg.circle({ cx: 50, cy: 50, r: 40 });
 *
 * @example
 * // With iframe document
 * const h = useTags({ iframe_document: iframe.contentDocument });
 */
export function useTags(options?: TagOptions | string): TagProxy | StaticTagProxy;
/**
 * Parses tag function arguments into props, children, ref, and innerHTML.
 *
 * @param {any[]} args - Arguments passed to a tag function
 * @returns {ParsedTagArgs} Parsed arguments object
 *
 * @example
 * // Props object as first arg
 * parseTagArgs([{ class: "foo" }, "child"])
 * // Returns: { props: { class: "foo" }, children: ["child"], ref: undefined, innerHTML: undefined }
 *
 * @example
 * // All children
 * parseTagArgs(["child1", "child2"])
 * // Returns: { props: {}, children: ["child1", "child2"], ref: undefined, innerHTML: undefined }
 */
export function parseTagArgs(args: any[]): ParsedTagArgs;
/**
 * Creates a tag function for generating DOM elements.
 *
 * @param {object} _ - Unused proxy target
 * @param {string} tag - HTML tag name
 * @param {TagOptions} options - Configuration options
 * @returns {(...args: any[]) => Element} Function that creates DOM elements
 */
export function tagGenerator(_: object, tag: string, options: TagOptions): (...args: any[]) => Element;
/**
 * Returns the time in milliseconds spent updating reactive components
 * in the last animation frame.
 *
 * @returns {number} Frame time in milliseconds
 *
 * @example
 * setInterval(() => {
 *     console.log(`Last frame: ${getFrameTime().toFixed(2)}ms`);
 * }, 1000);
 */
export function getFrameTime(): number;
/**
 * Escapes HTML special characters in a string.
 *
 * @param {string} value - String to escape
 * @returns {string} Escaped string safe for HTML attribute values
 *
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(value: string): string;
/**
 * Builds an HTML attribute string from a props object.
 *
 * @param {Record<string, any>} props - Object containing attribute key-value pairs
 * @returns {string} HTML attribute string (with leading space if non-empty)
 *
 * @example
 * buildAttributesHtml({ class: "foo", disabled: true, hidden: false })
 * // Returns: ' class="foo" disabled'
 */
export function buildAttributesHtml(props: Record<string, any>): string;
export type TagOptions = {
    /**
     * - XML namespace for elements (e.g., SVG namespace)
     */
    namespace?: string | undefined;
    /**
     * - Document to use for creating elements
     */
    iframe_document?: Document | undefined;
    /**
     * - Custom attribute processor
     */
    attr?: ((name: string, value: any) => {
        name: string;
        value: any;
    }) | undefined;
};
export type Ref = {
    /**
     * - Reference to the DOM element
     */
    current: Element | null;
};
export type ParsedTagArgs = {
    /**
     * - Element attributes/properties
     */
    props: Record<string, any>;
    /**
     * - Child elements or content
     */
    children: any[];
    /**
     * - Optional ref object
     */
    ref?: Ref | undefined;
    /**
     * - Optional innerHTML content
     */
    innerHTML?: string | (() => string) | undefined;
};
export type TagFunction = (...args: any[]) => HTMLElement | Element;
export type StaticTagFunction = (...args: any[]) => string;
export type TagProxy = Record<string, TagFunction>;
export type StaticTagProxy = Record<string, StaticTagFunction>;
