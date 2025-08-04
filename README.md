# IMA (今)

IMA (今, meaning "now" in Japanese) is a lightweight, immediate-mode inspired UI rendering engine for the web. It offers a simple and efficient way to build reactive UIs with minimal overhead.

## Features

- **Minimal API**: A single function for all tags
- **No State Management Management**: No special hooks, stores or libraries - just use JavaScript primitives
- **Built-in Reactivity**: Callbacks as a reactive building block
- **No Virtual DOM**: Direct DOM manipulation
- **Tiny Footprint**: ~4kb and no dependencies
- **Static HTML Generation**: Run on edge functions or on any JS runtime

## Usage Example

```js
import { useTags } from "ima";
const { div, button, span, h1 } = useTags();

let count = 0; // just regular JavaScript variables

const app = div(
	h1(
		{
			// Reactive attribute
			style: () => `
				transition: font-size 100ms;
				font-size: ${count + 1}rem;
			`,
		},
		// Reactive element
		() => span(count + 1, "x"),
	),
	button(
		{
			class: "button-class-or-tailwind-or-whatever",
			onclick: () => count++,
		},
		// Reactive text child
		() => `Get to ${count + 2}x`,
	),
);

// Add to DOM
document.body.appendChild(app);

```

## TODO

- [ ] Add examples for SSR/SSG, page routing, modal, select, etc.
- [ ] Minimize further like van.js

## License

MIT
