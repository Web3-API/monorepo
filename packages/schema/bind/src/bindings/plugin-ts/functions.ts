import { isBaseType } from "./types";
import { MustacheFunction } from "../types";

export const toTypescript: MustacheFunction = () => {
  return (value: string, render: (template: string) => string) => {
    let type = render(value);
    let isEnum = false;

    let nullable = false;
    if (type[type.length - 1] === "!") {
      type = type.substr(0, type.length - 1);
    } else {
      nullable = true;
    }

    if (type[0] === "[") {
      return toTypescriptArray(type, nullable);
    }

    switch (type) {
      case "Int":
      case "Int8":
      case "Int16":
      case "Int32":
      case "Int64":
      case "UInt":
      case "UInt32":
      case "UInt8":
      case "UInt16":
      case "UInt64":
        type = "number";
        break;
      case "String":
        type = "string";
        break;
      case "Boolean":
        type = "boolean";
        break;
      case "Bytes":
        type = "ArrayBuffer";
        break;
      default:
        if (type.includes("Enum_")) {
          type = `Types.${type.replace("Enum_", "")}`;
          isEnum = true;
        } else {
          type = `Types.${type}`;
        }
    }

    return applyNullable(type, nullable, isEnum);
  };
};

const toTypescriptArray = (type: string, nullable: boolean): string => {
  const result = type.match(/(\[)([[\]A-Za-z1-9_.!]+)(\])/);

  if (!result || result.length !== 4) {
    throw Error(`Invalid Array: ${type}`);
  }

  const tsType = toTypescript()(result[2], (str) => str);
  return applyNullable("Array<" + tsType + ">", nullable, false);
};

const applyNullable = (
  type: string,
  nullable: boolean,
  isEnum: boolean
): string => {
  if (nullable) {
    if (
      type.indexOf("Array") === 0 ||
      type.indexOf("string") === 0 ||
      (!isEnum && !isBaseType(type))
    ) {
      return `${type} | null`;
    } else {
      return `Nullable<${type}>`;
    }
  } else {
    return type;
  }
};
