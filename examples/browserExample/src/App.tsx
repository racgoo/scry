import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { Tracer } from "@racgoo/scry";

function App() {
  function test() {
    function foo1(x: number) {
      foo2(x);
      return x * 2;
    }

    function foo2(z: number) {
      return z * 2;
    }

    function baz(test: { a: number }) {
      return test.a;
    }
    function bar({ y }: { y: number }) {
      throw new Error("test");
      foo1(foo2(2));
      foo2(y + 3);
      baz({ a: 1 });
    }

    Tracer.start();
    bar({ y: 5 });

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
