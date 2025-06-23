import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { Tracer } from "@racgoo/scry";
import { asyncTest, classTest, syncTest } from "./test";

function App() {
  function handleClick() {
    Tracer.start();
    syncTest();
    asyncTest();
    classTest();
    Tracer.end();
  }

  return (
    <>
      <div style={{ display: "flex", gap: "10px" }}>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
          <p>{"Sorry Vite Icon :)"}</p>
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
          <p>{"Sorry React Icon :)"}</p>
        </a>
      </div>
      <h1>!!Scry Test!!</h1>
      <div className="card">
        <button onClick={handleClick}>Test Click Me</button>
      </div>
    </>
  );
}

export default App;
