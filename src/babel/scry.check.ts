import * as babel from "@babel/core";
import { Environment } from "../utils/enviroment.js";
import Extractor from "../utils/extractor.js";
import { DEVELOPMENT_MODE, TRACE_MARKER, TRACE_ZONE } from "./scry.constant.js";

//Checkers for scry babel plugin
class ScryChecker {
  private t: typeof babel.types;
  constructor(t: typeof babel.types) {
    this.t = t;
  }

  //Check if the file is imported
  public isImported(
    path: babel.NodePath<babel.types.Program>,
    name: string,
    source: string
  ) {
    return path.node.body.some(
      (node) =>
        node.type === "ImportDeclaration" &&
        node.source.value === source &&
        node.specifiers.some(
          (spec) =>
            (spec.type === "ImportSpecifier" ||
              spec.type === "ImportDefaultSpecifier") &&
            spec.local.name === name
        )
    );
  }
  //Check if the file is a ESM file(Deprecated, because, babel plugin can't clearly detect ESM file)
  static isESM(state: babel.PluginPass): boolean {
    const sourceType = state.file?.opts.parserOpts?.sourceType;
    if (sourceType === "script") {
      //CJS
      return false;
    }
    if (sourceType === "module") {
      //ESM
      return true;
    }
    //OTHERWISE by resolve with package.json
    const filePath = state?.filename || "";
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

  //Check if the function is a Tracer method
  public isTracerMethod(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    const callee = path.node.callee;
    return (
      this.t.isMemberExpression(callee) &&
      this.t.isIdentifier(callee.object) &&
      callee.object.name === "Tracer" &&
      (this.t.isIdentifier(callee.property, { name: "start" }) ||
        this.t.isIdentifier(callee.property, { name: "end" }))
    );
  }

  public isExtractorMethod(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    const callee = path.node.callee;
    return (
      this.t.isMemberExpression(callee) &&
      this.t.isIdentifier(callee.object) &&
      callee.object.name === "Extractor" &&
      this.t.isIdentifier(callee.property, { name: "extractCode" })
    );
  }

  //Check if the function is a Zone.root[ACTIVE_TRACE_ID_SET] = new Set() initialization
  public isZoneRootActiveTraceSetInit(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    if (this.t.isNewExpression(path.node)) {
      const parent = path.parentPath;
      if (
        parent &&
        this.t.isAssignmentExpression(parent.node) &&
        parent.node.operator === "=" &&
        this.t.isMemberExpression(parent.node.left) &&
        this.t.isMemberExpression(parent.node.left.object) &&
        this.t.isIdentifier(parent.node.left.object.object, { name: "Zone" }) &&
        this.t.isIdentifier(parent.node.left.object.property, {
          name: "root",
        }) &&
        // this.t.isStringLiteral(parent.node.left.property, {
        //   value: ACTIVE_TRACE_ID_SET,
        // }) &&
        parent.node.left.computed
      ) {
        parent.skip();
        return true;
      }
    }
    return false;
  }

  //Check if the function is a default TraceZone initialization on top level of file
  //'DefaultTraceZone' works when TraceZone is not initialized in function scope
  public isDefaultTraceZoneInitialization(node: babel.types.Node): boolean {
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

  //Check if the file is in node_modules
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
    // const callee = path.node.callee;
    return (
      // this.t.isArrowFunctionExpression(callee) ||
      path.node.leadingComments?.some((comment) =>
        comment.value.includes(TRACE_MARKER)
      )
    );
  }

  //Check if the function is a nodejs process method
  public isNodejsProcessMethod(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    return (
      (this.t.isMemberExpression(path.node.callee) &&
        this.t.isIdentifier(path.node.callee.object) &&
        path.node.callee.object.name === "process" &&
        this.t.isIdentifier(path.node.callee.property) &&
        ["on", "emit"].includes(path.node.callee.property.name)) ||
      //Check if the function is a process function
      (this.t.isMemberExpression(path.node.callee) &&
        this.t.isIdentifier(path.node.callee.object) &&
        path.node.callee.object.name === "process")
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
