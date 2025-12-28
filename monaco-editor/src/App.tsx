import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import { setDataMainAce } from "./ace-web-component.js";
import "./App.css";

setDataMainAce("https://cdnjs.cloudflare.com/ajax/libs/ace/1.43.3/ace.min.js");

const initial = `// Fibonacci Sequence Generator
function generateFibonacci(n) {
  const fibonacci = [0, 1];

  for (let i = 2; i < n; i++) {
    fibonacci[i] = fibonacci[i-1] + fibonacci[i-2];
  }

  return fibonacci.slice(0, n);
}

// Generate first 10 Fibonacci numbers
console.log(generateFibonacci(10));`;

function App() {
  const [editorContent, setEditorContent] = useState<string>(initial);

  const handleEditorChange = (event: Event) => {
    const target = event.target as HTMLElementWithValue;
    setEditorContent(target.value);
  };

  // Type interface to handle the value property
  interface HTMLElementWithValue extends HTMLElement {
    value: string;
  }

  // Type interface to handle the value property

  // console.log("editorContent", editorContent);
  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Ace Editor Web Component in React</h1>

      <ace-editor id="my-ace-editor" value={editorContent} lang="javascript" onInput={handleEditorChange} />
      <button onClick={() => setEditorContent(initial)}>Reset Content</button>
      <div>
        <h3>Current Editor Content:</h3>
        <pre>{editorContent}</pre>
      </div>
    </>
  );
}

export default App;
