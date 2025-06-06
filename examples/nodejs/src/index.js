import { Tracer } from "@racgoo/scry";

async function asyncTest2(flag) {
  return new Promise((resolve) => setTimeout(() => resolve(flag), 1000));
}

function asyncTest1(flag) {
  console.log("asyncTest");
  asyncTest2(flag + ":hi").then((res) => {
    console.log(res);
  });
  return "hi";
}

function initTest() {
  Tracer.start();
  asyncTest1("1");
  Tracer.end();
}

initTest();
