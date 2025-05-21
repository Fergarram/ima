//
// IMA (今) 0.2.1
// by fergarram
//

// A tiny immediate-mode inspired UI rendering engine.

//
// Index:
//

// — Core Types
// — DOM Element Generation
// — Reactive System

//
// Core Types
//

export type Child = HTMLElement | Node | null | undefined | string | boolean | number | (() => any);

export type Props = {
	is?: string;
	key?: any;
	[key: string]: any;
};

// Define TagArgs to properly handle the overloaded parameter patterns
export type TagArgs =
	| [] // No arguments
	| [Props] // Just props
	| [Child, ...Child[]] // First child followed by more children
	| [Props, ...Child[]]; // Props followed by children

export type TagFunction = (...args: TagArgs) => HTMLElement;

export type TagsProxy = {
	[key: string]: TagFunction;
};

//
// Use Tags
//

export function useTags(): TagsProxy {
	const is_static = typeof window === "undefined";
	return is_static ? new Proxy({}, { get: static_tag_generator }) : new Proxy({}, { get: tag_generator });
}

//
// DOM Element Generation
//

if (typeof window === "undefined") {
	// In environments without DOM (like Bun/Node server-side), provide no-op versions
	// of the reactive functions to prevent errors
	(global as any).document = {
		createElement: () => ({}),
		createTextNode: () => ({}),
		createComment: () => ({}),
	};

	console.warn("Trying to use client-side tags on server.");
}

const tag_generator =
	(_: any, name: string): TagFunction =>
	(...args: any[]): HTMLElement => {
		let props_obj: Props = {};
		let children: (HTMLElement | Node | null | undefined | string | boolean | number | (() => any))[] = args;

		if (args.length > 0) {
			const first_arg = args[0];

			// If first argument is a string, number, or HTMLElement, all args are children
			if (
				typeof first_arg === "string" ||
				typeof first_arg === "number" ||
				first_arg instanceof HTMLElement ||
				typeof first_arg === "function"
			) {
				children = args;
			}
			// If first argument is a plain object, treat it as props
			else if (Object.getPrototypeOf(first_arg ?? 0) === Object.prototype) {
				const [props_arg, ...rest_args] = args;
				const { is, ...rest_props } = props_arg;
				props_obj = rest_props;
				children = rest_args;
			}
		}

		// Create the element
		const element = document.createElement(name);

		// Handle props/attributes
		for (const [attr_key, value] of Object.entries(props_obj)) {
			// Event handlers
			if (attr_key.startsWith("on") && typeof value === "function") {
				const event_name = attr_key.substring(2).toLowerCase(); // e.g., "onClick" -> "click"
				element.addEventListener(event_name, value as EventListener);
				continue;
			}

			// Reactive attributes (functions that don't start with "on")
			if (typeof value === "function" && !attr_key.startsWith("on")) {
				setupReactiveAttr(element, attr_key, value);
				continue;
			}

			// Regular attributes
			if (value === true) {
				element.setAttribute(attr_key, "");
			} else if (value !== false && value != null) {
				element.setAttribute(attr_key, String(value));
			}
		}

		// Process children and append to element
		for (const child of children.flat(Infinity)) {
			if (child != null) {
				if (child instanceof Node) {
					element.appendChild(child);
				} else if (typeof child === "function") {
					// Handle reactive child
					const reactive_node = setupReactiveNode(child);
					element.appendChild(reactive_node);
				} else {
					element.appendChild(document.createTextNode(String(child)));
				}
			}
		}

		return element;
	};

export const tags: TagsProxy = new Proxy({}, { get: tag_generator });

//
// Reactive System
//

// Reactive nodes
const reactive_markers: Comment[] = [];
const reactive_callbacks: Array<() => any> = [];
const reactive_prev_values: Array<Node | string | null> = [];
let reactive_count = 0;

// Reactive attributes
const reactive_attr_elements: HTMLElement[] = [];
const reactive_attr_names: string[] = [];
const reactive_attr_callbacks: Array<() => any> = [];
const reactive_attr_prev_values: any[] = [];
let reactive_attr_count = 0;

let animation_frame_requested = false;
let frame_time = 0;

