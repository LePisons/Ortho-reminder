/**
 * Formats a given string into a valid Chilean RUT format: XX.XXX.XXX-X
 * Strips out invalid characters and automatically calculates the correct dash placement.
 * 
 * @param rut The unformatted or partially formatted RUT string.
 * @returns The formatted RUT string, or the original string if it cannot be formatted.
 */
export function formatRut(rut: string): string {
  if (!rut) return "";

  // 1. Remove all non-alphanumeric characters (keep numbers and 'k'/'K')
  const cleanRut = rut.replace(/[^0-9kK]/g, "").toUpperCase();

  if (cleanRut.length === 0) return "";
  
  // If the user only typed one character, return it directly
  if (cleanRut.length === 1) return cleanRut;

  // 2. Separate the verifier digit from the body
  const verifier = cleanRut.slice(-1);
  let body = cleanRut.slice(0, -1);

  // 3. Format the body with dot separators (thousands)
  let formattedBody = "";
  while (body.length > 3) {
    formattedBody = "." + body.slice(-3) + formattedBody;
    body = body.slice(0, -3);
  }
  formattedBody = body + formattedBody;

  // 4. Combine everything
  return `${formattedBody}-${verifier}`;
}
