import { intlMsg } from "../lib/intl";
import { withSpinner } from "../lib/helpers";
import { ProjectEnv } from "../lib/ProjectEnv";
import { runCommand } from "../lib/helpers/command";

import { GluegunToolbox } from "gluegun";
import chalk from "chalk";
import fs from "fs";

const optionsStr = intlMsg.commands_env_options_options();
const manStr = intlMsg.commands_env_options_manifest();
const moduleNameStr = intlMsg.commands_env_moduleName();

const cmdStr = intlMsg.commands_create_options_command();
const upStr = intlMsg.commands_env_command_up();
const downStr = intlMsg.commands_env_command_down();
const varsStr = intlMsg.commands_env_command_vars();
const configStr = intlMsg.commands_env_command_config();
const helpStr = intlMsg.commands_env_options_h();

const COMMANDS = ["config", "down", "help", "up", "vars"];

const HELP = `
${chalk.bold("w3 env")} <${cmdStr}> <web3api-${manStr}> [${optionsStr}]

${intlMsg.commands_create_options_commands()}:
  ${chalk.bold("config")}  ${configStr}
  ${chalk.bold("down")}     ${downStr}
  ${chalk.bold("help")}     ${helpStr}
  ${chalk.bold("up")}     ${upStr}
  ${chalk.bold("vars")}  ${varsStr}

${optionsStr[0].toUpperCase() + optionsStr.slice(1)}:
  -m, --modules [<${moduleNameStr}>]       ${intlMsg.commands_env_options_m()}
  -v, --verbose                      ${intlMsg.commands_env_options_v()}
`;

export default {
  alias: ["t"],
  description: intlMsg.commands_env_description(),
  run: async (toolbox: GluegunToolbox): Promise<void> => {
    const { parameters, print, filesystem } = toolbox;
    const command = parameters.first;
    const { m, v } = parameters.options;
    let { modules, verbose } = parameters.options;
    let manifestPath = parameters.second;

    modules = modules || m;
    verbose = !!(verbose || v);

    if (modules) {
      modules = modules.split(",").map((m: string) => m.trim());
    }

    if (command === "help") {
      print.info(HELP);
      return;
    }

    if (!command) {
      print.error(intlMsg.commands_env_error_noCommand());
      print.info(HELP);
      return;
    }

    manifestPath =
      (manifestPath && filesystem.resolve(manifestPath)) ||
      filesystem.resolve("web3api.yaml");

    if (!COMMANDS.includes(command)) {
      const unrecognizedCommandMessage = intlMsg.commands_env_error_unrecognizedCommand(
        {
          command: command,
        }
      );
      print.error(unrecognizedCommandMessage);
      print.info(HELP);
      return;
    }

    const project = await ProjectEnv.getInstance({
      web3apiManifestPath: manifestPath,
      quiet: !verbose,
      modulesToUse: modules,
    });

    const manifest = await project.getEnvManifest();

    if (manifest.modules && modules) {
      const manifestModuleNames = manifest.modules.map((module) => module.name);
      const unrecognizedModules: string[] = [];
      modules.forEach((module: string) => {
        if (!manifestModuleNames.includes(module)) {
          unrecognizedModules.push(module);
        }
      });

      if (unrecognizedModules.length) {
        throw new Error(
          `Unrecognized modules: ${unrecognizedModules.join(", ")}`
        );
      }
    }

    await project.installModules();
    await project.generateBaseDockerCompose();

    const baseCommand = await project.generateBaseComposedCommand();

    if (command === "up") {
      await runCommand(`${baseCommand} up -d --build`, !verbose);
    } else if (command === "down") {
      await runCommand(`${baseCommand} down`, !verbose);
    } else if (command === "vars") {
      let vars = "";

      await withSpinner(
        intlMsg.commands_env_vars_text(),
        intlMsg.commands_env_vars_error(),
        intlMsg.commands_env_vars_warning(),
        async (_spinner) => {
          const envVarRegex = /\${([^}]+)}/gm;
          const composePaths = await project.getCorrectedDockerComposePaths();

          const envVars = composePaths.reduce((acc, current) => {
            const rawManifest = fs.readFileSync(current, "utf-8");
            const matches = rawManifest.match(envVarRegex) || [];

            return [
              ...acc,
              ...matches.map((match) => {
                if (match.startsWith("$")) {
                  if (match.startsWith("${")) {
                    return match.slice(2, match.length - 1);
                  }

                  return match.slice(1);
                }

                return match;
              }),
            ];
          }, [] as string[]);

          const variables = Array.from(new Set(envVars));

          vars = `${variables.map((variable) => `\n- ${variable}`).join("")}`;
        }
      );

      print.info(vars);
    } else if (command === "config") {
      const { stdout } = await runCommand(`${baseCommand} config`, !verbose);

      print.info(stdout);
    } else {
      throw Error(intlMsg.commands_env_error_never());
    }
  },
};
