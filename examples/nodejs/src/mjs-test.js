async function asyncTest1(flag) {
  await asyncTest2(flag + ":await1");
  asyncTest2(flag + ":then1").then((res) => {
    console.log(res);
  });
  await asyncTest2(flag + ":await2");
  console.log("alldone");
  return flag + "bye..";
}

async function asyncTest2(flag) {
  return new Promise((resolve) => setTimeout(() => resolve(flag), 1000));
}

export async function asyncTest() {
  asyncTest1("then1").then((res) => {
    console.log(res);
  });
  await asyncTest1("await1");
  asyncTest1("then2").then((res) => {
    console.log(res);
  });
  await asyncTest1("await2");
}

const syncTest1 = () => {
  console.log("syncTest1");
};
const syncTest2 = () => {
  console.log("syncTest2");
};

export const syncTest = () => {
  syncTest1();
  syncTest2();
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
