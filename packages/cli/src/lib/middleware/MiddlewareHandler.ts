import { CommandInput, Middleware, SharedMiddlewareState } from "./types";

export class MiddlewareHandler {
  private _state: SharedMiddlewareState = {};
  private readonly _middleware: Middleware[] = [];

  constructor(...middleware: Middleware[]) {
    this._middleware = middleware;
  }

  async run(command: CommandInput): Promise<SharedMiddlewareState> {
    for (const ware of this._middleware) {
      if (
        ware.check === undefined ||
        ware.check({ ...command }, { ...this._state })
      ) {
        const stateUpdate: Partial<SharedMiddlewareState> = await ware.run(
          { ...command },
          {
            ...this._state,
          }
        );
        this._state = { ...this._state, ...stateUpdate };
      }
    }
    return this._state;
  }

  get state(): SharedMiddlewareState {
    return this._state;
  }

  get modules(): Middleware[] {
    return this._middleware;
  }
}
