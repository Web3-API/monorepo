/* eslint-disable prefer-const */
import { CodeGenerator, Compiler, Project, SchemaComposer } from "../lib";
import { fixParameters } from "../lib/helpers";
import { intlMsg } from "../lib/intl";

import { GluegunToolbox, print } from "gluegun";
import axios from "axios";
import chalk from "chalk";

export const supportedLangs: { [key: string]: string[] } = {
  build: ["typescript"],
  codegen: ["typescript"],
};
export const defaultManifest = ["web3api.yaml", "web3api.yml"];

const cmdStr = intlMsg.commands_plugin_options_command();
const optionsStr = intlMsg.commands_options_options();
const langsStr = intlMsg.commands_plugin_options_langs();
const langStr = intlMsg.commands_plugin_options_lang();
const buildStr = intlMsg.commands_plugin_options_build();
const codegenStr = intlMsg.commands_plugin_options_codegen();
const pathStr = intlMsg.commands_plugin_options_path();
const defaultManifestStr = defaultManifest.join(" | ");
const nodeStr = intlMsg.commands_plugin_options_i_node();
const addrStr = intlMsg.commands_plugin_options_e_address();

const HELP = `
${chalk.bold("w3 plugin")} ${cmdStr} [${optionsStr}]

Commands:
  ${chalk.bold("build")} <${langStr}>     ${buildStr}
    ${langsStr}: ${supportedLangs.build.join(", ")}
  ${chalk.bold("codegen")} <${langStr}>   ${codegenStr}
    ${langsStr}: ${supportedLangs.codegen.join(", ")}

Options:
  -h, --help                        ${intlMsg.commands_plugin_options_h()}
  -m, --manifest-path <${pathStr}>  ${intlMsg.commands_plugin_options_m()}: ${defaultManifestStr})
  -s, --output-schema <${pathStr}>  ${intlMsg.commands_plugins_options_schema()}
  -t, --output-types <${pathStr}>   ${intlMsg.commands_plugins_options_types()}
  -i, --ipfs [<${nodeStr}>]         ${intlMsg.commands_plugin_options_i()}
  -e, --ens [<${addrStr}>]          ${intlMsg.commands_plugin_options_e()}
`;

export default {
  alias: ["p"],
  description: intlMsg.commands_plugin_description(),
  run: async (toolbox: GluegunToolbox): Promise<void> => {
    const { filesystem, parameters } = toolbox;

    // Options
    let {
      help,
      manifestPath,
      outputSchema,
      outputTypes,
      ipfs,
      ens,
    } = parameters.options;
    const { h, m, s, t, i, e } = parameters.options;

    help = help || h;
    manifestPath = manifestPath || m;
    outputSchema = outputSchema || s;
    outputTypes = outputTypes || t;
    ipfs = ipfs || i;
    ens = ens || e;

    let command = "",
      lang = "";
    try {
      const params = parameters;
      [command, lang] = fixParameters(
        {
          options: params.options,
          array: params.array,
        },
        {
          h,
          help,
        }
      );
    } catch (e) {
      print.error(e.message);
      process.exitCode = 1;
      return;
    }

    if (help) {
      print.info(HELP);
      return;
    }

    if (!command) {
      print.error(intlMsg.commands_plugin_error_noCommand());
      print.info(HELP);
      return;
    }

    if (!lang) {
      print.error(intlMsg.commands_plugin_error_noLang());
      print.info(HELP);
      return;
    }

    if (!supportedLangs[command]) {
      const unrecognizedCommand = intlMsg.commands_plugin_error_unrecognizedCommand();
      print.error(`${unrecognizedCommand} "${command}"`);
      print.info(HELP);
      return;
    }

    if (supportedLangs[command].indexOf(lang) === -1) {
      const unrecognizedLanguage = intlMsg.commands_plugin_error_unrecognizedLanguage();
      print.error(`${unrecognizedLanguage} "${lang}"`);
      print.info(HELP);
      return;
    }

    if (outputSchema === true) {
      const outputSchemaMissingPathMessage = intlMsg.commands_plugin_error_outputDirMissingPath(
        {
          option: "--output-schema",
          argument: `<${pathStr}>`,
        }
      );
      print.error(outputSchemaMissingPathMessage);
      print.info(HELP);
      return;
    }

    if (outputTypes === true) {
      const outputTypesMissingPathMessage = intlMsg.commands_plugin_error_outputDirMissingPath(
        {
          option: "--output-types",
          argument: `<${pathStr}>`,
        }
      );
      print.error(outputTypesMissingPathMessage);
      print.info(HELP);
      return;
    }

    if (ens === true) {
      const domStr = intlMsg.commands_plugin_error_domain();
      const ensAddressMissingMessage = intlMsg.commands_build_error_testEnsAddressMissing(
        {
          option: "--ens",
          argument: `<[${addrStr},]${domStr}>`,
        }
      );
      print.error(ensAddressMissingMessage);
      print.info(HELP);
      return;
    }

    let ipfsProvider: string | undefined;
    let ethProvider: string | undefined;
    let ensAddress: string | undefined = ens;

    if (typeof ipfs === "string") {
      // Custom IPFS provider
      ipfsProvider = ipfs;
    } else if (ipfs) {
      // Dev-server IPFS provider
      try {
        const {
          data: { ipfs, ethereum },
        } = await axios.get("http://localhost:4040/providers");
        ipfsProvider = ipfs;
        ethProvider = ethereum;
      } catch (e) {
        // Dev server not found
      }
    }

    manifestPath =
      (manifestPath && filesystem.resolve(manifestPath)) ||
      ((await filesystem.existsAsync(defaultManifest[0]))
        ? filesystem.resolve(defaultManifest[0])
        : filesystem.resolve(defaultManifest[1]));
    outputSchema = outputSchema && filesystem.resolve(outputSchema);
    outputTypes = outputTypes && filesystem.resolve(outputTypes);

    const project = new Project({
      web3apiManifestPath: manifestPath,
    });

    const schemaComposer = new SchemaComposer({
      project,
      ipfsProvider,
      ethProvider,
      ensAddress,
    });

    let result = false;

    const codeGenerator = new CodeGenerator({
      project,
      schemaComposer,
      outputTypes: outputTypes || filesystem.resolve("./src/types.ts"),
    });

    result = await codeGenerator.generate();

    if (command == "build") {
      const compiler = new Compiler({
        project,
        outputDir: outputSchema || filesystem.path("build"),
        schemaComposer,
      });

      result = await compiler.codegen();
    }

    if (result) {
      process.exitCode = 0;
    } else {
      process.exitCode = 1;
    }
  },
};
