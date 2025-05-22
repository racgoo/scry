# 🔍 Scry

<div align="center">

<img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version"/>
<img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License"/>
<img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"/>

**JavaScript/TypeScript 함수 호출 및 실행 흐름 추적 디버깅 도구**

</div>

---

## 소개

Scry는 JavaScript와 TypeScript 환경에서 함수와 메서드의 호출, 입력값과 출력값, 함수 이름까지  
모두 기록해주는 함수 실행 컨텍스트 추적 라이브러리입니다.

예기치 못한 런타임 오류와 불친절한 에러 메시지로 인한 디버깅 난관을 해소하기 위해 만들었습니다.  
복잡한 코드의 흐름을 쉽게 파악하고, 함수 호출 간 관계를 명확하게 분석할 수 있도록 돕습니다.

---

## 주요 기능

- 함수 및 메서드의 호출 시점, 입력값, 출력값 완전 기록
- 호출 함수명과 호출 스택 자동 추적
- JS/TS 환경 어디서든 사용 가능 (Node.js, 브라우저)
- Babel 플러그인 연동으로 정적 코드 분석 및 최적화 지원
- 에러 메시지 개선 및 디버깅 용이성 극대화 (개발 중)

---

## 설치

```bash
npm install @racgoo/scry
```

혹은

```bash
yarn add @racgoo/scry
```

### 1. Babel 플러그인 설정

`babel.config.js` 또는 `.babelrc` 파일에 아래 플러그인을 추가하세요:

```js
module.exports = {
  plugins: ["@racgoo/scry/scryBabelPlugin"],
};
```

### 2. 함수 실행 추적

Tracer.start() 와 Tracer.end() 사이에 실행되는 모든 함수 및 메서드 호출의 이름, 입력값, 결과값이 출력됩니다.

```js
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

contact: lhsung98@naver.com
