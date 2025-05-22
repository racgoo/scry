# 🔍 Scry

<div align="center">
<img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version"/>
<img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License"/>
<img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"/>
![](https://d1085v6s0hknp1.cloudfront.net/boards/coinsect_blog/de70e635-96a5-4062-92bc-c61d2a5ea1a7_Scry.png)
## **JavaScript/TypeScript function call and execution flow tracking debugging tools**

</div>

---

## Introduction

Scry is a JavaScript and TypeScript function execution context tracing library
that records every function and method call—along with its name, input, and output.

It was created to ease the pain of debugging unexpected runtime errors and unhelpful error messages.
Scry helps you clearly understand complex code flow and analyze relationships between function calls with precision.

---

## Fetures

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

---

### Contact

###### Have questions, suggestions, or want to contribute?

###### Feel free to reach out at

[[📬 send mail]](mailto:lhsung98@naver.com)
