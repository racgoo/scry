import * as flatted from "flatted";
import { encode, decode } from "js-base64";
function useTransformer() {
  return {
    serialize: (data: unknown) => {
      return encode(flatted.stringify(data));
    },
    deserialize: (str: string) => {
      return flatted.parse(decode(str));
    },
  };
}

export { useTransformer };
