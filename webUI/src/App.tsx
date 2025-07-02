import { HashRouter, Routes, Route } from "react-router-dom";
import TraceResult from "@pages/TraceResult";
import typedRoute from "@routes/typedRoute";

import "./App.css";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path={typedRoute.home} element={<TraceResult />} />
        <Route path={typedRoute.traceResult} element={<TraceResult />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
