#!/usr/bin/env node
/**
 * IRSB Solver CLI
 *
 * Commands:
 * - check-config: Validate configuration
 * - print-intent <path>: Print normalized intent with intentId
 * - run-fixture <path>: Validate, policy gate, execute, print result
 * - make-evidence <runDir>: Create evidence bundle for a run
 * - validate-evidence <path>: Validate evidence bundle integrity
 * - erc8004:register --dry-run: Generate and display registration payload (stub)
 */

import { Command } from "commander";
import { join, sep } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { ZodError } from "zod";
import { loadConfig, configSummary, type ResolvedConfig } from "./config.js";
import { normalizeIntent, computeIntentId } from "./intent/normalize.js";
import { evaluatePolicy, createRefusalRecord } from "./policy/policy.js";
import { createExecutionPlan, formatExecutionPlan } from "./plan/plan.js";
import { appendJsonl } from "./storage/jsonl.js";
import { createRunContext } from "./execution/runContext.js";
import { getRunner } from "./execution/registry.js";
import { canonicalJson } from "./utils/canonicalJson.js";
import {
  createEvidenceBundle,
  validateEvidenceBundle,
  validateManifestFile,
  readManifest,
} from "./evidence/index.js";
import { executeRegisterCommand } from "./erc8004/index.js";
import {
  initLogger,
  getLogger,
  withContext,
  summarizeInputs,
  logError,
  recordIntentReceived,
  recordRefusal,
  recordRunSuccess,
  recordRunFailure,
  recordError,
} from "./obs/index.js";
import type { NormalizedIntent } from "./types/intent.js";
import type { RunResult } from "./execution/jobRunner.js";

/**
 * Formats an error for CLI output.
 * Provides detailed output for ZodError validation failures.
 */
