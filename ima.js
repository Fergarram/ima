//
// IMA (今) 0.8.0
// by fergarram
//

// A tiny immediate-mode inspired UI rendering engine.

//
// Index:
//

// — Tags
// — Reactive System
// — Static Generation

//
// Type Definitions
//

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

//
// Tag Generation
//

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
export function useStaticTags() {
	return new Proxy({}, { get: staticTagGenerator });
}

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
export function useTags(options) {
	const is_static = typeof window === "undefined";

	// Handle backward compatibility - if options is a string, treat it as namespace
	/** @type {TagOptions} */
	const resolved_options = typeof options === "string" ? { namespace: options } : options || {};

	if (is_static) {
		return useStaticTags();
	} else {
		return new Proxy(
			{},
			{
				get: (target, tag) => tagGenerator(target, String(tag), resolved_options),
			},
		);
	}
}

//
// DOM Element Generation
//

if (typeof window === "undefined") {
	// In environments without DOM (like Bun/Node server-side), provide no-op versions
	// of the reactive functions to prevent errors
	const warn = () => console.warn("Trying to use client-side tags on server.");
	globalThis.document = {
		// @ts-expect-error
		createElement: warn,
		// @ts-expect-error
		createTextNode: warn,
		// @ts-expect-error
		createComment: warn,
		// @ts-expect-error
		createElementNS: warn,
	};
}

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
export function parseTagArgs(args) {
	/** @type {Record<string, any>} */
	let props = {};
	let children = args;
	/** @type {Ref|undefined} */
	let ref;
	/** @type {string|undefined} */
	let innerHTML;

	if (args.length > 0) {
		const first_arg = args[0];

		// If first argument is a string, number, HTMLElement, or function, all args are children
		if (
			typeof first_arg === "string" ||
			typeof first_arg === "number" ||
			(typeof window !== "undefined" && first_arg instanceof HTMLElement) ||
			typeof first_arg === "function"
		) {
			children = args;
		}
		// If first argument is a plain object, treat it as props
		else if (Object.getPrototypeOf(first_arg || 0) === Object.prototype) {
			const [props_arg, ...rest_args] = args;
			const { is, ref: prop_ref, innerHTML: prop_innerHTML, ...rest_props } = props_arg;
			props = rest_props;
			children = rest_args;
			ref = prop_ref;
			innerHTML = prop_innerHTML;
		}
	}

	return { props, children, ref, innerHTML };
}

/**
 * Creates a tag function for generating DOM elements.
 *
 * @param {object} _ - Unused proxy target
 * @param {string} tag - HTML tag name
 * @param {TagOptions} options - Configuration options
 * @returns {(...args: any[]) => Element} Function that creates DOM elements
 */
export function tagGenerator(_, tag, options) {
	return (...args) => {
		const { props, children, ref, innerHTML } = parseTagArgs(args);

		// Get the document to use - either from options or global
		const doc = options?.iframe_document || document;

		const element = options?.namespace
			? doc.createElementNS(options.namespace, tag)
			: doc.createElement(tag);

		if (ref) {
			ref.current = element;
		}

		// Handle props/attributes
		for (const [attr_key, value] of Object.entries(props)) {
			let processed_name = attr_key;
			let processed_value = value;

			// Apply custom attribute processing if provided
			if (options?.attr) {
				const result = options.attr(attr_key, value);
				processed_name = result.name;
				processed_value = result.value;
			}

			if (processed_name.startsWith("on") && typeof processed_value === "function") {
				const event_name = processed_name.substring(2).toLowerCase();
				element.addEventListener(event_name, processed_value);
				continue;
			}

			if (typeof processed_value === "function" && !processed_name.startsWith("on")) {
				setupReactiveAttr(element, processed_name, processed_value);
				continue;
			}

			if (processed_value === true) {
				element.setAttribute(processed_name, "true");
			} else if (processed_value === false) {
				element.setAttribute(processed_name, "false");
			} else if (processed_value !== null && processed_value !== undefined) {
				element.setAttribute(processed_name, String(processed_value));
			}
		}

		// Handle innerHTML - set it directly and skip processing children
		if (innerHTML !== undefined) {
			element.innerHTML = String(innerHTML);
			return element;
		}

		// Process children and append to element
		for (const child of children.flat(Infinity)) {
			if (child != null) {
				if (child instanceof Node) {
					element.appendChild(child);
				} else if (typeof child === "function") {
					const reactive_node = setupReactiveNode(child, doc);
					element.appendChild(reactive_node);
				} else {
					element.appendChild(doc.createTextNode(String(child)));
				}
			}
		}

		return element;
	};
}

//
// Reactive System
//

// Reactive nodes
/** @type {(Comment|null)[]} */
const reactive_markers = [];
/** @type {(Function|null)[]} */
const reactive_callbacks = [];
/** @type {(Node|null)[]} */
const reactive_prev_values = [];
/** @type {number} */
let reactive_node_count = 0;

