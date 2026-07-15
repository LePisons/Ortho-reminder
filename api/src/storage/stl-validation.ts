/**
 * Validates that a buffer is a real STL mesh (binary or ASCII), so a client
 * can't upload arbitrary files by lying about Content-Type or extension.
 *
 * Binary STL: 80-byte header + uint32 LE triangle count at offset 80, then
 * 50 bytes per triangle — total length must be exactly 84 + 50 * count.
 * ASCII STL: starts with "solid" and contains at least one "facet normal".
 */
export function isValidStl(buffer: Buffer): boolean {
  if (buffer.length < 84) {
    // Too small for binary; could still be a tiny ASCII file.
    return isAsciiStl(buffer);
  }

  const triangleCount = buffer.readUInt32LE(80);
  if (buffer.length === 84 + 50 * triangleCount && triangleCount > 0) {
    return true;
  }

  return isAsciiStl(buffer);
}

function isAsciiStl(buffer: Buffer): boolean {
  const head = buffer.toString('ascii', 0, Math.min(buffer.length, 512));
  if (!head.trimStart().toLowerCase().startsWith('solid')) return false;
  // Scan the whole file as ascii only if the header looks right.
  return buffer.toString('ascii').includes('facet normal');
}
