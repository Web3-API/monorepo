export function filterResults(result: Record<string, any>, filter: Record<string, any>): Record<string, any> {
  const filtered: Record<string, any> = { };

  for (const key of Object.keys(filter)) {
    if (result[key]) {
      if (typeof filter[key] === "boolean") {
        filtered[key] = result[key];
      } else {
        filtered[key] = filterResults(result[key], filter[key]);
      }
    }
  }

  return filtered;
}