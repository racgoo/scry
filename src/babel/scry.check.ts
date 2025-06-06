import { Environment } from "../utils/enviroment.js";
import { DEVELOPMENT_MODE, TRACE_MARKER, TRACE_ZONE } from "./scry.constant.js";
import { Extractor } from "../utils/extractor.js";
import * as babel from "@babel/core";

//Checkers for scry babel plugin
class ScryChecker {
  private t: typeof babel.types;
  constructor(t: typeof babel.types) {
    this.t = t;
  }
  static isESM(filePath: string): boolean {
    const pkgJson = Extractor.extractNearestPackageJSON(filePath);
    if (!pkgJson) return false;
    return pkgJson?.type === "module";
  }

  //Check if the function is a ReactDOM call
  public isReactDOMCall(
    node: babel.types.CallExpression | babel.types.NewExpression
  ): boolean {
    const callee = node.callee;
    if (!this.t.isMemberExpression(callee)) return false;

    return (
      this.t.isIdentifier(callee.object) &&
      (callee.object.name === "ReactDOM" ||
        callee.object.name === "ReactDOMClient") &&
      this.t.isIdentifier(callee.property) &&
      callee.property.name === "createRoot"
    );
  }
  //Check if the function is a TraceZone initialization or zone.js code
  public isTraceZoneInitialization(node: babel.types.Node): boolean {
    if (!this.t.isCallExpression(node)) return false;
    const callee = node.callee;
    if (!this.t.isMemberExpression(callee)) return false;
    //Check if the function is a Zone.current.fork() pattern
    if (
      this.t.isMemberExpression(callee.object) &&
      this.t.isIdentifier(callee.object.object) &&
      callee.object.object.name === "Zone" &&
      this.t.isIdentifier(callee.object.property) &&
      callee.object.property.name === "current" &&
      this.t.isIdentifier(callee.property) &&
      callee.property.name === "fork"
    ) {
      //Check if the function is a TRACE_ZONE initialization code
      const args = node.arguments[0];
      if (
        this.t.isObjectExpression(args) &&
        args.properties.some(
          (prop) =>
            this.t.isObjectProperty(prop) &&
            this.t.isIdentifier(prop.key) &&
            prop.key.name === "name" &&
            this.t.isStringLiteral(prop.value) &&
            prop.value.value === TRACE_ZONE
        )
      ) {
        return true;
      }
    }
    return false;
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

  //Check if the function is a chained function
  public isChainedFunction(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    const callee = path.node.callee;
    return (
      this.t.isMemberExpression(callee) &&
      this.t.isCallExpression(callee.object)
    );
  }

  //Check if the function is a pre-processed function
  public isDuplicateFunction(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    const callee = path.node.callee;
    return (
      this.t.isArrowFunctionExpression(callee) ||
      path.node.leadingComments?.some((comment) =>
        comment.value.includes(TRACE_MARKER)
      )
    );
  }

  //Check if the function is a JSX function
  public isJSX(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
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
