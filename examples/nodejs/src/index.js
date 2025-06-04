import { Tracer } from "@racgoo/scry";

async function asyncTest2(flag) {
  return new Promise((resolve) => setTimeout(resolve, 1000));
}

async function asyncTest(falg) {
  console.log("asyncTest");
  await asyncTest2("2");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return "hi";
}

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

// processText(addExclamation(greeting("World")));
// classTest.test2();
asyncTest("1");

Tracer.end();
