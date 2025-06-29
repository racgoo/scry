import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

import { asyncMultiplePhaseTest, syncMultiplePhaseTest } from "./test";

function App() {
  function handleAsyncTestClick() {
    asyncMultiplePhaseTest();
  }
  function handleSyncTestClick() {
    syncMultiplePhaseTest();
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
        <button onClick={handleAsyncTestClick} style={{ marginRight: 10 }}>
          Async Test
        </button>
        <button onClick={handleSyncTestClick}>Sync Test</button>
      </div>
    </>
  );
}

export default App;
