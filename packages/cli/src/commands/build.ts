/* eslint-disable prefer-const */
import {
  Compiler,
  Project,
  SchemaComposer,
  Watcher,
  WatchEvent,
  watchEventName,
} from "../lib";
import { fixParameters } from "../lib/helpers/parameters";
import { publishToIPFS } from "../lib/publishers/ipfs-publisher";
import { intlMsg } from "../lib/intl";
import { SharedMiddlewareState } from "../lib/middleware";

import chalk from "chalk";
import axios from "axios";
import readline from "readline";
import { GluegunToolbox } from "gluegun";

const optionsStr = intlMsg.commands_build_options_options();
const manStr = intlMsg.commands_build_options_manifest();
const nodeStr = intlMsg.commands_build_options_i_node();
const pathStr = intlMsg.commands_build_options_o_path();
const addrStr = intlMsg.commands_build_options_e_address();
const domStr = intlMsg.commands_build_options_e_domain();

const HELP = `
${chalk.bold("w3 build")} [${optionsStr}] ${chalk.bold(`[<web3api-${manStr}>]`)}

${optionsStr[0].toUpperCase() + optionsStr.slice(1)}:
  -h, --help                         ${intlMsg.commands_build_options_h()}
  -i, --ipfs [<${nodeStr}>]                ${intlMsg.commands_build_options_i()}
  -o, --output-dir <${pathStr}>            ${intlMsg.commands_build_options_o()}
  -e, --test-ens <[${addrStr},]${domStr}>  ${intlMsg.commands_build_options_e()}
  -w, --watch                        ${intlMsg.commands_build_options_w()}
  -v, --verbose                      ${intlMsg.commands_build_options_v()}
`;

