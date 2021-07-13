import path from "path";
import { supportedLangs, defaultManifest } from "../../commands/plugin";
import { clearStyle } from "./utils";

import { runCLI } from "@web3api/test-env-js";
import { unlinkSync, readFileSync } from "fs";

const HELP = `
w3 plugin command [options]

Commands:
  build <lang>     Build the plugin
    langs: ${supportedLangs.build.join(", ")}
  codegen <lang>   Generate code for the plugin
    langs: ${supportedLangs.codegen.join(", ")}

Options:
  -h, --help                        Show usage information
  -m, --manifest-path <path>  Path to the Web3API manifest file (default: ${defaultManifest.join(
    " | "
  )})
  -s, --output-schema <path>  Output directory for the built schema
  -t, --output-types <path>   Output dierctory for the generated types
  -i, --ipfs [<node>]         IPFS node to load external schemas (default: dev-server's node)
  -e, --ens [<address>]          ENS address to lookup external schemas (default: 0x0000...2e1e)

`;

describe("e2e tests for plugin command", () => {
  const projectRoot = path.resolve(__dirname, "../project/");

  test("Should show help text", async () => {
    const { exitCode: code, stdout: output, stderr: error } = await runCLI(
      {
        args: ["plugin", "--help"],
        cwd: projectRoot,
      },
      "../../../bin/w3"
    );

    expect(code).toEqual(0);
    expect(error).toBe("");
    expect(clearStyle(output)).toEqual(HELP);
  });

  test("Should throw error for invalid params - no command", async () => {
    const { exitCode: code, stdout: output, stderr: error } = await runCLI(
      {
        args: ["plugin", "--output-dir"],
        cwd: projectRoot,
      },
      "../../../bin/w3"
    );

    expect(code).toEqual(0);
    expect(error).toBe("");
    expect(clearStyle(output)).toEqual(`Please provide a command
${HELP}`);
  });

  test("Should throw error for invalid params - no lang", async () => {
    const { exitCode: code, stdout: output, stderr: error } = await runCLI(
      {
        args: ["plugin", "build"],
        cwd: projectRoot,
      },
      "../../../bin/w3"
    );

    expect(code).toEqual(0);
    expect(error).toBe("");
    expect(clearStyle(output)).toEqual(`Please provide a language
${HELP}`);
  });

  test("Should throw error for invalid params - unsupported lang", async () => {
    const { exitCode: code, stdout: output, stderr: error } = await runCLI(
      {
        args: ["plugin", "build", "unsupported-lang"],
        cwd: projectRoot,
      },
      "../../../bin/w3"
    );

    expect(code).toEqual(0);
    expect(error).toBe("");
    expect(clearStyle(output)).toEqual(`Unrecognized language "unsupported-lang"
${HELP}`);
  });

  test("Should throw error for invalid params - output-schema", async () => {
    const { exitCode: code, stdout: output, stderr: error } = await runCLI(
      {
        args: ["plugin", "build", "typescript", "--output-schema"],
        cwd: projectRoot,
      },
      "../../../bin/w3"
    );

    expect(code).toEqual(0);
    expect(error).toBe("");
    expect(clearStyle(output))
      .toEqual(`--output-schema option missing <path> argument
${HELP}`);
  });

  test("Should throw error for invalid params - output-types", async () => {
    const { exitCode: code, stdout: output, stderr: error } = await runCLI(
      {
        args: ["plugin", "build", "typescript", "--output-types"],
        cwd: projectRoot,
      },
      "../../../bin/w3"
    );

    expect(code).toEqual(0);
    expect(error).toBe("");
    expect(clearStyle(output))
      .toEqual(`--output-types option missing <path> argument
${HELP}`);
  });

  test("Should throw error for invalid params - ens", async () => {
    const { exitCode: code, stdout: output, stderr: error } = await runCLI(
      {
        args: ["plugin", "build", "typescript", "--ens"],
        cwd: projectRoot,
      },
      "../../../bin/w3"
    );

    expect(code).toEqual(0);
    expect(error).toBe("");
    expect(clearStyle(output))
      .toEqual(`--ens option missing <[address,]domain> argument
${HELP}`);
  });

  test("Should successfully generate types", async () => {
    const { exitCode: code, stdout: output, stderr: error } = await runCLI(
      {
        args: ["plugin", "codegen", "typescript"],
        cwd: projectRoot,
      },
      "../../../bin/w3"
    );

    expect(code).toEqual(0);
    expect(error).toBe("");
    expect(clearStyle(output)).toEqual(`- Generate types
- Manifest loaded from ./web3api.yaml
✔ Manifest loaded from ./web3api.yaml
✔ Generate types
`);

    const expected = readFileSync(`${projectRoot}/sample-types.ts`, { encoding: "utf-8" });
    const actual = readFileSync(`${projectRoot}/src/types.ts`, { encoding: "utf-8" });
    expect(actual).toEqual(expected);

    unlinkSync(`${projectRoot}/src/types.ts`);
  });

  test("Should successfully build schema", async () => {
    const { exitCode: code, stdout: output, stderr: error } = await runCLI(
      {
        args: ["plugin", "build", "typescript"],
        cwd: projectRoot,
      },
      "../../../bin/w3"
    );

    expect(code).toEqual(0);
    expect(error).toBe("");
    expect(clearStyle(output)).toEqual(`- Generate types
- Manifest loaded from ./web3api.yaml
✔ Manifest loaded from ./web3api.yaml
✔ Generate types
- Codegen Web3API schema bindings
✔ Codegen Web3API schema bindings
`);

    unlinkSync(`${projectRoot}/src/types.ts`);
  });
});
