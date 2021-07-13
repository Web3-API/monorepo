import { Client, PluginModule } from "@web3api/core-js";

export interface MutationModule extends PluginModule {
  mutationMethod: (
    input: Input_mutationMethod
  ) => number;
  objectMethod: (
    input: Input_objectMethod
  ) => Types.AnotherType | null;
}

export interface Input_mutationMethod {
  str: string;
  optStr?: string | null;
  en: Types.CustomEnum;
  optEnum?: Nullable<Types.CustomEnum>;
  enumArray: Array<Types.CustomEnum>;
  optEnumArray?: Array<Nullable<Types.CustomEnum>> | null;
}
export interface Input_objectMethod {
  object: Types.AnotherType;
  optObject?: Types.AnotherType | null;
  objectArray: Array<Types.AnotherType>;
  optObjectArray?: Array<Types.AnotherType | null> | null;
}

export const schema = ``;