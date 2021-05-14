import {
  BasicTracerProvider,
  SimpleSpanProcessor,
  Tracer as otTracer,
} from "@opentelemetry/tracing";
import { ZipkinExporter } from "@opentelemetry/exporter-zipkin";
import { WebTracerProvider } from "@opentelemetry/web";
import * as api from "@opentelemetry/api";
import axios from "axios";

export type LogLevel = "debug" | "info" | "error" | "off";

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const inspect = require("util-inspect");

type MaybeAsync<T> = Promise<T> | T;

const isPromise = <T extends unknown>(
  test?: MaybeAsync<T>
): test is Promise<T> =>
  !!test && typeof (test as Promise<T>).then === "function";

export class Tracer {
  public static traceEnabled = false;
  public static logLevel: LogLevel;

  private static _tracer: otTracer;
  private static _provider:
    | WebTracerProvider
    | BasicTracerProvider
    | null = null;
  private static _spans: Array<api.Span> = [];

  static setTracing(tracerName: string): void {
    this.traceEnabled = true;
    this._initProvider();

    if (this._provider) {
      this._tracer = this._provider.getTracer(tracerName);
    }
  }

  static setLogLevel(newLogLevel: LogLevel): Promise<boolean> {
    if (newLogLevel == "off") this.traceEnabled = false;
    else this.traceEnabled = true;

    return new Promise<boolean>((resolve, reject) => {
      if (!process.env.TRACE_SERVER) {
        this.logLevel = newLogLevel;
        resolve(true);
      }

      const port = process.env.TRACE_SERVER_PORT || 4040;
      axios
        .post(`http://localhost:${port}/level`, {
          level: newLogLevel,
        })
        .then(() => {
          resolve(true);
        })
        .catch((err) => reject(err));
    });
  }

  static getLogLevel(): Promise<LogLevel> {
    return new Promise<LogLevel>((resolve, reject) => {
      if (!process.env.TRACE_SERVER) {
        resolve(this.logLevel);
      }

      const port = process.env.TRACE_SERVER_PORT || 4040;
      axios
        .get(`http://localhost:${port}/level`)
        .then((response) => {
          resolve(response.data);
        })
        .catch((err) => reject(err));
    });
  }

  static enableTracing(): void {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.setLogLevel("debug");
  }

  static disableTracing(): void {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.setLogLevel("off");
  }

  static startSpan(spanName: string): void {
    if (!this.traceEnabled) return;

    const currentSpan = this._currentSpan();
    const span = this._tracer.startSpan(
      spanName,
      {},
      currentSpan
        ? api.setSpanContext(api.context.active(), currentSpan.context())
        : undefined
    );
    this._pushSpan(span);
  }

  static endSpan(): void {
    if (!this.traceEnabled) return;

    const span = this._currentSpan();
    if (span) {
      span.end();
      this._popSpan();
    }
  }

  static setAttribute(attrName: string, data: unknown): void {
    if (!this.traceEnabled) return;

    const span = this._currentSpan();
    if (span) {
      span.setAttribute(attrName, JSON.stringify(inspect(data)));
    }
  }

  static addEvent(event: string, data?: unknown): void {
    if (!this.traceEnabled) return;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.getLogLevel().then((level) => {
      if (level == "error") {
        return;
      }

      const span = this._currentSpan();

      if (span) {
        span.addEvent(event, { data: JSON.stringify(inspect(data)) });
      }
    });
  }

  static recordException(error: api.Exception): void {
    if (!this.traceEnabled) return;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.getLogLevel().then((level) => {
      if (level == "info") return;

      const span = this._currentSpan();

      if (span) {
        // recordException converts the error into a span event.
        span.recordException(error);

        // If the exception means the operation results in an
        // error state, you can also use it to update the span status.
        span.setStatus({ code: api.SpanStatusCode.ERROR });
      }
    });
  }

  static traceFunc<TArgs extends Array<unknown>, TReturn>(
    span: string,
    func: (...args: TArgs) => TReturn
  ) {
    return (...args: TArgs): TReturn => {
      try {
        this.startSpan(span);
        this.setAttribute("input", { ...args });

        const result = func(...args);

        if (isPromise(result)) {
          return (result.then((result) => {
            this.setAttribute("output", result);
            this.endSpan();
            return result;
          }) as unknown) as TReturn;
        } else {
          this.setAttribute("output", result);
          this.endSpan();
          return result;
        }
      } catch (error) {
        this.recordException(error);
        this.endSpan();
        throw error;
      }
    };
  }

  static _initProvider(): void {
    if (this._provider) return;

    if (typeof window === "undefined") {
      this._provider = new BasicTracerProvider();
    } else {
      this._provider = new WebTracerProvider();
    }

    // Configure span processor to send spans to the exporter
    this._provider.addSpanProcessor(
      new SimpleSpanProcessor(new ZipkinExporter())
    );

    this._provider.register();
  }

  static _pushSpan(span: api.Span): void {
    this._spans.push(span);
  }

  static _currentSpan(): api.Span | undefined {
    return this._spans.slice(-1)[0];
  }

  static _popSpan(): void {
    this._spans.pop();
  }
}
