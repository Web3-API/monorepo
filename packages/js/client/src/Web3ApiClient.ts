import { getDefaultClientConfig } from "./default-client-config";
import { PluginWeb3Api } from "./plugin/PluginWeb3Api";
import { WasmWeb3Api } from "./wasm/WasmWeb3Api";

import {
  Api,
  ApiCache,
  Client,
  createQueryDocument,
  parseQuery,
  PluginPackage,
  QueryApiOptions,
  QueryApiResult,
  Uri,
  UriRedirect,
  InterfaceImplementations,
  PluginRegistration,
  resolveUri,
  InvokeApiOptions,
  InvokeApiResult,
  Web3ApiManifest,
  sanitizeUriRedirects,
  sanitizeInterfaceImplementations,
  sanitizePluginRegistrations,
  getImplementations,
  Subscription,
  SubscribeOptions,
} from "@web3api/core-js";
import { Tracer } from "@web3api/tracing-js";

export interface ClientConfig<TUri = string> {
  redirects?: UriRedirect<TUri>[];
  plugins?: PluginRegistration<TUri>[];
  interfaces?: InterfaceImplementations<TUri>[];
  tracingEnabled?: boolean;
}

export class Web3ApiClient implements Client {
  // TODO: the API cache needs to be more like a routing table.
  // It should help us keep track of what URI's map to what APIs,
  // and handle cases where the are multiple jumps. For example, if
  // A => B => C, then the cache should have A => C, and B => C.
  private _apiCache: ApiCache = new Map<string, Api>();
  private _config: Required<ClientConfig<Uri>> = {
    redirects: [],
    plugins: [],
    interfaces: [],
    tracingEnabled: false,
  };

  constructor(config?: ClientConfig) {
    try {
      this.tracingEnabled(!!config?.tracingEnabled);

      Tracer.startSpan("Web3ApiClient: constructor");

      if (config) {
        this._config = {
          redirects: config.redirects
            ? sanitizeUriRedirects(config.redirects)
            : [],
          plugins: config.plugins
            ? sanitizePluginRegistrations(config.plugins)
            : [],
          interfaces: config.interfaces
            ? sanitizeInterfaceImplementations(config.interfaces)
            : [],
          tracingEnabled: !!config.tracingEnabled,
        };
      }

      // Add the default config
      const defaultClientConfig = getDefaultClientConfig();

      if (defaultClientConfig.redirects) {
        this._config.redirects.push(...defaultClientConfig.redirects);
      }

      if (defaultClientConfig.plugins) {
        this._config.plugins.push(...defaultClientConfig.plugins);
      }

      if (defaultClientConfig.interfaces) {
        this._config.interfaces.push(...defaultClientConfig.interfaces);
      }

      this.requirePluginsToUseNonInterfaceUris();

      Tracer.setAttribute("config", this._config);
    } catch (error) {
      Tracer.recordException(error);
      throw error;
    } finally {
      Tracer.endSpan();
    }
  }

  public tracingEnabled(enable: boolean): void {
    if (enable) {
      Tracer.enableTracing("Web3ApiClient");
    } else {
      Tracer.disableTracing();
    }

    this._config.tracingEnabled = enable;
  }

  public redirects(): readonly UriRedirect<Uri>[] {
    return this._config.redirects || [];
  }

  public plugins(): readonly PluginRegistration<Uri>[] {
    return this._config.plugins || [];
  }

  public interfaces(): readonly InterfaceImplementations<Uri>[] {
    return this._config.interfaces || [];
  }

