import { fetchTestCases } from "./index";
import { readDirectory } from "../utils/fs";
import { alphabeticalNamedSort } from "../utils/sort";
import { bindSchema, OutputEntry, TargetLanguage } from "../";

describe("Web3API Binding Test Suite", () => {
  const cases = fetchTestCases();

  for (const test of cases) {
    it(`Case: ${test.name}`, async () => {
      const testCase = await test.promise;

      if (!testCase) {
        return;
      }

      // For each language
      for (const outputLanguage of testCase.outputLanguages) {
        // Verify it binds correctly
        const { language, directories } = outputLanguage;
        // Read the expected output directories
        const expectedOutput = {
          query: directories.query
            ? readDirectory(directories.query)
            : undefined,
          mutation: directories.mutation
            ? readDirectory(directories.mutation)
            : undefined,
        };

        const output = bindSchema({
          language: language as TargetLanguage,
          query: testCase.input.query,
          mutation: testCase.input.mutation,
        });

        const sort = (array: OutputEntry[]): OutputEntry[] => {
          array.forEach((entry) => {
            if (typeof entry.data !== "string") entry.data = sort(entry.data);
          });

          return array.sort(alphabeticalNamedSort);
        };

        if (output.query) {
          output.query.entries = sort(output.query.entries);
        }

        if (output.mutation) {
          output.mutation.entries = sort(output.mutation.entries);
        }

        expect(output).toMatchObject(expectedOutput);
      }
    });
  }
});
