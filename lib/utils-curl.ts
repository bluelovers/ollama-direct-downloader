
export function _generateCurlCommand(url: string, filename: string) {
  return `curl -L "${url}" -o "${filename}"`;
}
