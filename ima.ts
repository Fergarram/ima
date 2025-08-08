//
// IMA (今) 0.6.0
// by fergarram
//

// A tiny immediate-mode inspired UI rendering engine.

//
// Index:
//

// — Core Types
// — Tags
// — Reactive System
// — Static Generation

//
// Core Types
//

export type Child = HTMLElement | Node | null | undefined | string | boolean | number | (() => any);

export type Ref<T = HTMLElement> = {
	current: T | null;
};

export type Props = {
	is?: string;
	key?: any;
	ref?: Ref<HTMLElement>;
	innerHTML?: string | (() => string);
	[key: string]: any;
};

export type UseTagsOptions = {
	namespace?: string;
	attr?: (name: string, value: any) => { name: string; value: any };
};

// Define TagArgs to properly handle the parameter patterns
export type TagArgs =
	| [] // No args
	| [Props] // Just props
	| [Child, ...Child[]] // First child followed by more children
	| [Props, ...Child[]]; // Props followed by children

export type TagFunction = (...args: TagArgs) => HTMLElement;

export type TagsProxy = {
	[key: string]: TagFunction;
};

//
// Tag Generation
//

export function useStaticTags(): TagsProxy {
	return new Proxy({}, { get: staticTagGenerator });
}

export function useTags(options?: string | UseTagsOptions): TagsProxy {
	const is_static = typeof window === "undefined";

	// Handle backward compatibility - if options is a string, treat it as namespace
	const resolved_options: UseTagsOptions = typeof options === "string" ? { namespace: options } : options || {};

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
	(globalThis as any).document = {
		createElement: () => ({}),
		createTextNode: () => ({}),
		createComment: () => ({}),
		createElementNS: () => ({}),
	};

	console.warn("Trying to use client-side tags on server.");
}

// Shared parsing logic
export type ParsedArgs = {
	props: Props;
	children: Child[];
	ref?: Ref<HTMLElement>;
	innerHTML?: string | (() => string);
};

export function parseTagArgs(args: any[]): ParsedArgs {
	let props: Props = {};
	let children: Child[] = args;
	let ref: Ref<HTMLElement> | undefined;
	let innerHTML: string | (() => string) | undefined;

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

export function tagGenerator(_: any, tag: string, options?: UseTagsOptions): TagFunction {
	return (...args: any[]): HTMLElement => {
		const { props, children, ref, innerHTML } = parseTagArgs(args);

		const element = options?.namespace ? document.createElementNS(options.namespace, tag) : document.createElement(tag);

		if (ref) {
			ref.current = element as HTMLElement;
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
				element.addEventListener(event_name, processed_value as EventListener);
				continue;
			}

			if (typeof processed_value === "function" && !processed_name.startsWith("on")) {
				setupReactiveAttr(element as HTMLElement, processed_name, processed_value);
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
			return element as HTMLElement;
		}

		// Process children and append to element
		for (const child of children.flat(Infinity)) {
			if (child != null) {
				if (child instanceof Node) {
					element.appendChild(child);
				} else if (typeof child === "function") {
					const reactive_node = setupReactiveNode(child);
					element.appendChild(reactive_node);
				} else {
					element.appendChild(document.createTextNode(String(child)));
				}
			}
		}

		return element as HTMLElement;
	};
}

//
// Reactive System
//

// Reactive nodes
const reactive_markers: (Comment | null)[] = [];
const reactive_callbacks: ((() => any) | null)[] = [];
const reactive_prev_values: (Node | string | null)[] = [];
let reactive_node_count = 0;

// Reactive attributes
const reactive_attr_elements: (HTMLElement | null)[] = [];
const reactive_attr_names: (string | null)[] = [];
const reactive_attr_callbacks: ((() => any) | null)[] = [];
const reactive_attr_prev_values: any[] = [];
let reactive_attr_count = 0;

let frame_time = 0;
let cleanup_counter = 0;

// Start the frame loop immediately
if (typeof window !== "undefined") {
	requestAnimationFrame(updateReactiveComponents);
}

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
			let new_node: Node;

			if (new_value instanceof Node) {
				new_node = new_value;
			} else {
				new_node = document.createTextNode(String(new_value || ""));
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

export function getFrameTime() {
	return frame_time;
}

function setupReactiveNode(callback: () => any): Node {
	const node_index = reactive_node_count++;

	// Create a marker comment node
	const marker = document.createComment(`reactive-${node_index}`);

	// Get initial value
	const initial_value = callback();

	// Create the initial node
	let initial_node: Node;

	if (initial_value instanceof Node) {
		initial_node = initial_value;
	} else {
		initial_node = document.createTextNode(String(initial_value || ""));
	}

	// Create a fragment to hold both the marker and the content
	const fragment = document.createDocumentFragment();
	fragment.appendChild(initial_node);
	fragment.appendChild(marker);

	// Store reactive data
	reactive_markers[node_index] = marker;
	reactive_callbacks[node_index] = callback;
	reactive_prev_values[node_index] = initial_node;

	return fragment;
}

function setupReactiveAttr(element: HTMLElement, attr_name: string, callback: () => any) {
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

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export function buildAttributesHtml(props: Props): string {
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

function staticTagGenerator(_: any, tag: string) {
	return (...args: any[]): string => {
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
					html += String((child as Function)());
				} else {
					// Don't escape HTML content - treat it as raw HTML
					html += String(child);
				}
			}
		}

		return html + `</${tag}>`;
	};
}
