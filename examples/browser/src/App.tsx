import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { Tracer } from "@racgoo/scry";

class ClassTest {
  constructor() {
    console.log("ClassTest constructor");
  }
  public method1(random: number): Promise<number> {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("method1", random);
        resolve(random);
        console.log("resolve end!");
      }, random * 10);
    });
  }
  public method2() {
    const random = Math.floor(Math.random() * 100);
    return this.method1(random);
  }
}
async function asyncTest() {
  const a = new ClassTest();
  a.method2();
  a.method2();

  // await asyncTest2();
  // await asyncTest2();
  // return 20;
}

function ft1() {
  return 1;
}

function ft2() {}

// function foo1(x: number) {
//   foo2(x);
//   return x * 2;
// }

// function foo2(z: number) {
//   return z * 2;
// }

// function baz(test: { a: number }) {
//   return test.a;
// }

// function bar({ y }: { y: number }) {
//   foo1(foo2(2));
//   foo2(y + 3);
//   baz({ a: 1 });
// }

class ComplexTest {
  private instance: ClassTest;

  constructor() {
    console.log("ComplexTest constructor");
    this.instance = new ClassTest();
  }

  private async chainedCall(depth: number): Promise<number> {
    if (depth <= 0) return 0;

    const result = await this.instance.method2();
    const nextResult = await this.chainedCall(depth - 1);

    return result + nextResult;
  }

  public async start() {
    console.log("Starting complex test");

    // 병렬 실행
    const results = await Promise.all([
      this.chainedCall(3), // 3번 중첩 호출
      this.instance.method2(),
      new Promise((resolve) => setTimeout(() => resolve(42), 500)),
    ]);

    console.log("All results:", results);
    return results.reduce((a, b) => Number(a) + Number(b), 0);
  }
}

async function superComplexTest() {
  const complex = new ComplexTest();
  const result = await complex.start();

  // 마지막 테스트
  const classTest = new ClassTest();
  await classTest.method2();

  console.log("Final result:", result);
  return result;
}

// 실행

function App() {
  function test() {
    // const classTest = new ClassTest();

    Tracer.start();
    asyncTest();
    superComplexTest().then(() => {
      console.log("Everything completed!");
    });

    // bar({ y: 5 });
    // classTest.test2();

    Tracer.end();
  }
  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={test}>Test Click Me</button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
