import { HashRouter, Routes, Route } from "react-router-dom";

import Dummy from "./src/pages/dummy.js";
import Dummy2 from "./src/pages/dummy2.js";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dummy />} />
        <Route path="/dummy2" element={<Dummy2 />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
