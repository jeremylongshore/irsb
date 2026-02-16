/**
 * ERC-8004 Register Command Stub
 *
 * Stub implementation of the registration command.
 * Generates registration payload and prints what would be sent.
 * No actual chain interaction.
 */

import {
  generateRegistration,
  formatDryRunOutput,
  serializeRegistration,
} from "./registration.js";

/**
 * Options for the register command.
 */
export interface RegisterCommandOptions {
  /** Base URL where the agent is hosted */
  baseUrl: string;
  /** Dry run mode (always true for stub) */
  dryRun: boolean;
  /** Output format */
  format?: "text" | "json";
}

/**
 * Result of the register command.
 */
export interface RegisterCommandResult {
  /** Whether the command succeeded */
  success: boolean;
  /** Output message */
  output: string;
  /** Exit code */
  exitCode: number;
}

/**
 * Executes the register command (stub).
 *
 * In dry-run mode (the only mode currently supported):
 * - Generates registration.json
 * - Prints what would be sent
 * - Returns success
 *
 * @param options - Command options
 * @returns Command result
 */
export function executeRegisterCommand(
  options: RegisterCommandOptions
): RegisterCommandResult {
  // Validate dry-run requirement
  if (!options.dryRun) {
    return {
      success: false,
      output:
        "Error: Only --dry-run mode is supported in this stub implementation.\n" +
        "Chain registration will be implemented in Phase 8+.",
      exitCode: 1,
    };
  }

  try {
    // Generate registration payload
    const payload = generateRegistration({
      baseUrl: options.baseUrl,
    });

    // Format output based on requested format
    let output: string;
    if (options.format === "json") {
      output = serializeRegistration(payload);
    } else {
      output = formatDryRunOutput(payload);
    }

    return {
      success: true,
      output,
      exitCode: 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      output: `Error generating registration: ${message}`,
      exitCode: 1,
    };
  }
}
