# 🔍 Scry

<div align="center">
<img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version"/>
<img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License"/>
<img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"/>

## **JavaScript/TypeScript function call and execution flow tracking debugging tools**

</div>

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

- Works seamlessly in both JavaScript and TypeScript (Node.js and browser environments)

- Improved error messaging and debugging experience (currently under development)

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

#### Node.js Runtime Support

Full support for tracing in Node.js environments is under active development.

---

### Contact

###### Have questions, suggestions, or want to contribute?

###### Feel free to reach out at

[[📬 send mail]](mailto:lhsung98@naver.com)