  public async query<
    TData extends Record<string, unknown> = Record<string, unknown>,
    TVariables extends Record<string, unknown> = Record<string, unknown>
  >(
    options: QueryApiOptions<TVariables, string>
  ): Promise<QueryApiResult<TData>>;
  public async query<
    TData extends Record<string, unknown> = Record<string, unknown>,
    TVariables extends Record<string, unknown> = Record<string, unknown>
  >(options: QueryApiOptions<TVariables, Uri>): Promise<QueryApiResult<TData>>;
  public async query<
    TData extends Record<string, unknown> = Record<string, unknown>,
    TVariables extends Record<string, unknown> = Record<string, unknown>
  >(
    options: QueryApiOptions<TVariables, string | Uri>
  ): Promise<QueryApiResult<TData>> {
    let typedOptions: QueryApiOptions<TVariables, Uri>;

    if (typeof options.uri === "string") {
      typedOptions = {
        ...options,
        uri: new Uri(options.uri),
      };
    } else {
      typedOptions = options as QueryApiOptions<TVariables, Uri>;
    }

    const run = Tracer.traceFunc(
      "Web3ApiClient: query",
      async (
        options: QueryApiOptions<TVariables, Uri>
      ): Promise<QueryApiResult<TData>> => {
        const { uri, query, variables } = options;

        // Convert the query string into a query document
        const queryDocument =
          typeof query === "string" ? createQueryDocument(query) : query;

        // Parse the query to understand what's being invoked
        const queryInvocations = parseQuery(uri, queryDocument, variables);

        // Execute all invocations in parallel
        const parallelInvocations: Promise<{
          name: string;
          result: InvokeApiResult<unknown>;
        }>[] = [];

        for (const invocationName of Object.keys(queryInvocations)) {
          parallelInvocations.push(
            this.invoke({
              ...queryInvocations[invocationName],
              uri: queryInvocations[invocationName].uri,
              decode: true,
            }).then((result) => ({
              name: invocationName,
              result,
            }))
          );
        }

        // Await the invocations
        const invocationResults = await Promise.all(parallelInvocations);

        Tracer.addEvent("invocationResults", invocationResults);

        // Aggregate all invocation results
        const data: Record<string, unknown> = {};
        const errors: Error[] = [];

        for (const invocation of invocationResults) {
          data[invocation.name] = invocation.result.data;
          if (invocation.result.error) {
            errors.push(invocation.result.error);
          }
        }

        return {
          data: data as TData,
          errors: errors.length === 0 ? undefined : errors,
        };
      }
    );

    return await run(typedOptions).catch((error) => {
      if (error.length) {
        return { errors: error };
      } else {
        return { errors: [error] };
      }
    });
  }

  public async invoke<TData = unknown>(
    options: InvokeApiOptions<string>
  ): Promise<InvokeApiResult<TData>>;
  public async invoke<TData = unknown>(
    options: InvokeApiOptions<Uri>
  ): Promise<InvokeApiResult<TData>>;
  public async invoke<TData = unknown>(
    options: InvokeApiOptions<string | Uri>
  ): Promise<InvokeApiResult<TData>> {
    let typedOptions: InvokeApiOptions<Uri>;

    if (typeof options.uri === "string") {
      typedOptions = {
        ...options,
        uri: new Uri(options.uri),
      };
    } else {
      typedOptions = options as InvokeApiOptions<Uri>;
    }

    const run = Tracer.traceFunc(
      "Web3ApiClient: invoke",
      async (
        options: InvokeApiOptions<Uri>
      ): Promise<InvokeApiResult<TData>> => {
        const api = await this.loadWeb3Api(options.uri);

        const result = (await api.invoke(options, this)) as TData;

        return result;
      }
    );

    return run(typedOptions);
  }

  public subscribe<
    TData extends Record<string, unknown> = Record<string, unknown>,
    TVariables extends Record<string, unknown> = Record<string, unknown>
  >(options: SubscribeOptions<TVariables, string>): Subscription<TData>;
  public subscribe<
    TData extends Record<string, unknown> = Record<string, unknown>,
    TVariables extends Record<string, unknown> = Record<string, unknown>
  >(options: SubscribeOptions<TVariables, Uri>): Subscription<TData>;
  public subscribe<
    TData extends Record<string, unknown> = Record<string, unknown>,
    TVariables extends Record<string, unknown> = Record<string, unknown>
  >(options: SubscribeOptions<TVariables, string | Uri>): Subscription<TData> {
    let typedOptions: SubscribeOptions<TVariables, Uri>;
    if (typeof options.uri === "string") {
      typedOptions = {
        ...options,
        uri: new Uri(options.uri),
      };
    } else {
      typedOptions = options as QueryApiOptions<TVariables, Uri>;
    }

    const run = Tracer.traceFunc(
      "Web3ApiClient: subscribe",
      (options: SubscribeOptions<TVariables, Uri>): Subscription<TData> => {
        const { uri, query, variables, frequency: freq } = options;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const client: Web3ApiClient = this;
        // calculate interval between queries, in milliseconds, 1 min default value
        /* eslint-disable prettier/prettier */
        let frequency: number;
        if (freq && (freq.ms || freq.sec || freq.min || freq.hours)) {
          frequency = (freq.ms ?? 0) + (
            (freq.hours ?? 0) * 3600 +
            (freq.min ?? 0) * 60 +
            (freq.sec ?? 0)
          ) * 1000
        } else {
          frequency = 60000;
        }
        /* eslint-enable  prettier/prettier */

        const subscription: Subscription<TData> = {
          frequency: frequency,
          isActive: false,
          stop(): void {
            subscription.isActive = false;
          },
          async *[Symbol.asyncIterator](): AsyncGenerator<
            QueryApiResult<TData>
          > {
            subscription.isActive = true;
            let timeout: NodeJS.Timeout | undefined = undefined;
            try {
              let readyVals = 0;
              let sleep: ((value?: unknown) => void) | undefined;
              timeout = setInterval(async () => {
                readyVals++;
                if (sleep) {
                  sleep();
                  sleep = undefined;
                }
              }, frequency);

              while (subscription.isActive) {
                if (readyVals === 0) {
                  await new Promise((r) => (sleep = r));
                }
                for (; readyVals > 0; readyVals--) {
                  if (!subscription.isActive) break;
                  const result: QueryApiResult<TData> = await client.query({
                    uri: uri,
                    query: query,
                    variables: variables,
                  });
                  yield result;
                }
              }
            } finally {
              if (timeout) {
                clearInterval(timeout);
              }
              subscription.isActive = false;
            }
          },
        };

        return subscription;
      }
    );

    return run(typedOptions);
  }

