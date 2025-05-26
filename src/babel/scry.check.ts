import Environment from "@/utils/enviroment";
import * as babel from "@babel/core";
import { DEVELOPMENT_MODE, TRACE_MARKER } from "@babel/scry.constant";

//Checkers for scry babel plugin
class ScryChecker {
  private t: typeof babel.types;
  constructor(t: typeof babel.types) {
    this.t = t;
  }

  //Check if the file is a node module
  static isNodeModule(state: babel.PluginPass) {
    const filePath = state?.filename || "";
    if (filePath.includes("node_modules")) {
      return true;
    } else {
      return false;
    }
  }

  //Check if the environment is development/ it used only AST(babel)
  static isDevelopmentMode() {
    return Environment.isNodeJS() && process.env.NODE_ENV === DEVELOPMENT_MODE;
  }

  // Check if the function is a process execution(process.on, process.emit, etc.. it does not need to be traced)
  // static isProcessExecution(path: babel.NodePath<babel.types.CallExpression>) {
  //   const callee = path.node.callee;
  //   return (
  //     t.isMemberExpression(callee) &&
  //     t.isIdentifier(callee.object) &&
  //     callee.object.name === "process"
  //   );
  // }

  //Check if the function is a chained function
  public isChainedFunction(path: babel.NodePath<babel.types.CallExpression>) {
    const callee = path.node.callee;
    return (
      this.t.isMemberExpression(callee) &&
      this.t.isCallExpression(callee.object)
    );
  }

  //Check if the function is a pre-processed function
  public isDuplicateFunction(path: babel.NodePath<babel.types.CallExpression>) {
    const callee = path.node.callee;
    return (
      this.t.isArrowFunctionExpression(callee) ||
      path.node.leadingComments?.some((comment) =>
        comment.value.includes(TRACE_MARKER)
      )
    );
  }

  //Check if the function is a JSX function
  public isJSX(path: babel.NodePath<babel.types.CallExpression>) {
    const callee = path.node.callee;
    return (
      (this.t.isIdentifier(callee) && callee.name.startsWith("_jsx")) ||
      (this.t.isMemberExpression(callee) &&
        this.t.isIdentifier(callee.object) &&
        callee.object.name === "React")
    );
  }
}

export default ScryChecker;
