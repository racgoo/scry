import { useLayoutEffect, useState } from "react";
import type { TraceNode } from "../types/injection";
import { useTransformer } from "./useTransformer";

function useInjectionData() {
  const { deserialize } = useTransformer();
  const [data, setData] = useState<TraceNode[]>([]);
  useLayoutEffect(() => {
    try {
      const deserializedData: TraceNode[] = deserialize(
        window.__INJECTION_DATA__
      );
      setData(deserializedData);
    } catch (error) {
      console.error(error);
    }
  }, []);
  return { data };
}

export { useInjectionData };
