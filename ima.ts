//
// IMA (今) 0.1.1
// by fergarram
//

// A tiny immediate-mode UI rendering engine.

//
// Index:
//

// — Core Types
// — DOM Element Generation
// — Reactive System

//
// Core Types
//

export type Child = HTMLElement | Node | null | undefined | string | boolean | number | Function;

export type Props = {
	is?: string;
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
} & ((ns?: string) => TagsProxy);

//
// DOM Element Generation
//

// Unique ID generator for elements with reactive content
const generate_element_id = (() => {
	let counter = 0;
	return () => counter++;
})();

export const tag_generator =
	(_: any, name: string): TagFunction =>
	(...args: any[]): HTMLElement => {
		let props_obj: Props = {};
		let children: (HTMLElement | Node | null | undefined | string | boolean | number | Function)[] = args;

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

		// Create the element (with namespace if needed)
		const element = document.createElement(name);

		// Handle props/attributes
		for (const [key, value] of Object.entries(props_obj)) {
			// Event handlers
			if (key.startsWith("on") && typeof value === "function") {
				const event_name = key.substring(2).toLowerCase(); // e.g., "onClick" -> "click"
				element.addEventListener(event_name, value as EventListener);
				continue;
			}

			// Reactive attributes (functions that don't start with "on")
			if (typeof value === "function" && !key.startsWith("on")) {
				register_reactive_attr(element, key, value);
				continue;
			}

			// Regular attributes
			if (value === true) {
				element.setAttribute(key, "");
			} else if (value !== false && value != null) {
				element.setAttribute(key, String(value));
			}
		}

		// Special case: If there's exactly one child and it's a function, treat it as reactive text
		if (children.length === 1 && typeof children[0] === "function") {
			return register_reactive_text(element, children[0] as () => any);
		}

		// Process children and append to element
		for (const child of children.flat(Infinity)) {
			if (child != null) {
				if (child instanceof Node) {
					// Change from HTMLElement to Node
					element.appendChild(child);
				} else if (typeof child !== "function") {
					// Skip function children in normal processing
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

// SOA (Structure of Arrays) approach for reactive components
const reactive_elements: HTMLElement[] = [];
const reactive_callbacks: Array<() => HTMLElement | null> = [];
const reactive_html_cache: string[] = [];
const reactive_count = { value: 0 };

// Structures for reactive attributes
const reactive_attr_elements: HTMLElement[] = [];
const reactive_attr_names: string[] = [];
const reactive_attr_callbacks: Array<() => any> = [];
const reactive_attr_prev_values: any[] = [];
const reactive_attr_count = { value: 0 };

// Structures for reactive text content
const reactive_text_elements: HTMLElement[] = [];
const reactive_text_callbacks: Array<() => any> = [];
const reactive_text_prev_values: any[] = [];
const reactive_text_count = { value: 0 };

const performance_data = {
	components_updated: 0,
	component_count: 0,
	attributes_updated: 0,
	attribute_count: 0,
	text_updates: 0,
	text_count: 0,
	frame_ms: 0,
	rerender_start_time: 0,
	rerender_end_time: 0,
	total_rerender_time: 0,
	is_measuring: false,
};

let animation_frame_requested = false;

export function debug() {
	return performance_data;
}

export function start_render_measurement() {
	performance_data.rerender_start_time = performance.now();
	performance_data.is_measuring = true;
	performance_data.total_rerender_time = 0;
}

export function end_render_measurement() {
	if (performance_data.is_measuring) {
		performance_data.rerender_end_time = performance.now();
		performance_data.total_rerender_time = performance_data.rerender_end_time - performance_data.rerender_start_time;
		performance_data.is_measuring = false;
		console.log(`Total rerender time: ${performance_data.total_rerender_time.toFixed(2)}ms`);
	}
}

function update_reactive_components() {
	animation_frame_requested = false;

	const start_time = performance.now();
	let components_updated = 0;
	let attributes_updated = 0;
	let text_updates = 0;

	// Update all reactive text content
	for (let i = 0; i < reactive_text_count.value; i++) {
		const element = reactive_text_elements[i];
		const callback = reactive_text_callbacks[i];

		// Only proceed if the element is still in the DOM
		if (!element.isConnected) continue;

		const new_value = callback();

		// Only update if the value has changed
		if (new_value !== reactive_text_prev_values[i]) {
			// setTimeout(() => {
			element.textContent = String(new_value);
			// }, 0);
			reactive_text_prev_values[i] = new_value;
			text_updates++;
		}
	}

	// Update all reactive attributes
	for (let i = 0; i < reactive_attr_count.value; i++) {
		const element = reactive_attr_elements[i];
		const attr_name = reactive_attr_names[i];
		const callback = reactive_attr_callbacks[i];

		// Only proceed if the element is still in the DOM
		if (!element.isConnected) continue;

		const new_value = callback();

		// Only update if the value has changed
		if (new_value !== reactive_attr_prev_values[i]) {
			// setTimeout(() => {
			if (new_value === true) {
				element.setAttribute(attr_name, "");
			} else if (new_value === false || new_value == null) {
				element.removeAttribute(attr_name);
			} else {
				element.setAttribute(attr_name, String(new_value));
			}
			// }, 0);

			reactive_attr_prev_values[i] = new_value;
			attributes_updated++;
		}
	}

	// Update all elements in all components
	for (let i = 0; i < reactive_count.value; i++) {
		const element = reactive_elements[i];

		// Only proceed if the element is still in the DOM
		if (!element.isConnected) continue;

		const new_element = reactive_callbacks[i]();

		// Calculate a string representation for comparison
		let new_html = "";
		if (new_element instanceof Element) {
			new_html = new_element.outerHTML;
		}

		// If nothing changed, skip
		if (new_html === reactive_html_cache[i]) continue;

		// Determine what to render
		const actual_new_element = new_element || document.createComment(`reactive-component-${i}`);

		// Replace the old element with the new one
		element.replaceWith(actual_new_element);
		reactive_elements[i] = actual_new_element as any;
		reactive_html_cache[i] = new_html;
		components_updated++;
	}

	const end_time = performance.now();
	const duration_ms = end_time - start_time;

	// Update performance data
	performance_data.components_updated = components_updated;
	performance_data.component_count = reactive_count.value;
	performance_data.attributes_updated = attributes_updated;
	performance_data.attribute_count = reactive_attr_count.value;
	performance_data.text_updates = text_updates;
	performance_data.text_count = reactive_text_count.value;
	performance_data.frame_ms = duration_ms;

	// End measurement if all updates are completed and we're measuring
	if (performance_data.is_measuring && components_updated === 0 && attributes_updated === 0 && text_updates === 0) {
		end_render_measurement();
	}

	// Request next frame if there are still reactive items
	if (reactive_count.value > 0 || reactive_attr_count.value > 0 || reactive_text_count.value > 0) {
		request_animation_frame();
	}
}

function request_animation_frame() {
	if (
		!animation_frame_requested &&
		(reactive_count.value > 0 || reactive_attr_count.value > 0 || reactive_text_count.value > 0)
	) {
		animation_frame_requested = true;
		requestAnimationFrame(update_reactive_components);
	}
}

export function reactive(callback: () => HTMLElement | null): Node {
	const component_index = generate_element_id();
	const element = callback();

	// Create a placeholder comment node
	const placeholder = document.createComment(`reactive-component-${component_index}`);

	// If the initial render is null, use the placeholder
	const actual_element = element || placeholder;

	// Store component data - need to handle different Node types
	reactive_elements[component_index] = actual_element as any; // Cast for compatibility
	reactive_callbacks[component_index] = callback;

	// Store string representation - handle both Element and other Node types
	if (element instanceof Element) {
		reactive_html_cache[component_index] = element.outerHTML;
	} else {
		reactive_html_cache[component_index] = ""; // Empty string for non-Elements
	}

	reactive_count.value++;

	request_animation_frame();
	return actual_element;
}

// Function to register a reactive attribute
function register_reactive_attr(element: HTMLElement, attr_name: string, callback: () => any) {
	const attr_index = reactive_attr_count.value;

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
	reactive_attr_count.value++;

	// Start the animation frame loop
	request_animation_frame();
}

// Function to register reactive text content
function register_reactive_text(element: HTMLElement, callback: () => any) {
	const text_index = reactive_text_count.value;

	// Initialize with current value
	const initial_value = callback();

	// Set the initial text value
	element.textContent = String(initial_value);

	// Store data in our parallel arrays
	reactive_text_elements[text_index] = element;
	reactive_text_callbacks[text_index] = callback;
	reactive_text_prev_values[text_index] = initial_value;
	reactive_text_count.value++;

	// Start the animation frame loop
	request_animation_frame();

	return element;
}