export default {
  alias: ["b"],
  description: intlMsg.commands_build_description(),
  run: async (toolbox: GluegunToolbox): Promise<void> => {
    const { filesystem, parameters, print, middleware } = toolbox;

    const { h, i, o, w, e, v } = parameters.options;
    let { help, ipfs, outputDir, watch, testEns, verbose } = parameters.options;

    help = help || h;
    ipfs = ipfs || i;
    outputDir = outputDir || o;
    watch = watch || w;
    testEns = testEns || e;
    verbose = verbose || v;

    let manifestPath;
    try {
      const params = toolbox.parameters;
      [manifestPath] = fixParameters(
        {
          options: params.options,
          array: params.array,
        },
        {
          h,
          help,
          w,
          watch,
          v,
          verbose,
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

    if (testEns === true) {
      const testEnsAddressMissingMessage = intlMsg.commands_build_error_testEnsAddressMissing(
        {
          option: "--test-ens",
          argument: `<[${addrStr},]${domStr}>`,
        }
      );
      print.error(testEnsAddressMissingMessage);
      print.info(HELP);
      return;
    }

    if (testEns && !ipfs) {
      const testEnsNodeMissingMessage = intlMsg.commands_build_error_testEnsNodeMissing(
        {
          option: "--test-ens",
          required: `--ipfs [<${nodeStr}>]`,
        }
      );
      print.error(testEnsNodeMissingMessage);
      print.info(HELP);
      return;
    }

    const middlewareState: SharedMiddlewareState = await middleware.run({
      name: toolbox.command?.name,
      options: { help, ipfs, outputDir, watch, testEns, verbose, manifestPath },
    });

    if (!middlewareState.dockerPath) {
      print.error(intlMsg.dockerVerifyMiddleware_noDocker());
      return;
    }

    // Resolve manifest & output directories
    manifestPath =
      (manifestPath && filesystem.resolve(manifestPath)) ||
      filesystem.resolve("web3api.yaml");
    outputDir =
      (outputDir && filesystem.resolve(outputDir)) || filesystem.path("build");

    let ipfsProvider: string | undefined;
    let ethProvider: string | undefined;
    let ensAddress: string | undefined;
    let ensDomain: string | undefined;

    if (typeof ipfs === "string") {
      // Custom IPFS provider
      ipfsProvider = ipfs;
    } else if (ipfs) {
      // Dev-server IPFS provider
      // TODO: handle the case where the dev server isn't found
      const {
        data: { ipfs, ethereum },
      } = await axios.get("http://localhost:4040/providers");
      ipfsProvider = ipfs;
      ethProvider = ethereum;
    }

    if (typeof testEns == "string") {
      // Fetch the ENS domain, and optionally the address
      if (testEns.indexOf(",") > -1) {
        const [addr, dom] = testEns.split(",");
        ensAddress = addr;
        ensDomain = dom;
      } else {
        ensDomain = testEns;
      }

      // If not address was provided, fetch it from the server
      // or deploy a new instance
      if (!ensAddress) {
        const getEns = await axios.get("http://localhost:4040/ens");

        if (!getEns.data.ensAddress) {
          const deployEns = await axios.get("http://localhost:4040/deploy-ens");
          ensAddress = deployEns.data.ensAddress;
        } else {
          ensAddress = getEns.data.ensAddress;
        }
      }
    }

    const project = new Project({
      web3apiManifestPath: manifestPath,
      quiet: verbose ? false : true,
    });

    const schemaComposer = new SchemaComposer({
      project,
      ensAddress,
      ethProvider,
      ipfsProvider,
    });

    const compiler = new Compiler({
      project,
      outputDir,
      schemaComposer,
    });

    const execute = async (): Promise<boolean> => {
      compiler.reset();
      await middlewareState.dockerLock?.request();
      const result = await compiler.compile();
      void middlewareState.dockerLock?.release();

      if (!result) {
        return result;
      }

      const uris: string[][] = [];

      // publish to IPFS
      if (ipfsProvider) {
        const cid = await publishToIPFS(outputDir, ipfsProvider);

        print.success(`IPFS { ${cid} }`);
        uris.push(["Web3API IPFS", `ipfs://${cid}`]);

        if (testEns) {
          if (!ensAddress) {
            uris.push([
              intlMsg.commands_build_ensRegistry(),
              `${ethProvider}/${ensAddress}`,
            ]);
          }

          // ask the dev server to publish the CID to ENS
          const { data } = await axios.get(
            "http://localhost:4040/register-ens",
            {
              params: {
                domain: ensDomain,
                cid,
              },
            }
          );

          if (data.success) {
            uris.push(["Web3API ENS", `${testEns} => ${cid}`]);
          } else {
            print.error(
              `${intlMsg.commands_build_error_resolution()} { ${testEns} => ${cid} }\n` +
                `${intlMsg.commands_build_ethProvider()}: ${ethProvider}\n` +
                `${intlMsg.commands_build_address()}: ${ensAddress}`
            );
          }

          return data.success;
        }

        if (uris.length) {
          print.success(`${intlMsg.commands_build_uriViewers()}:`);
          print.table(uris);
          return true;
        } else {
          return false;
        }
      }

      return true;
    };

    if (!watch) {
      const result = await execute();

      if (!result) {
        process.exitCode = 1;
        return;
      }
    } else {
      // Execute
      await execute();

      const keyPressListener = () => {
        // Watch for escape key presses
        print.info(
          `${intlMsg.commands_build_keypressListener_watching()}: ${project.getWeb3ApiManifestDir()}`
        );
        print.info(intlMsg.commands_build_keypressListener_exit());
        readline.emitKeypressEvents(process.stdin);
        process.stdin.on("keypress", async (str, key) => {
          if (
            key.name == "escape" ||
            key.name == "q" ||
            (key.name == "c" && key.ctrl)
          ) {
            await watcher.stop();
            process.kill(process.pid, "SIGINT");
          }
        });

        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(true);
        }

        process.stdin.resume();
      };

      keyPressListener();

      // Watch the directory
      const watcher = new Watcher();

      watcher.start(project.getWeb3ApiManifestDir(), {
        ignored: [
          outputDir + "/**",
          project.getWeb3ApiManifestDir() + "/**/w3/**",
        ],
        ignoreInitial: true,
        execute: async (events: WatchEvent[]) => {
          // Log all of the events encountered
          for (const event of events) {
            print.info(`${watchEventName(event.type)}: ${event.path}`);
          }

          // Execute the build
          await execute();

          // Process key presses
          keyPressListener();
        },
      });
    }

    process.exitCode = 0;
  },
};
