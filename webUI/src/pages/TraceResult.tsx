import useTypedNavigate from "@webUI/hooks/useTypedNavigate";
import "../App.css";

function TraceResult() {
  const { navigate } = useTypedNavigate();
  function handleHomeClick() {
    navigate("home", "");
  }
  function handleResultClick() {
    navigate("traceResult", "?test=123");
  }
  return (
    <div>
      <div>hi</div>
      <button onClick={handleHomeClick}>Home</button>
      <button onClick={handleResultClick}>Result</button>
    </div>
  );
}

export default TraceResult;
