import { CommandInput, Middleware, SharedMiddlewareState } from "./types";

import { system } from "gluegun";

export class DockerVerifyMiddleware implements Middleware {
  check(command: CommandInput, sharedState: SharedMiddlewareState): boolean {
    return (
      ["build", "test-env"].includes(command.name) && !sharedState.dockerPath
    );
  }

  async run(
    command: CommandInput, // eslint-disable-line @typescript-eslint/no-unused-vars
    sharedState: SharedMiddlewareState // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Partial<SharedMiddlewareState>> {
    const dockerPath: string = (system.which("docker") ?? "") as string;
    return {
      dockerPath,
    };
  }
}
