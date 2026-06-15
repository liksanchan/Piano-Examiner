import { spawn } from "child_process";
import path from "path";
import type { AnalysisMetrics } from "@/lib/evaluation/types";

const PIPELINE_TIMEOUT_MS = 10 * 60 * 1000;

function resolvePythonCommand() {
  const configured = process.env.PYTHON_PATH ?? "python";
  const parts = configured.trim().split(/\s+/);

  if (parts[0] === "py" && parts[1]) {
    return { command: "py", prefixArgs: [parts[1]] };
  }

  return { command: configured, prefixArgs: [] as string[] };
}

export async function runAnalysisPipeline(
  referenceAudioPath: string,
  studentAudioPath: string,
): Promise<AnalysisMetrics> {
  const scriptPath = path.join(process.cwd(), "python", "evaluate.py");
  const { command, prefixArgs } = resolvePythonCommand();

  return new Promise((resolve, reject) => {
    const proc = spawn(
      command,
      [
        ...prefixArgs,
        scriptPath,
        "--reference",
        referenceAudioPath,
        "--student",
        studentAudioPath,
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        windowsHide: true,
      },
    );

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      proc.kill();
      reject(
        new Error(
          "Analysis timed out after 10 minutes. Try shorter recordings or check Python setup.",
        ),
      );
    }, PIPELINE_TIMEOUT_MS);

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          `Could not start Python (${command}). Install Python 3.12 and run: py -3.12 -m pip install -r python/requirements-windows.txt. ${err.message}`,
        ),
      );
    });

    proc.on("close", (code, signal) => {
      clearTimeout(timer);

      if (code !== 0) {
        let message = stderr.trim() || `Python pipeline exited with code ${code ?? "unknown"}`;

        if (code === 137 || signal === "SIGKILL") {
          message =
            "Analysis ran out of memory. Try a shorter recording (under 2 minutes), or use a paid Render plan with more RAM.";
        }

        try {
          const parsed = JSON.parse(stderr) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          // use raw stderr
        }

        if (message.includes("Audio file not found")) {
          message +=
            " On Render's free tier, uploads can be lost after a redeploy — re-upload the reference and record again.";
        }

        reject(new Error(message));
        return;
      }

      try {
        const metrics = JSON.parse(stdout) as AnalysisMetrics;
        resolve(metrics);
      } catch {
        reject(new Error(`Invalid pipeline output: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

