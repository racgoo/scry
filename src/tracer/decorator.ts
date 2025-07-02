import { ScryAstVariable } from "../babel/scry.constant.js";
import { Output } from "../utils/output.js";
import Tracer from "./tracer.js";

//Decorator for method to check if plugin is applied
function checkPlugin(
  target: Tracer,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: unknown[]) {
    checkPluginApplied();
    //for this binding for original instance
    return originalMethod.apply(this, args);
  };
}

//Handle plugin applied check
function checkPluginApplied() {
  const applied = isPluginApplied();
  if (!applied) {
    Output.printError(
      "Scry Plugin not applied\nPlease check if the plugin is applied"
    );
    throw new Error("Scry Plugin not applied");
  }
}

//Check if plugin is applied
function isPluginApplied() {
  return !!(
    globalThis as unknown as { [ScryAstVariable.pluginApplied]: boolean }
  )[ScryAstVariable.pluginApplied];
}

export { checkPlugin };
