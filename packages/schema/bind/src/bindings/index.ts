import { OutputDirectory, TargetLanguage } from "../";
import * as WasmAs from "./wasm-as";
import * as PluginTs from "./plugin-ts";

import { TypeInfo } from "@web3api/schema-parse";

export function generateBinding(
  language: TargetLanguage,
  typeInfo: TypeInfo,
  schema: string
): OutputDirectory {
  switch (language) {
    case "wasm-as":
      return WasmAs.generateBinding(typeInfo);
    case "plugin-ts":
      return PluginTs.generateBinding(typeInfo, schema);
    default:
      throw Error(`Error: Language binding unsupported - ${language}`);
  }
}
