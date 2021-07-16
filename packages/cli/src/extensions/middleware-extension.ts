import { MiddlewareHandler } from "../lib/middleware";
import { DockerVerifyMiddleware } from "../lib/middleware/DockerVerifyMiddleware";
import { DockerLockMiddleware } from "../lib/middleware/DockerLockMiddleware";

import { GluegunToolbox } from "gluegun";

module.exports = (toolbox: GluegunToolbox): void => {
  toolbox.middleware = new MiddlewareHandler(
    new DockerVerifyMiddleware(),
    new DockerLockMiddleware()
  );
};