  public async loadWeb3Api(uri: string): Promise<Api>;
  public async loadWeb3Api(uri: Uri): Promise<Api>;
  public async loadWeb3Api(uri: string | Uri): Promise<Api> {
    const typedUri = typeof uri === "string" ? new Uri(uri) : uri;

    const run = Tracer.traceFunc(
      "Web3ApiClient: loadWeb3Api",
      async (uri: Uri): Promise<Api> => {
        let api = this._apiCache.get(uri.uri);

        if (!api) {
          api = await resolveUri(
            uri,
            this,
            this.redirects(),
            this.plugins(),
            this.interfaces(),
            (uri: Uri, plugin: PluginPackage) => new PluginWeb3Api(uri, plugin),
            (uri: Uri, manifest: Web3ApiManifest, uriResolver: Uri) =>
              new WasmWeb3Api(uri, manifest, uriResolver)
          );

          if (!api) {
            throw Error(`Unable to resolve Web3API at uri: ${uri}`);
          }

          this._apiCache.set(uri.uri, api);
        }

        return api;
      }
    );

    return run(typedUri);
  }

  public getImplementations(
    uri: string,
    filters?: { applyRedirects: boolean }
  ): string[];
  public getImplementations(
    uri: Uri,
    filters?: { applyRedirects: boolean }
  ): Uri[];
  public getImplementations(
    uri: string | Uri,
    filters: { applyRedirects: boolean } = { applyRedirects: false }
  ): (string | Uri)[] {
    const isUriTypeString = typeof uri === "string";

    const typedUri: Uri = isUriTypeString
      ? new Uri(uri as string)
      : (uri as Uri);

    const getImplementationsWithoutRedirects = Tracer.traceFunc(
      "Web3ApiClient: getImplementations - getImplementationsWithoutRedirects",
      (uri: Uri): (string | Uri)[] => {
        const interfaceImplementations = this.interfaces().find((x) =>
          Uri.equals(x.interface, uri)
        );

        if (!interfaceImplementations) {
          throw Error(`Interface: ${uri} has no implementations registered`);
        }

        return isUriTypeString
          ? interfaceImplementations.implementations.map((x) => x.uri)
          : interfaceImplementations.implementations;
      }
    );

    const getImplementationsWithRedirects = Tracer.traceFunc(
      "Web3ApiClient: getImplementations - getImplementationsWithRedirects",
      (uri: Uri): (string | Uri)[] => {
        return isUriTypeString
          ? getImplementations(uri, this.redirects(), this.interfaces()).map(
              (x) => x.uri
            )
          : getImplementations(uri, this.redirects(), this.interfaces());
      }
    );

    return filters.applyRedirects
      ? getImplementationsWithRedirects(typedUri)
      : getImplementationsWithoutRedirects(typedUri);
  }

  private requirePluginsToUseNonInterfaceUris(): void {
    const pluginUris = this.plugins().map((x) => x.uri.uri);
    const interfaceUris = this.interfaces().map((x) => x.interface.uri);

    const pluginsWithInterfaceUris = pluginUris.filter((plugin) =>
      interfaceUris.includes(plugin)
    );

    if (pluginsWithInterfaceUris.length) {
      throw Error(
        `Plugins can't use interfaces for their URI. Invalid plugins: ${pluginsWithInterfaceUris}`
      );
    }
  }
}
