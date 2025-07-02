import { useNavigate } from "react-router-dom";
import typedRoute from "@routes/typedRoute";

function useTypedNavigate() {
  const nativeNavigate = useNavigate();
  function navigate(route: keyof typeof typedRoute, extraPath?: string) {
    const targetRoute = typedRoute[route] + (extraPath || "");
    nativeNavigate(targetRoute);
  }
  return { navigate };
}

export default useTypedNavigate;
