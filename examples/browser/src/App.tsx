import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { Tracer } from "@racgoo/scry";

function asyncTest2(flag: string) {
  return new Promise((resolve) => setTimeout(() => resolve(flag), 1000));
}
function asyncTest1(flag: string) {
  console.log("asyncTest");
  asyncTest2(flag + ":first").then((res) => {
    console.log(res + "second");
    asyncTest2(flag + ":third").then((res) => {
      console.log(res + "fourth");
    });
  });
  return "hi";
}

function App() {
  function test() {
    Tracer.start();

    asyncTest1("AsyncTest start");

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
      </div>
    </>
  );
}

export default App;
