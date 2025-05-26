import * as babel from "@babel/core";
import { DEVELOPMENT_MODE, TRACE_MARKER } from "@babel/scry.constant";
const t = babel.types;

//Checkers for scry babel plugin
class ScryChecker {
  //Check if the file is a node module
  static isNodeModule(state: babel.PluginPass) {
    const filePath = state?.filename || "";
    if (filePath.includes("node_modules")) {
      return true;
    } else {
      return false;
    }
  }

  //Check if the environment is development
  static isDevelopmentMode() {
    const ENV_MODE = process.env.NODE_ENV;
    if (ENV_MODE === DEVELOPMENT_MODE) {
      return true;
    } else {
      return false;
    }
  }

  //Check if the function is a chained function
  static isChainedFunction(path: babel.NodePath<babel.types.CallExpression>) {
    const callee = path.node.callee;
    return t.isMemberExpression(callee) && t.isCallExpression(callee.object);
  }

  //Check if the function is a pre-processed function
  static isDuplicateFunction(path: babel.NodePath<babel.types.CallExpression>) {
    const callee = path.node.callee;
    return (
      t.isArrowFunctionExpression(callee) ||
      path.node.leadingComments?.some((comment) =>
        comment.value.includes(TRACE_MARKER)
      )
    );
  }

  //Check if the function is a JSX function
  static isJSX(path: babel.NodePath<babel.types.CallExpression>) {
    const callee = path.node.callee;
    return (
      (t.isIdentifier(callee) && callee.name.startsWith("_jsx")) ||
      (t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object) &&
        callee.object.name === "React")
    );
  }
}

export default ScryChecker;
