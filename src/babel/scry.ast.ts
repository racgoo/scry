import * as babel from "@babel/core";
import ScryChecker from "./scry.check.js";
import {
  ScryAstVariable,
  TRACE_MARKER,
  TRACE_EVENT_NAME,
  ANONYMOUS_FUNCTION_NAME,
  UNKNOWN_LOCATION,
  TRACE_ZONE,
  ACTIVE_TRACE_ID_SET,
  PARENT_TRACE_ID_MARKER,
  ORIGINAL_CODE_START_MARKER,
  ORIGINAL_CODE_END_MARKER,
} from "./scry.constant.js";
import { TraceEventType } from "../tracer/record/type.js";

//AST generators for scry babel plugin
class ScryAst {
  private t: typeof babel.types;
  constructor(t: typeof babel.types) {
    this.t = t;
  }

  public createPluginAppliedVariable() {
    return this.t.assignmentExpression(
      "=",
      this.t.memberExpression(
        this.t.identifier(ScryAstVariable.globalThis),
        this.t.identifier(ScryAstVariable.pluginApplied),
        false
      ),
      this.t.booleanLiteral(true)
    );
  }

  public createTraceContextOptionalUpdater() {
    return this.t.blockStatement([
      this.t.ifStatement(
        this.t.binaryExpression(
          "===",
          this.t.optionalMemberExpression(
            this.t.identifier(ScryAstVariable.traceContext),
            this.t.identifier(ScryAstVariable.traceBundleId),
            false,
            true // optional chaining
          ),
          this.t.nullLiteral()
        ),

        this.t.blockStatement([
          this.t.expressionStatement(
            this.t.assignmentExpression(
              "=",
              this.t.identifier(ScryAstVariable.traceContext),
              this.t.memberExpression(
                this.t.memberExpression(
                  this.t.memberExpression(
                    this.t.identifier("Zone"),
                    this.t.identifier("current")
                  ),
                  this.t.identifier(ScryAstVariable._properties)
                ),
                this.t.stringLiteral(ScryAstVariable.traceContext),
                true
              )
            )
          ),
        ])
      ),
      this.t.ifStatement(
        this.t.binaryExpression(
          "!==",
          this.t.memberExpression(
            this.t.memberExpression(
              this.t.memberExpression(
                this.t.memberExpression(
                  this.t.identifier("Zone"),
                  this.t.identifier("current")
                ),
                this.t.identifier(ScryAstVariable._properties)
              ),
              this.t.stringLiteral(ScryAstVariable.traceContext),
              true
            ),
            this.t.identifier(ScryAstVariable.traceBundleId)
          ),
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.traceContext),
            this.t.identifier(ScryAstVariable.traceBundleId)
          )
        ),
        this.t.blockStatement([
          this.t.expressionStatement(
            this.t.assignmentExpression(
              "=",
              this.t.memberExpression(
                this.t.identifier(ScryAstVariable.traceContext),
                this.t.identifier(ScryAstVariable.traceBundleId)
              ),
              this.t.memberExpression(
                this.t.memberExpression(
                  this.t.memberExpression(
                    this.t.memberExpression(
                      this.t.identifier("Zone"),
                      this.t.identifier("current")
                    ),
                    this.t.identifier(ScryAstVariable._properties)
                  ),
                  this.t.stringLiteral(ScryAstVariable.traceContext),
                  true
                ),
                this.t.identifier(ScryAstVariable.traceBundleId)
              )
            )
          ),
        ])
      ),
    ]);
  }

  public createParentTraceDeclare(
    path: babel.NodePath<
      | babel.types.Program
      | babel.types.FunctionDeclaration
      | babel.types.FunctionExpression
      | babel.types.ArrowFunctionExpression
      | babel.types.ObjectMethod
      | babel.types.ClassMethod
    >
  ) {
    const parentDecl = this.t.variableDeclaration("var", [
      this.t.variableDeclarator(
        this.t.identifier(ScryAstVariable.parentTraceId),
        this.t.stringLiteral(PARENT_TRACE_ID_MARKER)
      ),
    ]);

    if (path.isProgram()) {
      //For Program level(Top level global variable)
      (path.node.body as babel.types.Statement[]).unshift(parentDecl);
      return;
    } else {
      //For other level(Function, Class, etc.)
      const body = path.node.body as babel.types.BlockStatement;
      if (!this.t.isBlockStatement(body)) {
        path.node.body = this.t.blockStatement([this.t.returnStatement(body)]);
      }
      (path.node.body as babel.types.BlockStatement).body.unshift(parentDecl);
    }
  }

  //Create trace context declare(on Program level)
  public createTraceConextDeclare(
    path: babel.NodePath<
      | babel.types.Program
      | babel.types.FunctionDeclaration
      | babel.types.FunctionExpression
      | babel.types.ArrowFunctionExpression
      | babel.types.ObjectMethod
      | babel.types.ClassMethod
    >
  ) {
    const parentDecl = this.t.variableDeclaration("var", [
      this.t.variableDeclarator(
        this.t.identifier(ScryAstVariable.traceContext),
        this.t.objectExpression([
          this.t.objectProperty(
            this.t.identifier(ScryAstVariable.parentTraceId),
            this.t.nullLiteral()
          ),
          this.t.objectProperty(
            this.t.identifier(ScryAstVariable.traceBundleId),
            this.t.nullLiteral()
          ),
        ])
      ),
    ]);

    if (path.isProgram()) {
      //For Program level(Top level global variable)
      (path.node.body as babel.types.Statement[]).unshift(parentDecl);
      return;
    } else {
      //For other level(Function, Class, etc.)
      const body = path.node.body as babel.types.BlockStatement;
      if (!this.t.isBlockStatement(body)) {
        path.node.body = this.t.blockStatement([this.t.returnStatement(body)]);
      }
      (path.node.body as babel.types.BlockStatement).body.unshift(parentDecl);
    }
  }

  public createCodeExtractor(
    path: babel.NodePath<
      babel.types.CallExpression | babel.types.NewExpression
    >,
    chained: boolean
  ) {
    const callee = path.node.callee;

    if (this.t.isMemberExpression(callee)) {
      return this.t.variableDeclaration("const", [
        this.t.variableDeclarator(
          this.t.identifier("code"),
          this.t.callExpression(
            this.t.memberExpression(
              this.t.identifier("Extractor"),
              this.t.identifier("extractCode")
            ),
            [
              chained
                ? this.t.memberExpression(
                    this.t.memberExpression(
                      this.t.memberExpression(
                        this.t.identifier("Zone"),
                        this.t.identifier("current")
                      ),
                      this.t.identifier(ScryAstVariable._properties)
                    ),
                    this.t.identifier(ScryAstVariable.prevReturnValue)
                  )
                : callee.object,
              // this.t.stringLiteral(originCode),
              this.t.stringLiteral(
                this.t.isIdentifier(callee.property) ? callee.property.name : ""
              ),
              this.t.nullLiteral(),
            ]
          )
        ),
      ]);
    } else {
      // callee can be Identifier, CallExpression, ArrowFunctionExpression, etc.
      // We pass it as-is (any Expression evaluates to the function at runtime).
      // The previous cast to Identifier was incorrect for non-identifier callees
      // such as IIFEs or higher-order calls like getFunc()().
      return this.t.variableDeclaration("const", [
        this.t.variableDeclarator(
          this.t.identifier("code"),
          this.t.callExpression(
            this.t.memberExpression(
              this.t.identifier("Extractor"),
              this.t.identifier("extractCode")
            ),
            [
              this.t.nullLiteral(),
              this.t.nullLiteral(),
              callee as babel.types.Expression,
            ]
          )
        ),
      ]);
    }
  }

  public preProcess(
    path: babel.NodePath<
      | babel.types.FunctionDeclaration
      | babel.types.ClassDeclaration
      | babel.types.ClassMethod
      | babel.types.ObjectMethod
      | babel.types.ArrowFunctionExpression
    >,
    scryAst: ScryAst,
    scryChecker: ScryChecker,
    code: string
  ) {
    //Check development mode
    const developmentMode = ScryChecker.isDevelopmentMode();
    //Check if the function is a trace zone initialization
    const traceZoneInitialization =
      scryChecker.isDefaultTraceZoneInitialization(path.node);
    //All check is passed
    if (!developmentMode || traceZoneInitialization) {
      path.skip();
      return;
    }
    //Extract code from location
    scryAst.createOriginCodeString(path, code);
  }

  public createOriginCodeString(
    path: babel.NodePath<
      | babel.types.ArrowFunctionExpression
      | babel.types.FunctionDeclaration
      | babel.types.ClassDeclaration
      | babel.types.ClassMethod
      | babel.types.ObjectMethod
    >,
    code: string
  ) {
    const originalSource = code.slice(path.node.start!, path.node.end!);
    const commentNode = this.t.blockStatement([
      this.t.expressionStatement(
        this.t.stringLiteral(
          `${ORIGINAL_CODE_START_MARKER}${originalSource}${ORIGINAL_CODE_END_MARKER}`
        )
      ),
      this.t.emptyStatement(),
    ]);
    if (path.isClassDeclaration()) {
      path.node.body.body.unshift(this.t.staticBlock([commentNode]));
    } else if (path.isClassMethod()) {
      path.node.body.body.unshift(commentNode);
    } else if (path.isObjectMethod()) {
      path.node.body.body.unshift(commentNode);
    } else if (path.isFunctionDeclaration()) {
      path.node.body.body.unshift(commentNode);
    } else if (path.isArrowFunctionExpression()) {
      if (!this.t.isBlockStatement(path.node.body)) {
        path.node.body = this.t.blockStatement([
          this.t.returnStatement(path.node.body),
        ]);
      }
      path.node.body.body.unshift(commentNode);
    }
  }

  // Add Zone.root initialization code if not initialized(on Program level).
  // Uses Object.assign to MERGE into the existing _properties object rather than
  // replacing it entirely. A full assignment wipes any internal Zone.js fields
  // that were already stored there, breaking Zone.js runtime behaviour.
  public createZoneRootInitialization(
    path: babel.NodePath<babel.types.Program>
  ) {
    // Build the Object.assign(...) call and mark it so the CallExpression.exit
    // visitor (isDuplicateFunction check) skips re-instrumenting it.  Without
    // this guard the injected call gets wrapped in a tracing IIFE that fires at
    // module-load time, before Zone.root._properties.traceContext is populated,
    // producing "Cannot read properties of undefined (reading 'traceBundleId')".
    const assignCall = this.t.callExpression(
      this.t.memberExpression(
        this.t.identifier("Object"),
        this.t.identifier("assign")
      ),
      [
        this.t.logicalExpression(
          "??",
          this.t.memberExpression(
            this.t.memberExpression(
              this.t.identifier("Zone"),
              this.t.identifier("root")
            ),
            this.t.identifier(ScryAstVariable._properties)
          ),
          this.t.objectExpression([])
        ),
        this.t.objectExpression([
          this.t.objectProperty(
            this.t.identifier(ScryAstVariable.traceContext),
            this.t.identifier(ScryAstVariable.traceContext)
          ),
        ]),
      ]
    );
    this.t.addComment(assignCall, "leading", ` ${TRACE_MARKER} `);

    path.node.body.unshift(
      this.t.blockStatement([
        this.t.expressionStatement(
          this.t.assignmentExpression(
            "=",
            this.t.memberExpression(
              this.t.memberExpression(
                this.t.identifier("Zone"),
                this.t.identifier("root")
              ),
              this.t.identifier(ScryAstVariable._properties)
            ),
            assignCall
          )
        ),
      ])
    );
  }

  //Create initial trace zone(on Program level)
  public createInitailTraceZone(path: babel.NodePath<babel.types.Program>) {
    path.node.body.unshift(
      this.t.addComment(
        this.t.variableDeclaration("const", [
          this.t.variableDeclarator(
            this.t.identifier(TRACE_ZONE),
            this.t.callExpression(
              this.t.memberExpression(
                this.t.memberExpression(
                  this.t.identifier("Zone"),
                  this.t.identifier("current")
                ),
                this.t.identifier("fork")
              ),
              [
                this.t.objectExpression([
                  this.t.objectProperty(
                    this.t.identifier("name"),
                    this.t.stringLiteral(TRACE_ZONE)
                  ),
                  this.t.objectProperty(
                    this.t.identifier("properties"),
                    this.t.objectExpression([
                      this.t.objectProperty(
                        this.t.identifier(ScryAstVariable.parentTraceId),
                        this.t.nullLiteral()
                      ),
                    ])
                  ),
                ]),
              ]
            )
          ),
        ]),
        "leading",
        TRACE_MARKER
      )
    );
  }

  //Add Zone.js import or require statement(on Program level)
  // Always uses `@racgoo/scry/zone` (which bundles zone.js) so that zone.js is
  // never resolved as a bare specifier from the consumer project root.
  // In pnpm workspaces, bare `import "zone.js"` in a consumer file would fail
  // because zone.js is only a transitive dependency (not directly installed).
  // Bundling zone.js inside `@racgoo/scry/zone` eliminates that dependency entirely.
  public createZoneJSDeclaration(
    path: babel.NodePath<babel.types.Program>,
    esm: boolean
  ) {
    const scryChecker = new ScryChecker(this.t);

    if (esm) {
      // Replace any existing bare `import "zone.js"` with the scry-bundled version.
      // A bare zone.js import may have been injected by an older version of this
      // plugin that did not yet bundle zone.js, or added manually by the user.
      // Leaving it in place would cause "Failed to resolve import 'zone.js'" in
      // Vite/pnpm environments where zone.js is not a direct project dependency.
      for (let i = 0; i < path.node.body.length; i++) {
        const node = path.node.body[i];
        if (
          node.type === "ImportDeclaration" &&
          node.source.value === "zone.js" &&
          node.specifiers.length === 0
        ) {
          // Swap to @racgoo/scry/zone in-place to preserve original position.
          (node.source as babel.types.StringLiteral).value = "@racgoo/scry/zone";
          return;
        }
      }

      // Skip if already using the bundled path.
      if (
        scryChecker.isImportedWithoutVariableDeclaration(
          path,
          "@racgoo/scry/zone",
          esm
        )
      ) {
        return;
      }

      path.node.body.unshift(
        this.t.importDeclaration([], this.t.stringLiteral("@racgoo/scry/zone"))
      );
    } else {
      // CJS: replace require("zone.js") calls and inject require("@racgoo/scry/zone")
      let replaced = false;
      for (let i = 0; i < path.node.body.length; i++) {
        const node = path.node.body[i];
        if (
          node.type === "ExpressionStatement" &&
          node.expression.type === "CallExpression" &&
          this.t.isIdentifier(
            (node.expression as babel.types.CallExpression).callee,
            { name: "require" }
          ) &&
          (node.expression as babel.types.CallExpression).arguments.length ===
            1 &&
          this.t.isStringLiteral(
            (node.expression as babel.types.CallExpression).arguments[0],
            { value: "zone.js" }
          )
        ) {
          (
            (node.expression as babel.types.CallExpression)
              .arguments[0] as babel.types.StringLiteral
          ).value = "@racgoo/scry/zone";
          replaced = true;
          break;
        }
      }

      if (!replaced) {
        if (
          scryChecker.isImportedWithoutVariableDeclaration(
            path,
            "@racgoo/scry/zone",
            esm
          )
        ) {
          return;
        }
        path.node.body.unshift(
          this.t.expressionStatement(
            this.t.callExpression(this.t.identifier("require"), [
              this.t.stringLiteral("@racgoo/scry/zone"),
            ])
          )
        );
      }
    }
  }

  //Add Extractor import or require statement from @racgoo/scry(on Program level)
  public createTracerDeclaration(
    path: babel.NodePath<babel.types.Program>,
    esm: boolean
  ) {
    const scryChecker = new ScryChecker(this.t);
    const tracerImported = scryChecker.isImported(
      path,
      "Tracer",
      "@racgoo/scry",
      esm
    );
    if (tracerImported) {
      return;
    }
    if (esm) {
      path.node.body.unshift(
        this.t.importDeclaration(
          [
            this.t.importSpecifier(
              this.t.identifier("Tracer"),
              this.t.identifier("Tracer")
            ),
          ],
          this.t.stringLiteral("@racgoo/scry")
        )
      );
    } else {
      //For commonjs target
      path.node.body.unshift(
        this.t.variableDeclaration("const", [
          this.t.variableDeclarator(
            this.t.objectPattern([
              this.t.objectProperty(
                this.t.identifier("Tracer"),
                this.t.identifier("Tracer"),
                false,
                true
              ),
            ]),
            this.t.callExpression(this.t.identifier("require"), [
              this.t.stringLiteral("@racgoo/scry"),
            ])
          ),
        ])
      );
    }
  }

  //Add Extractor import or require statement from @racgoo/scry(on Program level)
  public createExtractorDeclaration(
    path: babel.NodePath<babel.types.Program>,
    esm: boolean
  ) {
    const scryChecker = new ScryChecker(this.t);
    const extractorImported = scryChecker.isImported(
      path,
      "Extractor",
      "@racgoo/scry",
      esm
    );
    if (extractorImported) {
      return;
    }
    if (esm) {
      //For esm target
      path.node.body.unshift(
        this.t.importDeclaration(
          [
            this.t.importSpecifier(
              this.t.identifier("Extractor"),
              this.t.identifier("Extractor")
            ),
          ],
          this.t.stringLiteral("@racgoo/scry")
        )
      );
    } else {
      //For commonjs target
      path.node.body.unshift(
        this.t.variableDeclaration("const", [
          this.t.variableDeclarator(
            this.t.objectPattern([
              this.t.objectProperty(
                this.t.identifier("Extractor"),
                this.t.identifier("Extractor"),
                false,
                true
              ),
            ]),
            this.t.callExpression(this.t.identifier("require"), [
              this.t.stringLiteral("@racgoo/scry"),
            ])
          ),
        ])
      );
    }
  }

  //For debug(only dev)
  public createConsoleLog(identifier: string, flag: string) {
    return this.t.expressionStatement(
      this.t.callExpression(
        this.t.memberExpression(
          this.t.identifier("console"),
          this.t.identifier("log")
        ),
        [this.t.stringLiteral(flag), this.t.identifier(identifier)]
      )
    );
  }

  //Add trace id to active trace id set(Zone root)
  public createActiveTraceIdAdder() {
    return this.t.expressionStatement(
      this.t.callExpression(
        this.t.memberExpression(
          this.t.memberExpression(
            this.t.memberExpression(
              this.t.identifier("Zone"),
              this.t.identifier("root")
            ),
            this.t.identifier(ACTIVE_TRACE_ID_SET)
          ),
          this.t.identifier("add")
        ),
        [this.t.identifier(ScryAstVariable.traceId)]
      )
    );
  }

  //Add trace id to active trace id set(Zone root)
  public createActiveTraceIdRemover() {
    return this.t.expressionStatement(
      this.t.callExpression(
        this.t.memberExpression(
          this.t.memberExpression(
            this.t.memberExpression(
              this.t.identifier("Zone"),
              this.t.identifier("root")
            ),
            this.t.identifier(ACTIVE_TRACE_ID_SET)
          ),
          this.t.identifier("delete")
        ),
        [this.t.identifier(ScryAstVariable.traceId)]
      )
    );
  }

  /**
   * Creates a guard that short-circuits tracing when Zone nesting exceeds maxDepth.
   * The depth is stored as `_depth` in each scry-created Zone's _properties so we can
   * read it in O(1). Without this, deeply recursive functions create one Zone per call,
   * causing unbounded memory growth. When the limit is exceeded the original call is still
   * executed – only the tracing overhead is skipped.
   *
   * Generated code:
   *   if ((Zone.current._properties?._depth ?? 0) >= maxDepth) return <originalNode>;
   */
  // Zone.js stores fork properties at zone._properties, not as direct own
  // properties on the zone object. The previous code read Zone.current["_depth"]
  // which always returned undefined (the zone object has no "_depth" property),
  // making maxDepth effectively never trigger.
  public createMaxDepthGuard(
    maxDepth: number,
    originalNode: babel.types.CallExpression | babel.types.NewExpression
  ) {
    return this.t.ifStatement(
      this.t.binaryExpression(
        ">=",
        this.t.logicalExpression(
          "??",
          // Zone.current._properties?.["_depth"]
          this.t.optionalMemberExpression(
            this.t.memberExpression(
              this.t.memberExpression(
                this.t.identifier("Zone"),
                this.t.identifier("current")
              ),
              this.t.identifier(ScryAstVariable._properties)
            ),
            this.t.stringLiteral("_depth"),
            true,
            true
          ),
          this.t.numericLiteral(0)
        ) as babel.types.Expression,
        this.t.numericLiteral(maxDepth)
      ),
      this.t.blockStatement([this.t.returnStatement(originalNode)])
    );
  }

  //Create ast marker variable
  public createMarkerVariable() {
    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier(TRACE_MARKER),
        this.t.booleanLiteral(true)
      ),
    ]);
  }

  //Create ast traceId variable with auto increment
  public createTraceId() {
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
            this.t.numericLiteral(1)
          ),
          this.t.updateExpression(
            "++",
            this.t.memberExpression(
              this.t.identifier(ScryAstVariable.globalThis),
              this.t.identifier(ScryAstVariable.globalScryCalledCount)
            ),
            true //Need prefix. assinging with updating
          )
        )
      ),
    ]);
  }

  public createDeclareTraceZoneWithTraceId() {
    return this.t.variableDeclaration("const", [
      this.t.variableDeclarator(
        this.t.identifier(TRACE_ZONE),
        this.t.memberExpression(
          this.t.identifier("Zone"),
          this.t.identifier(ScryAstVariable.traceId),
          true
        )
      ),
    ]);
  }

  //Create new zone context with trace id(with zone.js scope)
  public createNewZoneContextWithTraceId() {
    return this.t.expressionStatement(
      this.t.assignmentExpression(
        "=",
        this.t.memberExpression(
          this.t.identifier("Zone"),
          this.t.identifier(ScryAstVariable.traceId),
          true
        ),
        this.t.callExpression(
          this.t.memberExpression(
            this.t.logicalExpression(
              "||",
              this.t.memberExpression(
                this.t.identifier("Zone"),
                this.t.memberExpression(
                  this.t.identifier(ScryAstVariable.traceContext),
                  this.t.identifier(ScryAstVariable.parentTraceId)
                ),
                true
              ),
              this.t.memberExpression(
                this.t.identifier("Zone"),
                this.t.identifier("root")
              )
            ),
            this.t.identifier("fork")
          ),
          [
            this.t.objectExpression([
              this.t.objectProperty(
                this.t.identifier("name"),
                this.t.identifier(ScryAstVariable.traceId)
              ),
              this.t.objectProperty(
                this.t.identifier("properties"),
                this.t.objectExpression([
                  this.t.objectProperty(
                    this.t.identifier(ScryAstVariable.traceContext),
                    this.t.objectExpression([
                      this.t.spreadElement(
                        this.t.identifier(ScryAstVariable.traceContext)
                      ),
                      this.t.objectProperty(
                        this.t.identifier(ScryAstVariable.parentTraceId),
                        this.t.identifier(ScryAstVariable.traceId)
                      ),
                    ])
                  ),
                  //Track Zone nesting depth so the maxDepth guard can do an O(1) check.
                  //Inherits parent depth via Zone.current._properties?.["_depth"] ?? 0 and adds 1.
                  //Must read from _properties (not Zone.current directly) because Zone.js
                  //stores fork properties at zone._properties, not as own zone properties.
                  this.t.objectProperty(
                    this.t.identifier("_depth"),
                    this.t.binaryExpression(
                      "+",
                      this.t.logicalExpression(
                        "??",
                        // Zone.current._properties?.["_depth"]
                        this.t.optionalMemberExpression(
                          this.t.memberExpression(
                            this.t.memberExpression(
                              this.t.identifier("Zone"),
                              this.t.identifier("current")
                            ),
                            this.t.identifier(ScryAstVariable._properties)
                          ),
                          this.t.stringLiteral("_depth"),
                          true,
                          true
                        ),
                        this.t.numericLiteral(0)
                      ) as babel.types.Expression,
                      this.t.numericLiteral(1)
                    )
                  ),
                ])
              ),
            ]),
          ]
        )
      )
    );
  }

  //Create ast returnValue(Just binding returnValue variable)
  public createReturnValueDeclaration() {
    return this.t.variableDeclaration("let", [
      this.t.variableDeclarator(
        this.t.identifier(ScryAstVariable.returnValue),
        this.t.nullLiteral()
      ),
    ]);
  }

  //Update returnValue with origin execution(with zone.js new forked scope)
  //This manage Zone.root[ACTIVE_TRACE_ID_SET] = new Set() and delete traceId
  //but, logic is very complex and large. it need to be refactoring
  //and, it contain, "enter" and "done" event. it need to be refactoring
  public craeteOriginCallExecutor(
    path: babel.NodePath<
      babel.types.CallExpression | babel.types.NewExpression
    >,
    state: babel.PluginPass,
    chained: boolean
  ) {
    const newExpression = path.isNewExpression && path.isNewExpression();
    const processedCall = newExpression
      ? this.t.newExpression(path.node.callee, [
          this.t.spreadElement(
            this.t.identifier(ScryAstVariable.processedArgs)
          ),
        ])
      : this.t.callExpression(path.node.callee, [
          this.t.spreadElement(
            this.t.identifier(ScryAstVariable.processedArgs)
          ),
        ]);

    const parameterNeedsSpread = path.node.arguments.length !== 0;

    let resultAst: babel.types.ExpressionStatement = this.t.expressionStatement(
      this.t.nullLiteral()
    );
    try {
      //Create ast returnValue with origin execution
      resultAst = this.t.expressionStatement(
        this.t.assignmentExpression(
          "=",
          this.t.identifier(ScryAstVariable.returnValue),
          this.t.callExpression(
            this.t.memberExpression(
              this.t.identifier(TRACE_ZONE),
              this.t.identifier("run")
            ),
            [
              this.t.arrowFunctionExpression(
                [],

                this.t.blockStatement([
                  this.t.variableDeclaration("const", [
                    this.t.variableDeclarator(
                      this.t.identifier(ScryAstVariable.processedArgs),
                      this.t.arrayExpression(
                        (path.node.arguments || []).filter(
                          (
                            arg
                          ): arg is
                            | babel.types.Expression
                            | babel.types.SpreadElement =>
                            arg && arg.type !== "ArgumentPlaceholder"
                        )
                      )
                    ),
                  ]),
                  //Generate 'enter' event
                  this.t.expressionStatement(
                    this.emitTraceEvent(
                      this.getEventDetail(path, state, {
                        type: "enter",
                        fnName: this.getFunctionName(path),
                        chained,
                      })
                    )
                  ),
                  this.t.variableDeclaration("const", [
                    this.t.variableDeclarator(
                      this.t.identifier(
                        ScryAstVariable.originalCallReturnValue
                      ),
                      parameterNeedsSpread ? processedCall : path.node
                    ),
                  ]),
                  this.t.ifStatement(
                    this.t.logicalExpression(
                      "&&",
                      this.t.identifier(
                        ScryAstVariable.originalCallReturnValue
                      ),
                      this.t.memberExpression(
                        this.t.identifier(
                          ScryAstVariable.originalCallReturnValue
                        ),
                        this.t.identifier("then")
                      )
                    ),
                    this.t.blockStatement([
                      this.t.expressionStatement(
                        this.t.callExpression(
                          this.t.memberExpression(
                            this.t.identifier(
                              ScryAstVariable.originalCallReturnValue
                            ),
                            this.t.identifier("then")
                          ),
                          // Pass both onFulfilled and onRejected so that a rejected
                          // Promise still emits the done event and cleans up
                          // activeTraceIdSet. Without onRejected, rejected Promises
                          // would leave the traceId in activeTraceIdSet indefinitely
                          // (until the waitAllContextDone timeout fires).
                          [
                            // onFulfilled: capture resolved value, emit exit then done
                            this.t.arrowFunctionExpression(
                              [this.t.identifier("value")],
                              this.t.blockStatement([
                                this.t.expressionStatement(
                                  this.t.assignmentExpression(
                                    "=",
                                    this.t.identifier(
                                      ScryAstVariable.returnValue
                                    ),
                                    this.t.identifier("value")
                                  )
                                ),
                                this.t.variableDeclaration("let", [
                                  this.t.variableDeclarator(
                                    this.t.identifier(
                                      ScryAstVariable.traceContext
                                    ),
                                    this.t.memberExpression(
                                      this.t.memberExpression(
                                        this.t.memberExpression(
                                          this.t.identifier("Zone"),
                                          this.t.identifier("current")
                                        ),
                                        this.t.identifier(
                                          ScryAstVariable._properties
                                        )
                                      ),
                                      this.t.stringLiteral(
                                        ScryAstVariable.traceContext
                                      ),
                                      true
                                    )
                                  ),
                                ]),
                                this.t.expressionStatement(
                                  this.emitTraceEvent(
                                    this.getEventDetail(path, state, {
                                      type: "exit",
                                      fnName: this.getFunctionName(path),
                                      chained: false,
                                    })
                                  )
                                ),
                                this.t.expressionStatement(
                                  this.emitTraceEvent(
                                    this.getEventDetail(path, state, {
                                      type: "done",
                                      fnName: this.getFunctionName(path),
                                      chained: false,
                                    })
                                  )
                                ),
                              ])
                            ),
                            // onRejected: capture rejection reason, emit exit then done
                            this.t.arrowFunctionExpression(
                              [this.t.identifier("reason")],
                              this.t.blockStatement([
                                this.t.expressionStatement(
                                  this.t.assignmentExpression(
                                    "=",
                                    this.t.identifier(
                                      ScryAstVariable.returnValue
                                    ),
                                    this.t.identifier("reason")
                                  )
                                ),
                                this.t.variableDeclaration("let", [
                                  this.t.variableDeclarator(
                                    this.t.identifier(
                                      ScryAstVariable.traceContext
                                    ),
                                    this.t.memberExpression(
                                      this.t.memberExpression(
                                        this.t.memberExpression(
                                          this.t.identifier("Zone"),
                                          this.t.identifier("current")
                                        ),
                                        this.t.identifier(
                                          ScryAstVariable._properties
                                        )
                                      ),
                                      this.t.stringLiteral(
                                        ScryAstVariable.traceContext
                                      ),
                                      true
                                    )
                                  ),
                                ]),
                                this.t.expressionStatement(
                                  this.emitTraceEvent(
                                    this.getEventDetail(path, state, {
                                      type: "exit",
                                      fnName: this.getFunctionName(path),
                                      chained: false,
                                    })
                                  )
                                ),
                                this.t.expressionStatement(
                                  this.emitTraceEvent(
                                    this.getEventDetail(path, state, {
                                      type: "done",
                                      fnName: this.getFunctionName(path),
                                      chained: false,
                                    })
                                  )
                                ),
                              ])
                            ),
                          ]
                        )
                      ),
                    ]),
                    this.t.blockStatement([
                      this.t.variableDeclaration("let", [
                        this.t.variableDeclarator(
                          this.t.identifier(ScryAstVariable.traceContext),
                          this.t.memberExpression(
                            this.t.memberExpression(
                              this.t.memberExpression(
                                this.t.identifier("Zone"),
                                this.t.identifier("current")
                              ),
                              this.t.identifier(ScryAstVariable._properties)
                            ),
                            this.t.stringLiteral(ScryAstVariable.traceContext),
                            true
                          )
                        ),
                      ]),
                      this.t.expressionStatement(
                        this.emitTraceEvent(
                          this.getEventDetail(path, state, {
                            type: "done",
                            fnName: this.getFunctionName(path),
                            chained: false,
                          })
                        )
                      ),
                    ])
                  ),
                  this.t.returnStatement(
                    this.t.identifier(ScryAstVariable.originalCallReturnValue)
                  ),
                ])
              ),
            ]
          )
        )
      );
    } catch (error) {
      console.error("craeteOriginCallExecutor error:", error);
    }
    //Create try block
    const tryBlock = this.t.blockStatement([resultAst]);
    // Catch clause: on synchronous throw the Zone.run callback propagates the
    // error here. Without explicit exit/done emissions, activeTraceIdSet keeps
    // the traceId until the timeout fires and the trace tree shows an incomplete
    // node with no returnValue. We emit both events before rethrowing so the
    // tracing infrastructure always sees a matched enter→exit→done sequence.
    const fnName = this.getFunctionName(path);
    const catchClause = this.t.catchClause(
      this.t.identifier("error"),
      this.t.blockStatement([
        this.t.expressionStatement(
          this.t.assignmentExpression(
            "=",
            this.t.identifier(ScryAstVariable.returnValue),
            this.t.identifier("error")
          )
        ),
        // Re-capture traceContext from the current (parent) Zone so that
        // traceBundleId / parentTraceId are available for the events below.
        this.t.variableDeclaration("let", [
          this.t.variableDeclarator(
            this.t.identifier(ScryAstVariable.traceContext),
            this.t.memberExpression(
              this.t.memberExpression(
                this.t.memberExpression(
                  this.t.identifier("Zone"),
                  this.t.identifier("current")
                ),
                this.t.identifier(ScryAstVariable._properties)
              ),
              this.t.stringLiteral(ScryAstVariable.traceContext),
              true
            )
          ),
        ]),
        // emit exit so the trace node records the error as its returnValue
        this.t.expressionStatement(
          this.emitTraceEvent(
            this.getEventDetail(path, state, {
              type: "exit",
              fnName,
              chained: false,
            })
          )
        ),
        // emit done so activeTraceIdSet is cleaned up without waiting for timeout
        this.t.expressionStatement(
          this.emitTraceEvent(
            this.getEventDetail(path, state, {
              type: "done",
              fnName,
              chained: false,
            })
          )
        ),
        // Clean up Zone entry on error path to prevent memory leak
        this.t.expressionStatement(
          this.t.unaryExpression(
            "delete",
            this.t.memberExpression(
              this.t.identifier("Zone"),
              this.t.identifier(ScryAstVariable.traceId),
              true
            )
          )
        ),
        this.t.throwStatement(this.t.identifier("error")),
      ])
    );
    //Create finally clause: always clean up the Zone entry after successful execution
    const finallyBlock = this.t.blockStatement([
      this.t.expressionStatement(
        this.t.unaryExpression(
          "delete",
          this.t.memberExpression(
            this.t.identifier("Zone"),
            this.t.identifier(ScryAstVariable.traceId),
            true
          )
        )
      ),
    ]);
    return this.t.tryStatement(tryBlock, catchClause, finallyBlock);
  }

  //Create emit trace event ast object
  public emitTraceEvent(detail: babel.types.ObjectExpression) {
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
        [
          this.t.stringLiteral(TRACE_EVENT_NAME),
          this.t.objectExpression([
            this.t.objectProperty(this.t.identifier("detail"), detail),
          ]),
        ]
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
  public getEventDetail(
    path: babel.NodePath<
      babel.types.CallExpression | babel.types.NewExpression
    >,
    state: babel.PluginPass,
    info: {
      type: TraceEventType;
      fnName: string;
      chained: boolean;
    }
  ) {
    if (info.type === "enter") {
      return this.t.objectExpression([
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.traceBundleId),
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.traceContext),
            this.t.identifier(ScryAstVariable.traceBundleId)
          )
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.type),
          this.t.stringLiteral(info.type)
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.name),
          this.t.stringLiteral(info.fnName)
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.classCode),
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.code),
            this.t.identifier(ScryAstVariable.classCode)
          )
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.methodCode),
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.code),
            this.t.identifier(ScryAstVariable.methodCode)
          )
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.functionCode),
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.code),
            this.t.identifier(ScryAstVariable.functionCode)
          )
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
          this.t.nullLiteral()
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.chained),
          this.t.booleanLiteral(info.chained)
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.parentTraceId),
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.traceContext),
            this.t.identifier(ScryAstVariable.parentTraceId)
          )
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.args),
          this.t.identifier(ScryAstVariable.processedArgs)
        ),
      ]);
    } else if (info.type === "exit") {
      return this.t.objectExpression([
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.traceBundleId),
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.traceContext),
            this.t.identifier(ScryAstVariable.traceBundleId)
          )
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.type),
          this.t.stringLiteral(info.type)
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.name),
          this.t.stringLiteral(info.fnName)
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.classCode),
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.code),
            this.t.identifier(ScryAstVariable.classCode)
          )
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.methodCode),
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.code),
            this.t.identifier(ScryAstVariable.methodCode)
          )
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.functionCode),
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.code),
            this.t.identifier(ScryAstVariable.functionCode)
          )
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
          this.t.identifier(ScryAstVariable.returnValue)
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.chained),
          this.t.booleanLiteral(info.chained)
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.parentTraceId),
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.traceContext),
            this.t.identifier(ScryAstVariable.parentTraceId)
          )
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.args),
          this.t.arrayExpression([])
          // this.getArgs(path, state)
        ),
      ]);
    } else {
      //done event
      return this.t.objectExpression([
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.traceBundleId),
          this.t.memberExpression(
            this.t.identifier(ScryAstVariable.traceContext),
            this.t.identifier(ScryAstVariable.traceBundleId)
          )
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.type),
          this.t.stringLiteral(info.type)
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.name),
          this.t.stringLiteral(info.fnName)
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.classCode),
          this.t.stringLiteral("")
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.methodCode),
          this.t.stringLiteral("")
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.functionCode),
          this.t.stringLiteral("")
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.traceId),
          this.t.identifier(ScryAstVariable.traceId)
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.source),
          this.t.stringLiteral("")
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.returnValue),
          this.t.nullLiteral()
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.chained),
          this.t.booleanLiteral(false)
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.parentTraceId),
          this.t.stringLiteral("")
        ),
        this.t.objectProperty(
          this.t.identifier(ScryAstVariable.args),
          this.t.arrayExpression([])
        ),
      ]);
    }
  }

  //Get function name as string
  public getFunctionName(
    path: babel.NodePath<babel.types.CallExpression | babel.types.NewExpression>
  ) {
    const callee = path.node.callee;
    let fnName = ANONYMOUS_FUNCTION_NAME;
    if (this.t.isIdentifier(callee)) {
      // new Foo() → "new Foo", plain call foo() → "foo"
      fnName = path.isNewExpression() ? `new ${callee.name}` : callee.name;
    } else if (
      this.t.isMemberExpression(callee) &&
      this.t.isIdentifier(callee.property)
    ) {
      if (path.isNewExpression()) {
        fnName = `new ${callee.property.name}`;
      } else {
        fnName = callee.property.name;
      }
    }
    return fnName;
  }

  //Create args ast object
  private getArgs(
    path: babel.NodePath<
      babel.types.CallExpression | babel.types.NewExpression
    >,
    state: babel.PluginPass
  ) {
    return this.t.arrayExpression(
      path.node.arguments.map((arg) => {
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
        //String literal
        else if (this.t.isStringLiteral(arg)) {
          return this.t.stringLiteral(arg.value);
        }
        //Numeric literal
        else if (this.t.isNumericLiteral(arg)) {
          return this.t.numericLiteral(Number(arg.value));
        }
        //Identifier (variable)
        else if (this.t.isIdentifier(arg)) {
          return this.t.identifier(arg.name);
        }
        //Object expression
        else if (this.t.isObjectExpression(arg)) {
          return arg;
        }
        //Other types
        else {
          return this.t.stringLiteral(`[${arg.type}]`);
        }
      })
    );
  }

  //Create source ast object
  private getSource(
    path: babel.NodePath<
      babel.types.CallExpression | babel.types.NewExpression
    >,
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
