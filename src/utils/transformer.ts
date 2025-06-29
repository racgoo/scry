import { encode, decode } from "js-base64";
import * as flatted from "flatted";

//Transformer class. for single instance.
class Transformer {
  static toBase64(str: string): string {
    return encode(str);
  }

  static fromBase64(str: string): string {
    return decode(str);
  }

  //Serialize(Circular JSON is ok )
  static serialize(obj: any): string {
    return this.toBase64(flatted.stringify(obj));
  }

  //Deserialize(Circular JSON is ok )
  static deserialize<T>(str: string): T {
    return flatted.parse(this.fromBase64(str)) as T;
  }
}

export { Transformer };