// Reactive attributes
/** @type {(Element|null)[]} */
const reactive_attr_elements = [];
/** @type {(string|null)[]} */
const reactive_attr_names = [];
/** @type {(Function|null)[]} */
const reactive_attr_callbacks = [];
/** @type {any[]} */
const reactive_attr_prev_values = [];
/** @type {number} */
let reactive_attr_count = 0;

/** @type {number} */
let frame_time = 0;
/** @type {number} */
let cleanup_counter = 0;

// Start the frame loop immediately
if (typeof window !== "undefined") {
	requestAnimationFrame(updateReactiveComponents);
}

/**
 * Main update loop that runs every animation frame.
 * Updates all reactive attributes and nodes that have changed.
 *
 * @returns {void}
 */
function updateReactiveComponents() {
	// Start timing the update
	const start_time = performance.now();

	let found_disconnected_attrs = false;
	let found_disconnected_nodes = false;

	// Update reactive attributes
	for (let i = 0; i < reactive_attr_count; i++) {
		const element = reactive_attr_elements[i];

		// Track if we find disconnected elements
		if (!element || !element.isConnected) {
			found_disconnected_attrs = true;
			continue;
		}

		const attr_name = reactive_attr_names[i];
		const callback = reactive_attr_callbacks[i];

		if (!attr_name || !callback) continue;

		const new_value = callback();

		// Only update if value changed
		if (new_value !== reactive_attr_prev_values[i]) {
			if (new_value === true) {
				element.setAttribute(attr_name, "true");
			} else if (new_value === false) {
				element.setAttribute(attr_name, "false");
			} else if (new_value === null || new_value === undefined) {
				element.removeAttribute(attr_name);
			} else {
				element.setAttribute(attr_name, String(new_value));
			}

			reactive_attr_prev_values[i] = new_value;
		}
	}

	// Update reactive nodes
	for (let i = 0; i < reactive_node_count; i++) {
		const marker = reactive_markers[i];

		// Track if we find disconnected markers
		if (!marker || !marker.isConnected) {
			found_disconnected_nodes = true;
			continue;
		}

		const callback = reactive_callbacks[i];
		if (!callback) continue;

		const new_value = callback();

		// Get the current node (should be right before the marker)
		const current_node = marker.previousSibling;
		if (!current_node) continue;

		// Determine if we need to update based on content
		let needs_update = false;

		if (new_value instanceof Node) {
			if (current_node instanceof HTMLElement && new_value instanceof HTMLElement) {
				// For HTML elements, compare their HTML content
				if (current_node.outerHTML !== new_value.outerHTML) {
					needs_update = true;
				}
			} else {
				// For non-HTMLElements or mixed types, always update
				needs_update = true;
			}
		} else {
			// For text values, compare with current node
			const new_text = String(new_value || "");
			if (current_node.nodeType === Node.TEXT_NODE) {
				needs_update = current_node.textContent !== new_text;
			} else {
				needs_update = true; // Different node types
			}
		}

		// Only update DOM if needed
		if (needs_update) {
			/** @type {Node} */
			let new_node;

			if (new_value instanceof Node) {
				new_node = new_value;
			} else {
				// Get the document from the marker's owner document
				const doc = marker.ownerDocument || document;
				new_node = doc.createTextNode(String(new_value || ""));
			}

			current_node.replaceWith(new_node);
		}
	}

	// Only perform cleanup if we found disconnected components
	if (found_disconnected_attrs || found_disconnected_nodes) {
		cleanup_counter++;
		if (cleanup_counter >= 60) {
			cleanup_counter = 0;
			cleanupDisconnectedReactives();
		}
	}

	// Calculate and store the time it took to update
	frame_time = performance.now() - start_time;

	// Always schedule the next frame
	requestAnimationFrame(updateReactiveComponents);
}

/**
 * Removes disconnected reactive nodes and attributes from tracking arrays.
 * Compacts the arrays to avoid sparse entries.
 *
 * @returns {void}
 */
