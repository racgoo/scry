# 🔍 Scry

# **JavaScript/TypeScript execution flow tracking debugging tools**

<div align="center">
  <img src="https://img.shields.io/badge/version-0.0.37-blue.svg" alt="Version"/>
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License"/>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"/>
</div>

<div align="center">
  <img width="320" alt="Scry" src="https://github.com/user-attachments/assets/d6ca7480-658b-484a-8a51-00edbcb082c7" />
</div>

Github: [https://github.com/racgoo/scry](https://github.com/racgoo/scry)

NPM: [https://www.npmjs.com/package/@racgoo/scry](https://www.npmjs.com/package/@racgoo/scry)

---

## Introduction

Scry is a JavaScript and TypeScript function execution context tracing library
that records every function and method call—along with its name, input, and output.

It was created to ease the pain of debugging unexpected runtime errors and unhelpful error messages.
Scry helps you clearly understand complex code flow and analyze relationships between function calls with precision.

---

## Features

- Full recording of function and method calls, including input and output values

- Automatic tracking of function names and call stacks

- Compatible with Node.js and browser environments.
In the Browser, trace results are displayed directly in the console with a clickable link to view them in a new tab.
In Node.js, results are saved as a current-trace.html file in the scry folder at the project root, which you can open in a browser to view the trace.

---

## Trace Output & Report View
- #### Browser  
  Automatically opens the trace result page in a **new browser tab** when tracing is complete.

- #### Node.js  
  Saves the trace result as `scry/current-trace.html` at the project root — open it manually in a browser to view.


-  #### Report (WebUI)

  <img width="1435" alt="스크린샷 2025-05-31 오전 12 42 51" src="https://github.com/user-attachments/assets/103f29d1-ba8c-4f70-b41d-601e21dc1c4a" />
  <img width="1439" alt="스크린샷 2025-05-31 오전 12 43 17" src="https://github.com/user-attachments/assets/fb329923-f610-4662-9139-f35ac48da5c4" />




---

## Install

```bash
# use npm
npm i @racgoo/scry

# use yarn
yarn add @racgoo/scry
```

---

## Usage

### 1. Babel Plugin Setting

Add the following plugin to your babel.config.js or .babelrc file

```jsx
import { scryBabelPlugin } from "@racgoo/scry";
⚠️ Plugin setup may differ depending on the bundler you're using. ⚠️
If setting things up feels difficult, please refer to the "examples" in the GitHub repository.

----------------------------------------------------------------------

#vite example (vite.config.js)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { scryBabelPlugin } from "@racgoo/scry";

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  plugins: [
    react({
      babel: {
        plugins: [scryBabelPlugin],
      },
    }),
  ],
});

----------------------------------------------------------------------

#nodejs example (babel.config.js)
import { scryBabelPlugin } from "@racgoo/scry";

export default {
  presets: [],
  plugins: [scryBabelPlugin],
};


```

### 2. Execution Context Tracing

All function and method calls executed between `Tracer.start()` and `Tracer.end()` will have their names, input values, and return values automatically logged and recorded.

⚠️ Only works when NODE_ENV=development is set in your Node.js environment. ⚠️

```jsx
import { Tracer } from "@racgoo/scry";

function foo(x: number) {
  return x * 2;
}

function bar(y: number) {
  return foo(y) + 1;
}

Tracer.start();
bar(5);
Tracer.end();
```

✨ Files inside node_modules are not traced. If you need this feature, feel free to contact us. ✨

---

### 🔧 Future Work

#### Enhanced Parameter & Return Type Tracking

Further improvements are underway to better validate and track function parameters and return values, especially for complex nodes such as `BinaryExpression`, `CallExpression`, and others.

#### Async Function Support

Tracing for `asynchronous functions` is not yet implemented. Development is currently in progress.

#### Improved error messaging

error handling and clearer error messages are currently under development.😅

---

### Contact

###### Have questions, suggestions, or want to contribute?

###### Feel free to reach out at

[[📬 send mail]](mailto:lhsung98@naver.com)
