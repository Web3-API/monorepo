export type MustacheFunction = () => (
  value: string,
  render: (template: string) => string
) => string;
