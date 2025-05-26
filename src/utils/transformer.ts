import Environment from "@utils/enviroment";

//Transformer class. for single instance.
class Transformer {
  //Convert string to base64
  static toBase64(str: string): string {
    return Environment.isNodeJS()
      ? //Use Buffer.from() for node.js
        Buffer.from(str).toString("base64")
      : //Browser inner function
        btoa(str);
  }
}

export default Transformer;
