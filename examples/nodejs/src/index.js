import { Tracer } from "@racgoo/scry";

class ClassTest {
  test() {
    return 1;
  }
  test2() {
    for (let i = 0; i < 10; i++) {
      this.test();
    }
    return 2;
  }
}

const greeting = (name) => {
  return "Hello, " + name + "!";
};

const addExclamation = (text) => {
  return text + "!!!";
};

const processText = (text) => {
  return text.toUpperCase();
};

const classTest = new ClassTest();

Tracer.start();

processText(addExclamation(greeting("World")));
classTest.test2();

Tracer.end();
