import { Tracer } from "@racgoo/scry";

async function asyncTest1(flag: string) {
  console.log("asyncTest", flag);
  await asyncTest2(flag + ":await1");
  asyncTest2(flag + ":then1").then((res) => {
    console.log(res);
  });
  await asyncTest2(flag + ":await2");
  console.log("alldone");
  return flag + "bye..";
}

async function asyncTest2(flag: string) {
  return new Promise((resolve) => setTimeout(() => resolve(flag), 1000));
}

const syncTest1 = () => {
  console.log("syncTest1");
};
const syncTest2 = () => {
  console.log("syncTest2");
};

export const syncTest = (value: number) => {
  syncTest1();
  syncTest2();
  return value;
};

class TestClass {
  constructor() {}
  test() {
    console.log("test");
  }
}

export const classTest = () => {
  const testInstance = new TestClass();
  testInstance.test();
};

export const chainedTest = (arr: number[]) => {
  arr.map((num) => num * 2).filter((num) => num > 3);
};

export async function asyncMultiplePhaseTest() {
  Tracer.start("asyncMultiplePhaseTest_1");
  asyncTest1("then1").then(() => {
    console.log("asyncMultiplePhaseTest_1_then1");
  });
  await asyncTest1("await1");
  Tracer.end();
  Tracer.start("asyncMultiplePhaseTest_2");
  asyncTest2("then2").then(() => {
    console.log("asyncMultiplePhaseTest_2_then2");
  });
  await asyncTest1("await2");
  Tracer.end();
}

export function syncMultiplePhaseTest() {
  Tracer.start("syncMultiplePhaseTest_1");
  chainedTest([1, 2, 3]);
  classTest();
  syncTest(1);
  Tracer.end();
  Tracer.start("syncMultiplePhaseTest_2");
  chainedTest([4, 5, 6]);
  classTest();
  syncTest(2);
  Tracer.end();
}
