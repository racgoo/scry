import * as babel from "@babel/core";
import {
  TRACE_MARKER,
  ScryAstVariable,
  TRACE_EVENT_NAME,
  ANONYMOUS_FUNCTION_NAME,
  UNKNOWN_LOCATION,
} from "@babel/scry.constant";

//AST generators for scry babel plugin
class ScryAst {
  private static t = babel.types;

  //Create ast marker variable
  public static createMarkerVariable() {
    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier(TRACE_MARKER),
        this.t.booleanLiteral(true)
      ),
    ]);
  }

  //Create ast traceId variable with auto increment
  public static createTraceId() {
    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier(ScryAstVariable.traceId),
        this.t.conditionalExpression(
          this.t.binaryExpression(
            "===",
            this.t.unaryExpression(
              "typeof",
              this.t.memberExpression(
                this.t.identifier(ScryAstVariable.globalThis),
                this.t.identifier(ScryAstVariable.globalScryCalledCount)
              )
            ),
            this.t.stringLiteral("undefined")
          ),
          this.t.assignmentExpression(
            "=",
            this.t.memberExpression(
              this.t.identifier(ScryAstVariable.globalThis),
              this.t.identifier(ScryAstVariable.globalScryCalledCount)
            ),
            this.t.numericLiteral(0)
          ),
          this.t.updateExpression(
            "++",
            this.t.memberExpression(
              this.t.identifier(ScryAstVariable.globalThis),
              this.t.identifier(ScryAstVariable.globalScryCalledCount)
            ),
            false
          )
        )
      ),
    ]);
  }

  //Set ast currentTraceId to globalThis
  static setCurrentTraceIdAsGlobalCurrentTraceId() {
    return this.t.expressionStatement(
      this.t.assignmentExpression(
        "=",
        this.t.memberExpression(
          this.t.identifier(ScryAstVariable.globalThis),
          this.t.identifier(ScryAstVariable.globalCurrentTraceId)
        ),
        this.t.identifier(ScryAstVariable.traceId)
      )
    );
  }

  //Set ast currentTraceId to globalThis
  static setCurrentTraceIdAsGlobalParentTraceId() {
    return this.t.expressionStatement(
      this.t.assignmentExpression(
        "=",
        this.t.memberExpression(
          this.t.identifier(ScryAstVariable.globalThis),
          this.t.identifier(ScryAstVariable.globalCurrentTraceId)
        ),
        this.t.identifier(ScryAstVariable.traceId)
      )
    );
  }

  //Set ast parentTraceId to globalThis
  static setParentTraceIdAsGlobalParentTraceId() {
    return this.t.expressionStatement(
      this.t.assignmentExpression(
        "=",
        this.t.memberExpression(
          this.t.identifier(ScryAstVariable.globalThis),
          this.t.identifier(ScryAstVariable.globalParentTraceId)
        ),
        this.t.identifier("parentTraceId")
      )
    );
  }

  //Get ast parentTraceId variable from globalThis
  static getParentTraceId() {
    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier("parentTraceId"),
        this.t.logicalExpression(
          "??",
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.globalThis),
            this.t.identifier(ScryAstVariable.globalParentTraceId)
          ),
          this.t.nullLiteral()
        )
      ),
    ]);
  }

  //Create ast returnValue with origin execution
  static createReturnValueWithOriginExecution(
    path: babel.NodePath<babel.types.CallExpression>
  ) {
    const callee = path.node.callee;
    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier(ScryAstVariable.returnValue),
        this.t.callExpression(callee, path.node.arguments)
      ),
    ]);
  }

  //Create emit trace event ast object
  static createEmitTraceEvent(detail: babel.types.ObjectExpression) {
    return this.t.conditionalExpression(
      this.t.binaryExpression(
        "===",
        this.t.unaryExpression("typeof", this.t.identifier("window")),
        this.t.stringLiteral("undefined")
      ),
      // Node.js
      this.t.callExpression(
        this.t.memberExpression(
          this.t.identifier("process"),
          this.t.identifier("emit")
        ),
        [this.t.stringLiteral(TRACE_EVENT_NAME), detail]
      ),
      // Browser
      this.t.callExpression(
        this.t.memberExpression(
          this.t.identifier(ScryAstVariable.globalThis),
          this.t.identifier("dispatchEvent")
        ),
        [
          this.t.newExpression(this.t.identifier("CustomEvent"), [
            this.t.stringLiteral(TRACE_EVENT_NAME),
            this.t.objectExpression([
              this.t.objectProperty(this.t.identifier("detail"), detail),
            ]),
          ]),
        ]
      )
    );
  }

  //Create event detail ast object
  static getEventDetail(
    path: babel.NodePath<babel.types.CallExpression>,
    state: babel.PluginPass,
    info: {
      type: TraceEventType;
      fnName: string;
      chained: boolean;
    }
  ) {
    return this.t.objectExpression([
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.type),
        this.t.stringLiteral(info.type)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.name),
        this.t.stringLiteral(info.fnName)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.traceId),
        this.t.identifier(ScryAstVariable.traceId)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.source),
        this.getSource(path, state)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.returnValue),
        info.type === "enter"
          ? this.t.nullLiteral()
          : this.t.identifier(ScryAstVariable.returnValue)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.chained),
        this.t.booleanLiteral(info.chained)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.parentTraceId),
        this.t.identifier(ScryAstVariable.parentTraceId)
      ),
      this.t.objectProperty(
        this.t.identifier(ScryAstVariable.args),
        this.getArgs(path, state)
      ),
    ]);
  }

  //Get function name as string
  static getFunctionName(path: babel.NodePath<babel.types.CallExpression>) {
    const callee = path.node.callee;
    let fnName = ANONYMOUS_FUNCTION_NAME;
    if (this.t.isIdentifier(callee)) {
      fnName = callee.name;
    } else if (
      this.t.isMemberExpression(callee) &&
      this.t.isIdentifier(callee.property)
    ) {
      fnName = callee.property.name;
    }
    return fnName;
  }

  //Create args ast object
  static getArgs(
    path: babel.NodePath<babel.types.CallExpression>,
    state: babel.PluginPass
  ) {
    return this.t.arrayExpression(
      path.node.arguments.map((arg) => {
        //  execute by call expression
        //  function
        if (
          this.t.isArrowFunctionExpression(arg) ||
          this.t.isFunctionExpression(arg)
        ) {
          const location = arg.loc
            ? `${arg.loc.start.line}:${arg.loc.start.column}`
            : UNKNOWN_LOCATION;

          const name =
            this.t.isFunctionExpression(arg) && arg.id
              ? arg.id.name
              : ANONYMOUS_FUNCTION_NAME;

          const params = arg.params ? `(${arg.params.length} params)` : "";

          const filePath =
            state?.filename?.split("/").slice(-2).join("/") || "";

          return this.t.stringLiteral(
            `[Function: ${name}${params} at ${filePath}:${location}]`
          );
        }
        // string literal
        else if (this.t.isStringLiteral(arg)) {
          return this.t.stringLiteral(arg.value);
        }
        // numeric literal
        else if (this.t.isNumericLiteral(arg)) {
          return this.t.numericLiteral(Number(arg.value));
        }
        // identifier (variable)
        else if (this.t.isIdentifier(arg)) {
          return this.t.identifier(arg.name);
        }
        // object expression
        else if (this.t.isObjectExpression(arg)) {
          return arg;
        }
        // other types
        else {
          return this.t.stringLiteral(`[${arg.type}]`);
        }
      })
    );
  }

  //Create source ast object
  static getSource(
    path: babel.NodePath<babel.types.CallExpression>,
    state: babel.PluginPass
  ) {
    return this.t.stringLiteral(
      `${state?.filename || ""}:${
        path.node.loc
          ? `${path.node.loc.start.line}:${path.node.loc.start.column}`
          : UNKNOWN_LOCATION
      }`
    );
  }
}

export default ScryAst;