function formatError(error: unknown): string {
  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `  - ${path}: ${issue.message}`;
    });
    return `Validation failed:\n${issues.join("\n")}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Formats a run result for stable output (no timestamps).
 */
function formatRunResult(result: RunResult): string {
  // Use canonical JSON for stable output
  return canonicalJson(result);
}

const program = new Command();

program
  .name("irsb-solver")
  .description("Reference solver/executor for IRSB protocol")
  .version("0.1.0");

/**
 * check-config command
 */
program
  .command("check-config")
  .description("Validate configuration and print summary")
  .action(() => {
    try {
      const config = loadConfig();
      console.log("Configuration valid.\n");
      console.log(JSON.stringify(configSummary(config), null, 2));
      process.exit(0);
    } catch (error) {
      console.error("Configuration error:");
      console.error(formatError(error));
      process.exit(1);
    }
  });

/**
 * print-intent command
 */
program
  .command("print-intent")
  .description("Print normalized intent with computed intentId")
  .argument("<path>", "Path to intent JSON file")
  .action((path: string) => {
    try {
      const json = readFileSync(path, "utf8");
      const parsed = JSON.parse(json) as unknown;
      const normalized = normalizeIntent(parsed);

      console.log("Normalized Intent:");
      console.log(JSON.stringify(normalized, null, 2));
      console.log(`\nintentId: ${normalized.intentId}`);

      // Also show the computed ID to verify determinism
      const computedId = computeIntentId(normalized);
      if (normalized.intentId !== computedId) {
        console.log(`\nNote: Provided intentId differs from computed:`);
        console.log(`  provided: ${normalized.intentId}`);
        console.log(`  computed: ${computedId}`);
      }

      process.exit(0);
    } catch (error) {
      console.error("Error processing intent:");
      console.error(formatError(error));
      process.exit(1);
    }
  });

/**
 * run-fixture command
 */
program
  .command("run-fixture")
  .description("Validate intent, apply policy gate, execute job, print result")
  .argument("<path>", "Path to intent JSON file")
  .option("--dry-run", "Skip execution, only show plan")
  .action(async (path: string, options: { dryRun?: boolean }) => {
    let config: ResolvedConfig;
    let normalized: NormalizedIntent;
    const startTime = Date.now();

    // Load config and initialize logger
    try {
      config = loadConfig();
      initLogger(config.LOG_LEVEL);
    } catch (error) {
      console.error("Configuration error:");
      console.error(formatError(error));
      process.exit(1);
    }

    // Logger initialized, ready for use
    getLogger();

    // Load and normalize intent
    try {
      const json = readFileSync(path, "utf8");
      const parsed = JSON.parse(json) as unknown;
      normalized = normalizeIntent(parsed);
    } catch (error) {
      console.error("Error processing intent:");
      console.error(formatError(error));
      recordError("intent_parse");
      process.exit(1);
    }

    // Record intent received
    recordIntentReceived();

    // Create correlation context for logging
    const ctx = {
      intentId: normalized.intentId,
      jobType: normalized.jobType,
    };
    const logger = withContext(ctx);

    logger.info(
      { inputs: summarizeInputs(normalized.inputs as Record<string, unknown>) },
      "Intent received"
    );

    // Evaluate policy
    const policyResult = evaluatePolicy(normalized, config);

    // Create execution plan
    const plan = createExecutionPlan(normalized, config, policyResult);

    // Update context with runId
    const runCtx = { ...ctx, runId: plan.runId };
    const runLogger = withContext(runCtx);

    // Print plan
    console.log(formatExecutionPlan(plan));
    console.log("");

    // If refused, write refusal record
    if (!policyResult.allowed) {
      runLogger.warn(
        { reasons: policyResult.reasons },
        "Intent refused by policy"
      );
      recordRefusal(normalized.jobType);

      const refusalRecord = createRefusalRecord(
        normalized,
        plan.runId,
        policyResult.reasons
      );

      try {
        appendJsonl(config.REFUSALS_PATH, refusalRecord);
        console.log(`Refusal recorded to: ${config.REFUSALS_PATH}`);
      } catch (error) {
        logError(runLogger, error, "Error writing refusal record", runCtx);
      }

      process.exit(2); // Exit code 2 for policy refusal
    }

    // Dry run mode - stop here
    if (options.dryRun) {
      runLogger.info("Dry run mode - skipping execution");
      console.log("Dry run mode - skipping execution.");
      process.exit(0);
    }

    // Execute the job
    runLogger.info("Starting job execution");
    console.log("Executing job...");
    console.log("");

    try {
      // Create run context
      const execCtx = createRunContext({
        intentId: normalized.intentId,
        runId: plan.runId,
        jobType: normalized.jobType,
        dataDir: config.DATA_DIR,
        requester: normalized.requester,
      });

      // Get the runner
      const runner = getRunner(normalized.jobType);

      // Execute
      const result = await runner.run(normalized.inputs, execCtx);
      const durationMs = Date.now() - startTime;

      // Print result (stable JSON output)
      console.log("Run Result:");
      console.log(formatRunResult(result));
      console.log("");

      if (result.status === "SUCCESS") {
        runLogger.info(
          {
            status: result.status,
            durationMs,
            artifactCount: result.artifacts.length,
          },
          "Job completed successfully"
        );

        console.log(`Artifacts written to: ${execCtx.artifactsDir}`);
        for (const artifact of result.artifacts) {
          console.log(`  - ${artifact.path} (${String(artifact.bytes)} bytes)`);
        }

        // Create evidence bundle
        console.log("");
        console.log("Creating evidence bundle...");
        const runDir = join(config.DATA_DIR, "runs", plan.runId);
        const evidenceResult = await createEvidenceBundle({
          runDir,
          intentId: normalized.intentId,
          runId: plan.runId,
          jobType: normalized.jobType,
          policyDecision: {
            allowed: policyResult.allowed,
            reasons: policyResult.reasons,
          },
          executionSummary: {
            status: result.status,
          },
        });

        // Record metrics
        recordRunSuccess(normalized.jobType, durationMs);

        runLogger.info(
          { manifestSha256: evidenceResult.manifestSha256 },
          "Evidence bundle created"
        );

        console.log(`Evidence manifest: ${evidenceResult.manifestPath}`);
        console.log(`manifestSha256: ${evidenceResult.manifestSha256}`);
        process.exit(0);
      } else {
        runLogger.error(
          { status: result.status, error: result.error, durationMs },
          "Job execution failed"
        );
        recordRunFailure(normalized.jobType, durationMs, "execution_failed");
        console.error(`Execution failed: ${result.error ?? "Unknown error"}`);
        process.exit(3); // Exit code 3 for execution failure
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logError(runLogger, error, "Execution error", runCtx);
      recordRunFailure(normalized.jobType, durationMs, "exception");
      console.error("Execution error:");
      console.error(formatError(error));
      process.exit(3);
    }
  });

/**
 * make-evidence command
 */
program
  .command("make-evidence")
  .description("Create evidence bundle for an existing run")
  .argument("<runDir>", "Path to run directory")
  .action(async (runDir: string) => {
    try {
      // Read manifest info from existing manifest if present, or infer from path
      const manifestPath = join(runDir, "evidence", "manifest.json");
      let intentId = "unknown";
      let runId = "unknown";
      let jobType = "unknown";

      // Try to extract runId from path (use path.sep for cross-platform)
      const pathParts = runDir.split(sep);
      const runsIdx = pathParts.lastIndexOf("runs");
      if (runsIdx !== -1 && runsIdx < pathParts.length - 1) {
        const extractedRunId = pathParts[runsIdx + 1];
        if (extractedRunId) {
          runId = extractedRunId;
        }
      }

      // If manifest exists, read metadata from it
      if (existsSync(manifestPath)) {
        const existing = readManifest(manifestPath);
        intentId = existing.intentId;
        runId = existing.runId;
        jobType = existing.jobType;
      }

      const result = await createEvidenceBundle({
        runDir,
        intentId,
        runId,
        jobType,
        policyDecision: { allowed: true, reasons: [] },
        executionSummary: { status: "SUCCESS" },
      });

      console.log("Evidence bundle created.");
      console.log(`  Manifest: ${result.manifestPath}`);
      console.log(`  manifestSha256: ${result.manifestSha256}`);
      console.log("");
      console.log("Artifacts:");
      for (const artifact of result.manifest.artifacts) {
        console.log(`  - ${artifact.path} (${String(artifact.bytes)} bytes)`);
      }
      process.exit(0);
    } catch (error) {
      console.error("Error creating evidence bundle:");
      console.error(formatError(error));
      process.exit(1);
    }
  });

/**
 * validate-evidence command
 */
program
  .command("validate-evidence")
  .description("Validate evidence bundle integrity")
  .argument("<path>", "Path to run directory or manifest file")
  .action(async (path: string) => {
    try {
      // Determine if path is a run directory or manifest file
      const isManifestFile = path.endsWith("manifest.json");
      const result = isManifestFile
        ? await validateManifestFile(path)
        : await validateEvidenceBundle(path);

      if (result.valid) {
        console.log("Evidence bundle valid.");
        if (result.manifest) {
          console.log(`  intentId: ${result.manifest.intentId}`);
          console.log(`  runId: ${result.manifest.runId}`);
          console.log(`  jobType: ${result.manifest.jobType}`);
          console.log(`  artifacts: ${String(result.manifest.artifacts.length)}`);
        }
        process.exit(0);
      } else {
        console.error("Evidence bundle validation failed:");
        for (const error of result.errors) {
          const pathInfo = error.path ? ` [${error.path}]` : "";
          console.error(`  - [${error.code}]${pathInfo}: ${error.message}`);
        }
        process.exit(1);
      }
    } catch (error) {
      console.error("Validation error:");
      console.error(formatError(error));
      process.exit(1);
    }
  });

/**
 * erc8004:register command (stub)
 *
 * Generates registration.json and displays what would be sent.
 * No actual chain interaction - dry-run only.
 */
program
  .command("erc8004:register")
  .description("Generate ERC-8004 registration payload (stub - dry-run only)")
  .option("--dry-run", "Dry run mode (required for stub)", true)
  .option("--base-url <url>", "Base URL where agent is hosted", "http://localhost:8080")
  .option("--format <format>", "Output format: text or json", "text")
  .action((options: { dryRun: boolean; baseUrl: string; format: string }) => {
    // Validate format option
    if (options.format !== "text" && options.format !== "json") {
      console.error(
        `error: option '--format <format>' invalid choice: ${options.format} (choose from 'text', 'json')`
      );
      process.exit(1);
    }

    const result = executeRegisterCommand({
      baseUrl: options.baseUrl,
      dryRun: options.dryRun,
      format: options.format,
    });

    if (result.success) {
      console.log(result.output);
      process.exit(result.exitCode);
    } else {
      console.error(result.output);
      process.exit(result.exitCode);
    }
  });

// Parse and run
program.parse();
