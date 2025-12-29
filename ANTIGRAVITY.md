I need to create a web component for monaco editor

# CLAUDE.md

This file provides guidance to Antigravity when working with code in this repository.

## Project Overview

This repository is a comprehensive learning path for **Web Components**, culminating in a production-ready **Monaco Editor Web Component** https://microsoft.github.io/monaco-editor/. The project teaches web component concepts progressively through few hands-on lessons, from basic custom elements to advanced component patterns.

## Repository Structure

```
/
├── server.js                    # Simple Express server for development
├── package.json                 # Node.js dependencies (Express only)
├── index.html                   # Landing page with navigation to all lessons
├── .nojekyll                    # GitHub Pages configuration
│
├── /learning/                   # Progressive web components lessons
│   ├── 001_basic_custom_element/
│   ├── 002_another_custom_element/
│   ├── 003_...
│   └── 0xx_final_monaco_component/
│   Each directory contains an index.html file
│
└── /noprettier/                 # External libraries (not processed by prettier)
    └── /monaco-editor-*/

```

## Development Commands

### Start Development Server

```bash
node server.js
```

- Serves all files from the project root on http://localhost:3000
- Serves static files including `/node_modules` and `/noprettier`
- No build process required - pure web standards

### Install Dependencies

```bash
npm install
```

Only installs Express (no bundler, no React, no build tools)

## Monaco Editor Setup

### Version Information

- **Download Source**: https://github.com/microsoft/monaco-editor/releases
- **Installation**: Manual download as zip file (not npm)

### Installation Steps

1. Download Source code (tar.gz) from GitHub releases
2. Extract to `/noprettier/monaco-editor-[version]/`

### Why Manual Installation?

The project follows a pure web standards approach without npm packages for frontend code. Monaco editor is loaded dynamically at runtime using the async script loading pattern.

## Learning Path Architecture

### Lessons 001-008: Web Components Fundamentals

Progressive introduction to web components APIs:

1. Basic custom elements and lifecycle
2. Shadow DOM and style encapsulation
3. Attributes, properties, and reactivity
4. Content projection with slots
5. Complete lifecycle management
6. Event handling and custom events
7. Template elements and performance
8. Async script loading patterns

### Lessons 009-016: Monaco Editor Web Component

Phased build of production-ready component: 9. Async loader for Monaco editor 10. Basic component shell and structure 11. Editor initialization after async load 12. Configuration (mode, theme, options) 13. Content management and update patterns 14. Auto-sizing based on content 15. Advanced features (linking, clipboard) 16. Final production component

### Design Principles

- **Zero dependencies**: Each lesson uses pure HTML/JS/CSS
- **Progressive**: Each lesson builds on previous concepts
- **Minimal UI**: Raw HTML elements, no fancy styling
- **Practical**: Real-world patterns used in production
- **Self-contained**: Each lesson is complete and runnable
- **MDN Documentation**: Each lesson includes relevant MDN (Mozilla Developer Network) links for deeper learning

## Key Technical Patterns

### 1. Async Script Loading Pattern

Based on `existing_examples/github.js:347-375`:

```javascript
async function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let handler = setInterval(() => {
      if (window.ace && window.ace.edit) {
        clearInterval(handler);
        resolve();
      }
    }, 100);
    script.src = src;
    document.head.appendChild(script);
  });
}
```

