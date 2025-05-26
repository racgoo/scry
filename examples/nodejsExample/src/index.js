// ES6+ 문법을 사용한 예제
import { Tracer } from "@racgoo/scry";

const greeting = (name) => {
  return "Hello, " + name + "!";
};

const addExclamation = (text) => {
  return text + "!!!";
};

const processText = (text) => {
  return text.toUpperCase();
};

Tracer.start();
for (let i = 0; i < 3; i++) {
  console.log(processText(addExclamation(greeting("World"))));
}

Tracer.end();