function updateReactiveComponents() {
	animation_frame_requested = false;

	// Start timing the update
	const start_time = performance.now();

	// Update reactive attributes
	for (let i = 0; i < reactive_attr_count; i++) {
		const element = reactive_attr_elements[i];
		const attr_name = reactive_attr_names[i];
		const callback = reactive_attr_callbacks[i];

		// Skip if element is no longer connected
		if (!element.isConnected) continue;

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
	for (let i = 0; i < reactive_count; i++) {
		const marker = reactive_markers[i];
		const callback = reactive_callbacks[i];

		// Skip if marker is no longer connected
		if (!marker.isConnected) continue;

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
			const new_text = String(new_value ?? "");
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
				new_node = document.createTextNode(String(new_value ?? ""));
			}

			current_node.replaceWith(new_node);
		}
	}

	// Calculate and store the time it took to update
	frame_time = performance.now() - start_time;

	// Schedule next update if we have reactive items
	if (reactive_count > 0 || reactive_attr_count > 0) {
		animationFrame();
	}
}

export function getFrameTime() {
	return frame_time;
}

function animationFrame() {
	if (!animation_frame_requested && (reactive_count > 0 || reactive_attr_count > 0)) {
		animation_frame_requested = true;
		requestAnimationFrame(updateReactiveComponents);
	}
}

function setupReactiveNode(callback: () => any): Node {
	const node_index = reactive_count++;

	// Create a marker comment node
	const marker = document.createComment(`reactive-${node_index}`);

	// Get initial value
	const initial_value = callback();

	// Create the initial node
	let initial_node: Node;

	if (initial_value instanceof Node) {
		initial_node = initial_value;
	} else {
		initial_node = document.createTextNode(String(initial_value ?? ""));
	}

	// Create a fragment to hold both the marker and the content
	const fragment = document.createDocumentFragment();
	fragment.appendChild(initial_node);
	fragment.appendChild(marker);

	// Store reactive data
	reactive_markers[node_index] = marker;
	reactive_callbacks[node_index] = callback;
	reactive_prev_values[node_index] = initial_node;

	// Start the animation frame loop
	animationFrame();

	return fragment;
}

function setupReactiveAttr(element: HTMLElement, attr_name: string, callback: () => any) {
	const attr_index = reactive_attr_count++;

	// Initialize with current value
	const initial_value = callback();

	// Set the initial attribute value
	if (initial_value === true) {
		element.setAttribute(attr_name, "");
	} else if (initial_value !== false && initial_value != null) {
		element.setAttribute(attr_name, String(initial_value));
	}

	// Store data in our parallel arrays
	reactive_attr_elements[attr_index] = element;
	reactive_attr_names[attr_index] = attr_name;
	reactive_attr_callbacks[attr_index] = callback;
	reactive_attr_prev_values[attr_index] = initial_value;

	// Start the animation frame loop
	animationFrame();
}

//
// Static Generation
//

const static_tag_generator =
	(_: any, name: string) =>
	(...args: any[]): string => {
		let props_obj: Props = {};
		let children: (string | null | undefined | boolean | number | (() => any))[] = args;

		if (args.length > 0) {
			const first_arg = args[0];

			// If first argument is a string, number, or function, all args are children
			if (typeof first_arg === "string" || typeof first_arg === "number" || typeof first_arg === "function") {
				children = args;
			}
			// If first argument is a plain object, treat it as props
			else if (Object.getPrototypeOf(first_arg ?? 0) === Object.prototype) {
				const [props_arg, ...rest_args] = args;
				const { is, ...rest_props } = props_arg;
				props_obj = rest_props;
				children = rest_args;
			}
		}

		// Start building the HTML string
		let html = `<${name}`;

		// Handle props/attributes
		for (const [key, value] of Object.entries(props_obj)) {
			// Skip event handlers and functions
			if (key.startsWith("on") || typeof value === "function") {
				continue;
			}

			// Convert className to class
			const attr_key = key === "className" ? "class" : key;

			// Regular attributes
			if (value === true) {
				html += ` ${attr_key}`;
			} else if (value !== false && value != null) {
				// Escape attribute values
				const escaped_value = String(value)
					.replace(/&/g, "&amp;")
					.replace(/"/g, "&quot;")
					.replace(/'/g, "&#39;")
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;");
				html += ` ${attr_key}="${escaped_value}"`;
			}
		}

		// Self-closing tags
		const void_elements = new Set([
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

		if (void_elements.has(name)) {
			return html + "/>";
		}

		html += ">";

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

		return html + `</${name}>`;
	};

export const staticTags: TagsProxy = new Proxy({}, { get: static_tag_generator });
