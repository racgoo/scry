# 🔍 Scry(ver. Beta)

# **JavaScript/TypeScript execution flow tracker**

<div align="center">
  <img src="https://img.shields.io/badge/version-0.0.45-blue.svg" alt="Version"/>
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

## Supports

#### Runtime Environments
- Node.js - Server-side JavaScript runtime
- Browser - Modern web browsers with ES2018+ support

#### Module Systems
- CommonJS (CJS) - Traditional Node.js module system using require() and module.exports
- ES Modules (ESM) - Modern JavaScript module system using import and export

#### Dual Package Support
- This library provides dual package distribution with automatic module resolution:

---

## Features

- Full recording of function and method calls, including input and output values

- Automatically tracks function names and call stacks, grouping them by execution context.
Even in chained calls like test().test(), each call is recognized and grouped together, preserving the chaining structure.
It also fully supports asynchronous contexts, allowing seamless tracking across async/await, .then(), and callbacks.

- Compatible with both Node.js and browser environments.
In the browser, trace results are displayed directly in the console with a clickable link that opens the visual report in a new tab.
In Node.js, trace results are saved as `HTML` files under the scry/report folder at the project root. The report is `automatically opened` in a new browser tab upon execution, providing immediate visual feedback.

---

## Trace Output & Report View
- #### Browser  
  Automatically opens the trace result page in a **new browser tab** when tracing is complete.

- #### Node.js  
  Saves the trace result as an HTML file under the scry/report folder at the project root. The report opens automatically in a `new browser tab` upon execution for immediate visual inspection.


-  #### Report (WebUI)

<img width="1405" alt="image" src="https://github.com/user-attachments/assets/154a7b80-c79f-4cff-b76c-a0c1a6f71f51" />





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
import { scryBabelPluginForESM, scryBabelPluginForCJS } from "@racgoo/scry/babel";
//⚠️ Plugin setup may differ depending on the bundler you're using. ⚠️
//If setting things up feels difficult, please refer to the "examples" in the GitHub repository.

----------------------------------------------------------------------
/*
#vite example (vite.config.js)
ESM and CJS have identical execution behavior when using bundlers like Vite, with the module system determined by the type field in package.json (e.g., "module" for ESM, or "commonjs" for CJS).
When writing code, you should match your import or require usage to the module type defined in package.json. However, since Babel is used for transpilation, it's important to choose Babel plugins that are compatible with the final output module system.
In the case of Vite, which produces ESM-based output, you should use Babel plugins that are compatible with ESM.import { defineConfig } from "vite";
*/

import react from "@vitejs/plugin-react";
import { scryBabelPlugin } from "@racgoo/scry/babel";

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  plugins: [
    react({
      babel: {
        plugins: [scryBabelPluginForESM],
//if transfiled output's module system is ESM, use scryBabelPluginESM
//if transfiled output's  module system is CJS, use scryBabelPluginCJS
      },
    }),
  ],
});

----------------------------------------------------------------------
/*
#nodejs example (babel.config.js)
In Node.js, you can also use either import or require based on the type field defined in package.json.
However, when using Babel, you must choose and apply ESM or CJS-specific plugins based on the module system of the final transpiled output, not just the source code.
*/

1. ESM module system.(package.json.type === "module")
import { scryBabelPluginESM } from "@racgoo/scry/babel"; 
export default {
  presets: [],
  plugins: [scryBabelPluginESM], 
//if transfiled output's module system is ESM, use scryBabelPluginESM
//if transfiled output's  module system is CJS, use scryBabelPluginCJS

};

2. CJS module system.(package.json.type === "commonjs")
const { scryBabelPluginCJS } = require("@racgoo/scry");
module.exports = {
  presets: [],
  plugins: [scryBabelPluginCJS],
//if transfiled output's module system is ESM, use scryBabelPluginESM
//if transfiled output's  module system is CJS, use scryBabelPluginCJS};


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

Tracer.start("description_1");
foo(2)
bar(5);
Tracer.end();

Tracer.start("description_2");
bar(7);
foo(10)
Tracer.end();
```

---

### 🔧 Future Work



#### Improved error messaging

error handling and clearer error messages are currently under development.😅

---

### 🔧 Bugs 
##### Function, Class source code extracting is not working..(fixed)
##### Trace.start() ~~ Trace.end() pattern cannot be twice in runtime..(fixed)


believe me!

---

### Third Party Licenses

This project uses the following third-party packages:

- [Day.js](https://github.com/iamkun/dayjs) - MIT License
- [Zone.js](https://github.com/angular/angular) - MIT License
- [flatted](https://github.com/WebReflection/flatted) - ISC License
- [js-base64](https://github.com/dankogai/js-base64) - BSD-3-Clause License
---

### Contact

###### Have questions, suggestions, bugs, or want to contribute?

###### Feel free to reach out at

[[📬 send mail]](mailto:lhsung98@naver.com)