// @NOTE: Me construido aquello que he jurado destruir... un garbage collector! D:
function cleanupDisconnectedReactives() {
	// Cleanup reactive nodes
	let write_index = 0;
	for (let read_index = 0; read_index < reactive_node_count; read_index++) {
		const marker = reactive_markers[read_index];
		const callback = reactive_callbacks[read_index];
		const prev_value = reactive_prev_values[read_index];

		// Keep if marker is still connected
		if (marker && marker.isConnected) {
			if (write_index !== read_index) {
				reactive_markers[write_index] = marker;
				reactive_callbacks[write_index] = callback;
				reactive_prev_values[write_index] = prev_value;
			}
			write_index++;
		}
	}

	// Clear the remaining slots and update count
	for (let i = write_index; i < reactive_node_count; i++) {
		reactive_markers[i] = null;
		reactive_callbacks[i] = null;
		reactive_prev_values[i] = null;
	}
	reactive_node_count = write_index;

	// Cleanup reactive attributes
	write_index = 0;
	for (let read_index = 0; read_index < reactive_attr_count; read_index++) {
		const element = reactive_attr_elements[read_index];
		const attr_name = reactive_attr_names[read_index];
		const callback = reactive_attr_callbacks[read_index];
		const prev_value = reactive_attr_prev_values[read_index];

		// Keep if element is still connected
		if (element && element.isConnected) {
			if (write_index !== read_index) {
				reactive_attr_elements[write_index] = element;
				reactive_attr_names[write_index] = attr_name;
				reactive_attr_callbacks[write_index] = callback;
				reactive_attr_prev_values[write_index] = prev_value;
			}
			write_index++;
		}
	}

	// Clear the remaining slots and update count
	for (let i = write_index; i < reactive_attr_count; i++) {
		reactive_attr_elements[i] = null;
		reactive_attr_names[i] = null;
		reactive_attr_callbacks[i] = null;
		reactive_attr_prev_values[i] = undefined;
	}
	reactive_attr_count = write_index;
}

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
export function getFrameTime() {
	return frame_time;
}

/**
 * Sets up a reactive node that updates when its callback returns a new value.
 *
 * @param {() => Node|string|number|null|undefined} callback - Function that returns the node content
 * @param {Document} doc - Document to use for creating nodes
 * @returns {DocumentFragment} Fragment containing the initial node and marker
 */
function setupReactiveNode(callback, doc) {
	const node_index = reactive_node_count++;

	// Create a marker comment node
	const marker = doc.createComment(`reactive-${node_index}`);

	// Get initial value
	const initial_value = callback();

	// Create the initial node
	/** @type {Node} */
	let initial_node;

	if (initial_value instanceof Node) {
		initial_node = initial_value;
	} else {
		initial_node = doc.createTextNode(String(initial_value || ""));
	}

	// Create a fragment to hold both the marker and the content
	const fragment = doc.createDocumentFragment();
	fragment.appendChild(initial_node);
	fragment.appendChild(marker);

	// Store reactive data
	reactive_markers[node_index] = marker;
	reactive_callbacks[node_index] = callback;
	reactive_prev_values[node_index] = initial_node;

	return fragment;
}

/**
 * Sets up a reactive attribute that updates when its callback returns a new value.
 *
 * @param {Element} element - Element to set the attribute on
 * @param {string} attr_name - Name of the attribute
 * @param {() => any} callback - Function that returns the attribute value
 * @returns {void}
 */
function setupReactiveAttr(element, attr_name, callback) {
	const attr_index = reactive_attr_count++;

	// Initialize with current value
	const initial_value = callback();

	// Set the initial attribute value
	if (initial_value === true) {
		element.setAttribute(attr_name, "true");
	} else if (initial_value === false) {
		element.setAttribute(attr_name, "false");
	} else if (initial_value !== null && initial_value !== undefined) {
		element.setAttribute(attr_name, String(initial_value));
	}

	// Store references
	reactive_attr_elements[attr_index] = element;
	reactive_attr_names[attr_index] = attr_name;
	reactive_attr_callbacks[attr_index] = callback;
	reactive_attr_prev_values[attr_index] = initial_value;
}

//
// Static Generation
//

// Void elements that are self-closing
/** @type {Set<string>} */
const VOID_ELEMENTS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

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
export function escapeHtml(value) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

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
export function buildAttributesHtml(props) {
	let html = "";

	for (const [key, value] of Object.entries(props)) {
		// Skip event handlers and functions
		if (key.startsWith("on") || typeof value === "function") {
			continue;
		}
		// Regular attributes
		if (value === true) {
			html += ` ${key}`;
		} else if (value !== false && value != null) {
			html += ` ${key}="${escapeHtml(String(value))}"`;
		}
	}

	return html;
}

/**
 * Creates a static tag function for generating HTML strings.
 *
 * @param {object} _ - Unused proxy target
 * @param {string} tag - HTML tag name
 * @returns {StaticTagFunction} Function that creates HTML strings
 */
function staticTagGenerator(_, tag) {
	return (...args) => {
		const { props, children, innerHTML } = parseTagArgs(args);

		// Start building the HTML string
		let html = `<${tag}${buildAttributesHtml(props)}`;

		// Self-closing tags
		if (VOID_ELEMENTS.has(tag)) {
			return html + "/>";
		}

		html += ">";

		// Handle innerHTML - if present, ignore children and use innerHTML instead
		if (innerHTML !== undefined) {
			const inner_html_content = typeof innerHTML === "function" ? innerHTML() : innerHTML;
			html += String(inner_html_content);
			return html + `</${tag}>`;
		}

		// Process children
		for (const child of children.flat(Infinity)) {
			if (child != null) {
				if (typeof child === "function") {
					// Resolve function children
					html += String(child());
				} else {
					// Don't escape HTML content - treat it as raw HTML
					html += String(child);
				}
			}
		}

		return html + `</${tag}>`;
	};
}
