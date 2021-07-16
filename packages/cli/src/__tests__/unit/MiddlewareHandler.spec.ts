import { CommandInput, MiddlewareHandler, SharedMiddlewareState } from "../../lib/middleware";
import { system } from "gluegun";

describe("MiddlewareHandler validation", () => {

  const getHandler = (): MiddlewareHandler => {
    const middleware = {
      check: (command: CommandInput, sharedState: SharedMiddlewareState): boolean => {
        // this should not result in a change of state
        sharedState.immutable = 69;
        command.name = "immutable";
        // return the check
        return !sharedState.dockerPath;
      },
      run: async (
        command: CommandInput,
        sharedState: SharedMiddlewareState
      ): Promise<Partial<SharedMiddlewareState>> => {
        // this should not result in a change of state
        sharedState.immutable = 42;
        command.name = "immutable";
        // get docker path and return state update that will take effect
        const dockerPath: string = (system.which("docker") ?? "") as string;
        return {
          dockerPath,
          runCount: <number>command.options.runCount
        };
      }
    }
    return new MiddlewareHandler(middleware);
  };


  test("Should run middleware iff check(...) returns true or undefined", async () => {
    const handler = getHandler();

    // first handler run should run the test middleware and assigns value to docker path
    expect(handler.state.dockerPath).toStrictEqual(undefined);
    let sharedState = await handler.run( {
      name: "myCommand",
      options: {
        runCount: 1
      },
    });
    expect(sharedState.runCount).toStrictEqual(1);

    // second handler run should not run the test middleware due to check failure
    expect(handler.state.dockerPath).toBeTruthy();
    sharedState = await handler.run( {
      name: "myCommand",
      options: {
        runCount: 2
      },
    });
    expect(sharedState.runCount).toStrictEqual(1);
  });

  test("Middleware only mutates state by returning update from run(...)", async () => {
    const handler = getHandler();
    const commandInput: CommandInput = { name: "", options: {} };
    const sharedState = await handler.run(commandInput);
    expect(sharedState.immutable).toStrictEqual(undefined);
    expect(handler.state.immutable).toStrictEqual(undefined);
    expect(commandInput.name).toStrictEqual("");
  });

});