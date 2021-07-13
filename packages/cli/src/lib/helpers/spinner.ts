import * as gluegun from "gluegun";
import { Ora } from "ora";

// Executes the function `f` in a command-line spinner, using the
// provided captions for in-progress, error and failed messages.
//
// If `f` throws an error, the spinner stops with the failure message
//   and rethrows the error.
// If `f` returns an object with a `warning` and a `result` key, the
//   spinner stops with the warning message and returns the `result` value.
// Otherwise the spinner prints the in-progress message with a check mark
//   and simply returns the value returned by `f`.
export const withSpinner = async <TReturn>(
  text: string,
  errorText: string,
  warningText: string,
  execute: (spinner: Ora) => Promise<TReturn>
): Promise<TReturn> => {
  const spinner = gluegun.print.spin({
    text,
    stream: process.stdout,
  });
  try {
    const result = await execute(spinner);
    if (result && typeof result === "object") {
      const res = result as Record<string, unknown>;
      const hasWarning = !!res.warning;
      const hasResult = !!res.result;
      if (hasWarning && hasResult) {
        if (res.warning !== null) {
          spinner.warn(`${warningText}: ${res.warning}`);
        }
        spinner.succeed(text);
        return res.result as TReturn;
      } else {
        spinner.succeed(text);
        return result;
      }
    } else {
      spinner.succeed(text);
      return result;
    }
  } catch (e) {
    spinner.fail(`${errorText}: ${e.message}`);
    throw e;
  }
};

export const step = (spinner: Ora, subject: string, text?: string): unknown => {
  if (text) {
    spinner.stopAndPersist({
      text: gluegun.print.colors.muted(`${subject} ${text}`),
    });
  } else {
    spinner.stopAndPersist({ text: gluegun.print.colors.muted(subject) });
  }
  spinner.start();
  return spinner;
};