When presenting prototypes of web component wrapping ace editor always present (render) at least two components at the same time to inspect if ace editor is loaded twice or not. Should be loaded once (Loaded - I mean loading main ace editor script ace.js once per page loaded. I don't want to have ace.js loaded twice because we are rendering web component more than one).

### 2. Editor Update Management

```javascript
// Skip updates when editor has focus to prevent conflicts
if (!this.updateFlag) return;

const editorContent = editor.value;
if (editorContent !== this.pendingContent) {
  editor.setValue(this.pendingContent, -1);
}
```

Pattern prevents update loops between component state and editor state.

## Final Monaco Editor Web Component API

### Basic Usage

```html
<monaco-editor
  src="/noprettier/**"
  value="console.log('Hello World');"
  lang="javascript"
  theme="idle_fingers"
  wrap
  readonly
>
</monaco-editor>
```

### Attributes

- `src` (required): Path to ace.js file
- `value`: Initial editor content
- `lang`: Language mode (javascript, python, json, etc.)
- `theme`: Editor theme (default: idle_fingers)
- `wrap`: Enable line wrapping (boolean attribute)
- `readonly`: Make editor read-only (boolean attribute)
- `tab-size`: Tab size in spaces (default: 4)

### Properties

- `.value`: Get/set editor content
- `.editor`: Access underlying Ace editor instance
- `.focus()`: Focus the editor

### Events

- `change`: Fired when content changes
  - `event.detail.value`: New content
- `ready`: Fired when Ace editor is loaded and initialized
  - `event.detail.editor`: Ace editor instance

## Reference Implementation Notes

These files demonstrate:

- Async loading pattern for Monaco editor
- Update management between React state and editor
- Auto-sizing calculations
- Focus/blur handling
- Event delegation for UI interactions

## GitHub Pages Deployment

The repository is configured to serve via GitHub Pages from the root directory:

- `.nojekyll` file prevents Jekyll processing
- All files served statically
- `/noprettier/` directory included for Monaco editor
- No build process required

## Common Tasks

### Adding a New Lesson

1. Create directory: `/learning/0XX_lesson_name/`
2. Create `index.html` with minimal HTML structure
3. Implement web component inline in `<script>` tag
4. Add relevant MDN documentation links (see MDN Links section below)
5. Add navigation link in root `index.html`
6. Keep it minimal - raw HTML elements only

### MDN Documentation Links

Each lesson should include relevant MDN links in a "Further Reading" section. Common MDN resources:

**Web Components:**

- Using custom elements: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements
- Using shadow DOM: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM
- Using templates and slots: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots

**APIs:**

- customElements.define(): https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define
- attachShadow(): https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow
- observedAttributes: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#responding_to_attribute_changes
- attributeChangedCallback: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks
- slot element: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot

**Lifecycle Callbacks:**

- connectedCallback: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks
- disconnectedCallback: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks
- adoptedCallback: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks

### Updating Monaco Editor Version

1. Download new version from https://github.com/ajaxorg/ace-builds/releases
2. Extract to `/noprettier/*/`
3. Update `src` paths in lessons 009-016
4. Test all Monaco-related lessons
5. Update version number in this file

### Testing the Web Component

1. Start server: `node server.js`
2. Open: http://localhost:3000/learning/\*/
3. Test all attributes and properties
4. Check browser console for errors
5. Verify cleanup on disconnect (no memory leaks)

## Architecture Decisions

### Why No Build Process?

- Pure web standards approach
- Maximum compatibility and longevity
- Easy to understand and debug
- No tooling complexity
- Directly maps to what browsers run

### Why Manual Monaco Download?

- Following existing project pattern
- Full control over version
- No npm dependency conflicts
- Matches production deployment strategy
- Simpler for learning purposes

### Why Progressive Lessons?

- Each concept builds on previous
- Easy to debug and understand
- Can reference specific lesson for each feature
- Demonstrates real-world component development
- Clear learning progression

## Troubleshooting

### Monaco Editor Not Loading

1. Check path in `src` attribute matches actual file location
2. Verify `/noprettier/*/` directory exists and contains ace.js
3. Check browser console for 404 errors
4. Ensure server is running and serving static files

### Component Not Registering

1. Verify component name has hyphen (required for custom elements)
2. Check `customElements.define()` is called
3. Ensure script runs after DOM is ready
4. Check for JavaScript errors in console

### Editor Not Auto-sizing

1. Verify 'change' event listener is attached to session
2. Check height calculation includes scrollbar width
3. Ensure `editor.resize()` is called after height change
4. Test with different content lengths

### Updates Not Working

1. Check focus/blur state management
2. Verify `updateFlag` is set correctly
3. Ensure `attributeChangedCallback` is implemented
4. Check `observedAttributes` includes 'value'

## React Integration Strategy for Monaco Editor Web Component

### Objectives

- Seamlessly use the existing Web Component in React
- Minimal wrapper required
- Preserve all existing functionality
- Support React's controlled component pattern

### Integration Approaches

#### 1. Direct Web Component Usage

```jsx
function MonacoEditorComponent() {
  const [code, setCode] = useState("");

  return <monaco-editor value={code} onInput={(e) => setCode(e.target.value)} lang="javascript" theme="theme-name" />;
}
```

#### 2. Wrapper Component

```jsx
function ReactMonacoEditor({ value, onChange, lang = "javascript", theme = "idle_fingers", ...props }) {
  const ref = useRef(null);

  useEffect(() => {
    const current = ref.current;

    const handleInput = (e) => {
      onChange(e.target.value);
    };

    current?.addEventListener("input", handleInput);

    return () => {
      current?.removeEventListener("input", handleInput);
    };
  }, [onChange]);

  return <monaco-editor ref={ref} value={value} lang={lang} theme={theme} {...props} />;
}
```

### Key Considerations

- Use `customElements.define()` before React rendering
- Ensure Monaco editor script is loaded before component usage
- Handle async script loading
- Preserve web component's native event system

### Potential Challenges

1. Script Loading: Ensure Monaco.js is loaded before component registration
2. Event Handling: Map React's synthetic events to web component events
3. Prop Mapping: Translate React props to web component attributes

### Recommended Setup

1. Create a thin React wrapper
2. Use `ref` to access web component methods
3. Attach event listeners for state synchronization
4. Defer to web component's native behavior where possible

### Performance Optimizations

- Lazy load Monaco editor script
- Memoize wrapper component
- Use `shouldComponentUpdate` or `React.memo` for minimal re-renders
