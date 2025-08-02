# IMA (今)

IMA (今, meaning "now" in Japanese) is a lightweight, immediate-mode inspired UI rendering engine for the web. It offers a simple and efficient way to build reactive UIs with minimal overhead.

## Features

- **Minimal API**: Simple tag-based component creation
- **No State Management Management**: No special hooks, stores or libraries - just use JavaScript primitives
- **Animation Frame Rendering & Reactivity**: Automatically updates only what changes
- **No Virtual DOM**: Direct DOM manipulation
- **Tiny Footprint**: ~4kb and no dependencies
- **Static HTML Generation**: Run on edge functions or on any JS runtime

## Usage Example

```js
import { useTags } from "ima";
const { div, button, h1 } = useTags();

let count = 0; // just regular JavaScript variables

const app = div(
	h1(
		{
			// Reactive attribute
			style: () => `
				font-size: ${count}rem
			`,
		},
		"Counter Example",
	),
	// Reactive element
	() => div({ class: "counter" }, count),
	button(
		{
			onclick: () => count++,
		},
		"Increment ",
		// Reactive text child
		() => count,
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
