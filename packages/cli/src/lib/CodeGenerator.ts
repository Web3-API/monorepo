import { SchemaComposer } from "./SchemaComposer";
import { Project } from "./Project";
import { step, withSpinner } from "./helpers";
import { intlMsg } from "./intl";

import { TypeInfo } from "@web3api/schema-parse";
import {
  OutputDirectory,
  writeDirectory,
  bindSchema,
} from "@web3api/schema-bind";
import path from "path";
import fs, { readFileSync, writeFileSync } from "fs";
import * as gluegun from "gluegun";
import { Ora } from "ora";
import Mustache from "mustache";

export interface CodeGeneratorConfig {
  outputDir?: string;
  outputTypes?: string;
  generationFile?: string;
  project: Project;
  schemaComposer: SchemaComposer;
}

export class CodeGenerator {
  private _schema: string | undefined = "";

  constructor(private _config: CodeGeneratorConfig) {}

  public async generate(): Promise<boolean> {
    try {
      // Compile the API
      await this._generateCode();

      return true;
    } catch (e) {
      gluegun.print.error(e);
      return false;
    }
  }

  private async _generateCode() {
    const { schemaComposer, project } = this._config;

    const run = async (spinner?: Ora) => {
      // Make sure that the output dir exists, if not create a new one
      if (
        this._config.generationFile &&
        this._config.outputDir &&
        !fs.existsSync(this._config.outputDir)
      ) {
        fs.mkdirSync(this._config.outputDir);
      }

      // Get the fully composed schema
      const composed = await schemaComposer.getComposedSchemas();

      if (!composed.combined) {
        throw Error(intlMsg.lib_codeGenerator_noComposedSchema());
      }

      const typeInfo = composed.combined.typeInfo;
      this._schema = composed.combined.schema;

      if (this._config.generationFile) {
        const output: OutputDirectory = {
          entries: [],
        };

        // Check the generation file if it has the proper run() method
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports, @typescript-eslint/naming-convention
        const generator = await require(this._config.generationFile);
        if (!generator) {
          throw Error(intlMsg.lib_codeGenerator_wrongGenFile());
        }

        const { run } = generator;
        if (!run) {
          throw Error(intlMsg.lib_codeGenerator_noRunMethod());
        }

        await run(output, {
          typeInfo,
          generate: (templatePath: string, config: unknown) =>
            this._generateTemplate(templatePath, config, spinner),
        });

        writeDirectory(
          this._config.outputDir || "build",
          output,
          (templatePath: string) =>
            this._generateTemplate(templatePath, typeInfo, spinner)
        );
      } else {
        const content = bindSchema({
          query: {
            typeInfo: composed.combined?.typeInfo as TypeInfo,
            schema: composed.combined?.schema as string,
            outputDirAbs: "",
          },
          language: "plugin-ts",
        });

        writeFileSync(
          this._config.outputTypes as string,
          content.query?.entries[0].data
        );
      }
    };

    if (project.quiet) {
      await run();
    } else {
      await withSpinner(
        intlMsg.lib_codeGenerator_genCodeText(),
        intlMsg.lib_codeGenerator_genCodeError(),
        intlMsg.lib_codeGenerator_genCodeWarning(),
        async (spinner) => {
          return run(spinner);
        }
      );
    }
  }

  private _generateTemplate(
    templatePath: string,
    config: unknown,
    spinner?: Ora
  ): string {
    const { project } = this._config;

    if (!project.quiet && spinner) {
      const stepMessage = intlMsg.lib_codeGenerator_genTemplateStep({
        path: `${templatePath}`,
      });
      step(spinner, stepMessage);
    }

    if (this._config.generationFile) {
      // Update template path when the generation file is given
      templatePath = path.join(
        path.dirname(this._config.generationFile),
        templatePath
      );
    }

    const template = readFileSync(templatePath);
    const types =
      typeof config === "object" && config !== null ? config : { config };
    let content = Mustache.render(template.toString(), {
      ...types,
      schema: this._schema,
    });

    content = `// ${intlMsg.lib_codeGenerator_templateNoModify()}

${content}
`;

    return content;
  }
}
