/* eslint-disable @typescript-eslint/naming-convention */
import { generateBinding } from "./bindings";
import { getRelativePath, findCommonTypes, extendCommonTypes } from "./utils";

import { transformTypeInfo, TypeInfo } from "@web3api/schema-parse";

export * from "./utils";

export type TargetLanguage = "wasm-as" | "plugin-ts";

export type OutputEntry = FileEntry | DirectoryEntry | TemplateEntry;

export interface FileEntry {
  type: "File";
  name: string;
  data: string;
}

export interface DirectoryEntry {
  type: "Directory";
  name: string;
  data: OutputEntry[];
}

export interface TemplateEntry {
  type: "Template";
  name: string;
  data: string;
}

export interface OutputDirectory {
  entries: OutputEntry[];
}

export interface BindOutput {
  query?: OutputDirectory;
  mutation?: OutputDirectory;
}

export interface BindModuleOptions {
  typeInfo: TypeInfo;
  schema: string;
  outputDirAbs: string;
}

export interface BindOptions {
  language: TargetLanguage;
  query?: BindModuleOptions;
  mutation?: BindModuleOptions;
}

export function bindSchema(options: BindOptions): BindOutput {
  const { query, mutation, language } = options;

  // If both Query & Mutation modules are present,
  // determine which types are shared between them,
  // and add the __common & __commonPath properties
  if (query && mutation) {
    // Find all common types
    const commonTypes = findCommonTypes(query.typeInfo, mutation.typeInfo);

    if (commonTypes.length) {
      query.typeInfo = transformTypeInfo(
        query.typeInfo,
        extendCommonTypes(commonTypes)
      );

      // Compute the __commonPath
      const commonPath =
        getRelativePath(mutation.outputDirAbs, query.outputDirAbs) + "/common";

      mutation.typeInfo = {
        ...transformTypeInfo(
          mutation.typeInfo,
          extendCommonTypes(commonTypes, commonPath)
        ),
        __commonPath: commonPath,
      } as TypeInfo;
    }
  }

  return {
    query: query
      ? generateBinding(language, query.typeInfo, query.schema)
      : undefined,
    mutation: mutation
      ? generateBinding(language, mutation.typeInfo, mutation.schema)
      : undefined,
  };
}
