import { CommandInput, Middleware, SharedMiddlewareState } from "./types";

import * as fs from "fs";
import { print } from "gluegun";

export class DockerLockMiddleware implements Middleware {
  check(command: CommandInput, sharedState: SharedMiddlewareState): boolean {
    return ["build"].includes(command.name) && !sharedState.dockerLock;
  }

  async run(
    command: CommandInput, // eslint-disable-line @typescript-eslint/no-unused-vars
    sharedState: SharedMiddlewareState // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Partial<SharedMiddlewareState>> {
    return {
      dockerLock: new FileLock(__dirname + "/DOCKER_LOCK"),
    };
  }
}

export class FileLock {
  private readonly lockFilePath;

  constructor(lockFilePath: string) {
    this.lockFilePath = lockFilePath;
  }

  // request lock and wait until it is obtained
  async request(): Promise<void> {
    // wait for lock availability
    while (fs.existsSync(this.lockFilePath)) {
      // check if process holding the lock is still running
      const lockPid: string = await fs.promises.readFile(
        this.lockFilePath,
        "utf8"
      );
      const isRunning: boolean = this.isRunning(parseInt(lockPid));
      // if process is not running and file exists, the lock is orphaned and can be destroyed
      if (!isRunning) {
        try {
          await this.release();
          break;
        } catch (e) {
          // can ignore exception if cause is race condition
          if (!fs.existsSync(this.lockFilePath)) {
            throw e;
          }
        }
      }
      // sleep to wait for lock
      await new Promise((r) => setTimeout(r, 1000));
    }
    // try to get the lock, and recurse if another process gets the lock first.
    try {
      await fs.promises.writeFile(this.lockFilePath, `${process.pid}`, {
        flag: "wx",
      });
    } catch {
      return this.request();
    }
  }

  // release lock by deleting lock file
  async release(): Promise<void> {
    try {
      await fs.promises.unlink(this.lockFilePath);
    } catch {
      print.error("Tried to release a file lock that doesn't exist");
    }
  }

  // check if process is running
  private isRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return false;
    }
  }
}
