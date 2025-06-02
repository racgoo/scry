import { Environment } from "./enviroment.js";

//Transformer class. for single instance.
class Transformer {
  //Convert string to base64
  static toBase64(str: string): string {
    return Environment.isNodeJS()
      ? //Use Buffer.from() for node.js
        Buffer.from(str).toString("base64")
      : //Browser inner function ?? btoa cannot handle korean.. i need to learn this.
        btoa(
          encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
            String.fromCharCode(parseInt(p1, 16))
          )
        );
  }
}

export { Transformer };
