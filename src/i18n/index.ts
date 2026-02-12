import stringsKo from "./strings.ko.json";

type Params = Record<string, string | number>;

const table = stringsKo as Record<string, string>;
const formatter = new Intl.NumberFormat("ko-KR");

export function t(key: string, params?: Params): string {
  const template = table[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

export function formatNumber(value: number): string {
  return formatter.format(Math.round(value));
}
