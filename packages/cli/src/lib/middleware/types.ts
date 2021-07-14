export interface Middleware {
  /**
   * Invoked before each CLI command to determine whether run(...) should be called.
   * The middleware will run if check returns true or is undefined.
   *
   * @param command Contains the command name and options used to invoke the CLI.
   * @param sharedState A state object shared by all middleware and accessible
   * in the CLI.
   */
  check?: (
    command: CommandInput,
    sharedState: SharedMiddlewareState
  ) => boolean;
  /**
   * May be invoked by MiddlewareManager before each CLI command.
   *
   * @param command Contains the command name and options used to invoke the CLI.
   * @param sharedState A state object shared by all middleware and accessible
   * in the CLI.
   */
  run: (
    command: CommandInput,
    sharedState: SharedMiddlewareState
  ) => Promise<Partial<SharedMiddlewareState>>;
}

// TODO: How should the common middleware state be shaped?
export type SharedMiddlewareState = {
  [p: string]: unknown;
  // dockerPath: string;
  // myMiddleware: MyMiddlewareState;
};

export interface CommandInput {
  name: string;
  options: Record<string, unknown>;
}
