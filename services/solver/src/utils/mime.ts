/**
 * MIME type utilities.
 *
 * Maps file extensions to content types.
 */

/**
 * Extension to MIME type mapping.
 */
const MIME_TYPES: Record<string, string> = {
  ".json": "application/json",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".html": "text/html",
  ".xml": "application/xml",
  ".csv": "text/csv",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
};

/**
 * Default MIME type for unknown extensions.
 */
const DEFAULT_MIME_TYPE = "application/octet-stream";

/**
 * Gets the MIME type for a file based on extension.
 */
export function getMimeType(filePath: string): string {
  const match = /\.[^.]+$/.exec(filePath.toLowerCase());
  const ext = match?.[0];
  if (!ext) {
    return DEFAULT_MIME_TYPE;
  }
  return MIME_TYPES[ext] ?? DEFAULT_MIME_TYPE;
}
