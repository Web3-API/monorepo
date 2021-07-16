import { generateProjectTemplate } from "../lib/project-templates";
import { fixParameters } from "../lib/helpers/parameters";
import { intlMsg } from "../lib/intl";

import chalk from "chalk";
import { GluegunToolbox } from "gluegun";

const cmdStr = intlMsg.commands_create_options_command();
const nameStr = intlMsg.commands_create_options_projectName();
const optionsStr = intlMsg.commands_options_options();
const langStr = intlMsg.commands_create_options_lang();
const langsStr = intlMsg.commands_create_options_langs();
const createProjStr = intlMsg.commands_create_options_createProject();
const createAppStr = intlMsg.commands_create_options_createApp();
const createPluginStr = intlMsg.commands_create_options_createPlugin();
const pathStr = intlMsg.commands_create_options_o_path();

export const supportedLangs: { [key: string]: string[] } = {
  api: ["assemblyscript", "interface"],
  app: ["react"],
  plugin: ["typescript"],
};

const HELP = `
${chalk.bold("w3 create")} ${cmdStr} <${nameStr}> [${optionsStr}]

${intlMsg.commands_create_options_commands()}:
  ${chalk.bold("api")} <${langStr}>     ${createProjStr}
    ${langsStr}: ${supportedLangs.api.join(", ")}
  ${chalk.bold("app")} <${langStr}>     ${createAppStr}
    ${langsStr}: ${supportedLangs.app.join(", ")}
  ${chalk.bold("plugin")} <${langStr}>  ${createPluginStr}
    ${langsStr}: ${supportedLangs.plugin.join(", ")}

Options:
  -h, --help               ${intlMsg.commands_create_options_h()}
  -o, --output-dir <${pathStr}>  ${intlMsg.commands_create_options_o()}
`;

export default {
  alias: ["c"],
  description: intlMsg.commands_create_description(),
  run: async (toolbox: GluegunToolbox): Promise<void> => {
    const { parameters, print, prompt, filesystem, middleware } = toolbox;

    // Options
    let { help, outputDir } = parameters.options;
    const { h, o } = parameters.options;

    help = help || h;
    outputDir = outputDir || o;

    let type = "";
    let lang = "";
    let name = "";
    try {
      const params = parameters;
      [type, lang, name] = fixParameters(
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

    if (!type) {
      print.error(intlMsg.commands_create_error_noCommand());
      print.info(HELP);
      return;
    }

    if (!lang) {
      print.error(intlMsg.commands_create_error_noLang());
      print.info(HELP);
      return;
    }

    if (!name) {
      print.error(intlMsg.commands_create_error_noName());
      print.info(HELP);
      return;
    }

    if (!supportedLangs[type]) {
      const unrecognizedCommand = intlMsg.commands_create_error_unrecognizedCommand();
      print.error(`${unrecognizedCommand} "${type}"`);
      print.info(HELP);
      return;
    }

    if (supportedLangs[type].indexOf(lang) === -1) {
      const unrecognizedLanguage = intlMsg.commands_create_error_unrecognizedLanguage();
      print.error(`${unrecognizedLanguage} "${lang}"`);
      print.info(HELP);
      return;
    }

    if (outputDir === true) {
      const outputDirMissingPathMessage = intlMsg.commands_create_error_outputDirMissingPath(
        {
          option: "--output-dir",
          argument: `<${pathStr}>`,
        }
      );
      print.error(outputDirMissingPathMessage);
      print.info(HELP);
      return;
    }

    await middleware.run({
      name: toolbox.command?.name,
      options: { help, outputDir, type, lang, name },
    });

    const projectDir = outputDir ? `${outputDir}/${name}` : name;

    // check if project already exists
    if (!filesystem.exists(projectDir)) {
      print.newline();
      print.info(intlMsg.commands_create_settingUp());
    } else {
      const directoryExistsMessage = intlMsg.commands_create_directoryExists({
        dir: projectDir,
      });
      print.info(directoryExistsMessage);
      const overwrite = await prompt.confirm(
        intlMsg.commands_create_overwritePrompt()
      );
      if (overwrite) {
        const overwritingMessage = intlMsg.commands_create_overwriting({
          dir: projectDir,
        });
        print.info(overwritingMessage);
        filesystem.remove(projectDir);
      } else {
        process.exit(8);
      }
    }

    generateProjectTemplate(type, lang, projectDir, filesystem)
      .then(() => {
        print.newline();
        let readyMessage;
        if (type === "api") {
          readyMessage = intlMsg.commands_create_readyProtocol();
        } else if (type === "app") {
          readyMessage = intlMsg.commands_create_readyDapp();
        } else if (type === "plugin") {
          readyMessage = intlMsg.commands_create_readyPlugin();
        }
        print.info(`🔥 ${readyMessage} 🔥`);
      })
      .catch((err) => {
        const commandFailError = intlMsg.commands_create_error_commandFail({
          error: err.command,
        });
        print.error(commandFailError);
      });
  },
};
