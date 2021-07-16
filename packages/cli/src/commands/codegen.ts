/* eslint-disable prefer-const */
import { CodeGenerator, Project, SchemaComposer } from "../lib";
import { fixParameters } from "../lib/helpers/parameters";
import { intlMsg } from "../lib/intl";

import chalk from "chalk";
import axios from "axios";
import { GluegunToolbox } from "gluegun";

export const defaultGenerationFile = "web3api.gen.js";
export const defaultManifest = ["web3api.yaml", "web3api.yml"];

const genFileOp = intlMsg
  .commands_codegen_options_genFile()
  .toLowerCase()
  .replace(" ", "-");
const optionsStr = intlMsg.commands_options_options();
const nodeStr = intlMsg.commands_codegen_options_i_node();
const pathStr = intlMsg.commands_codegen_options_o_path();
const addrStr = intlMsg.commands_codegen_options_e_address();
const defaultManifestStr = defaultManifest.join(" | ");

const HELP = `
${chalk.bold("w3 codegen")} ${chalk.bold(`[<${genFileOp}>]`)} [${optionsStr}]

${intlMsg.commands_codegen_options_genFile()}:
  ${intlMsg.commands_codegen_options_genFilePath()}: ${defaultGenerationFile})

${optionsStr[0].toUpperCase() + optionsStr.slice(1)}:
  -h, --help                              ${intlMsg.commands_codegen_options_h()}
  -m, --manifest-path <${pathStr}>              ${intlMsg.commands_codegen_options_m()}: ${defaultManifestStr})
  -i, --ipfs [<${nodeStr}>]                     ${intlMsg.commands_codegen_options_i()}
  -o, --output-dir <${pathStr}>                 ${intlMsg.commands_codegen_options_o()}
  -e, --ens [<${addrStr}>]                   ${intlMsg.commands_codegen_options_e()}
`;

export default {
  alias: ["g"],
  description: intlMsg.commands_codegen_description(),
  run: async (toolbox: GluegunToolbox): Promise<void> => {
    const { filesystem, parameters, print, middleware } = toolbox;

    const { h, m, i, o, e } = parameters.options;
    let { help, manifestPath, ipfs, outputDir, ens } = parameters.options;

    help = help || h;
    manifestPath = manifestPath || m;
    ipfs = ipfs || i;
    outputDir = outputDir || o;
    ens = ens || e;

    let generationFile;
    try {
      const params = toolbox.parameters;
      [generationFile] = fixParameters(
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

    if (outputDir === true) {
      const outputDirMissingPathMessage = intlMsg.commands_build_error_outputDirMissingPath(
        {
          option: "--output-dir",
          argument: `<${pathStr}>`,
        }
      );
      print.error(outputDirMissingPathMessage);
      print.info(HELP);
      return;
    }

    if (ens === true) {
      const domStr = intlMsg.commands_codegen_error_domain();
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

    await middleware.run({
      name: toolbox.command?.name,
      options: { help, manifestPath, ipfs, outputDir, ens, generationFile },
    });

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

    // Resolve generation file & output directories
    generationFile =
      (generationFile && filesystem.resolve(generationFile)) ||
      filesystem.resolve(defaultGenerationFile);
    manifestPath =
      (manifestPath && filesystem.resolve(manifestPath)) ||
      ((await filesystem.existsAsync(defaultManifest[0]))
        ? filesystem.resolve(defaultManifest[0])
        : filesystem.resolve(defaultManifest[1]));
    outputDir =
      (outputDir && filesystem.resolve(outputDir)) || filesystem.path("types");

    const project = new Project({
      web3apiManifestPath: manifestPath,
    });

    const schemaComposer = new SchemaComposer({
      project,
      ipfsProvider,
      ethProvider,
      ensAddress,
    });

    const codeGenerator = new CodeGenerator({
      project,
      schemaComposer,
      generationFile,
      outputDir,
    });

    if (await codeGenerator.generate()) {
      print.success(`🔥 ${intlMsg.commands_codegen_success()} 🔥`);
      process.exitCode = 0;
    } else {
      process.exitCode = 1;
    }
  },
};
