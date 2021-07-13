const baseTypes = {
  boolean: "boolean",
  number: "number",
  string: "string",
};

export type BaseTypes = typeof baseTypes;

export type BaseType = keyof BaseTypes;

export function isBaseType(type: string): type is BaseType {
  return type in baseTypes;
}
