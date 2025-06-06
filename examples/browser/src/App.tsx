import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { Tracer } from "@racgoo/scry";

class ComplexTest {
  constructor() {
    console.log("ComplexTest constructor");
  }
  public async start() {
    console.log("Starting complex test");
    const results = [
      new Promise((resolve) => setTimeout(() => resolve(42), 500)),
    ];
    return results.reduce((a, b) => Number(a) + Number(b), 0);
  }
}

function App() {
  function test() {
    Tracer.start();
    const complexTest = new ComplexTest();
    complexTest.start().then(() => {
      console.log("Fist chain finsih");
      complexTest.start().then(() => {
        console.log("Second chain finsih");
      });
    });
    [1, 2, 3]
      .map((a) => {
        return a * 2;
      })
      .filter((a) => {
        return a > 2;
      });
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
