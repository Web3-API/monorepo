import { OutputDirectory } from "../..";
import * as Functions from "./functions";

import {
  transformTypeInfo,
  extendType,
  addFirstLast,
  toPrefixedGraphQLType,
  TypeInfo,
} from "@web3api/schema-parse";
import Mustache from "mustache";
import { readFileSync } from "fs";
import path from "path";

export function generateBinding(
  typeInfo: TypeInfo,
  schema?: string
): OutputDirectory {
  // Transform the TypeInfo to our liking
  const transforms = [
    extendType(Functions),
    addFirstLast,
    toPrefixedGraphQLType,
  ];

  for (const transform of transforms) {
    typeInfo = transformTypeInfo(typeInfo, transform);
  }

  const template = readFileSync(
    path.resolve(__dirname, "./templates/schema.mustache")
  );

  return {
    entries: [
      {
        type: "File",
        name: "types.ts",
        data: Mustache.render(
          template.toString(),
          schema ? { ...typeInfo, schema } : typeInfo
        ),
      },
    ],
  };
}
