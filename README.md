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

// State - just regular JavaScript variables
let count = 0;

// Create UI
const app = div(
	h1("Counter Example"),
	div({ class: "counter" }, () => count), // Reactive element
	button(
		{
			onclick: () => count++,
		},
		"Increment",
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
