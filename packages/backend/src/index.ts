import { accessSync, constants, readdirSync, statSync } from "fs";
import os from "os";

import type { DefineAPI, DefineEvents, SDK } from "caido:plugin";

export type BackendEvents = DefineEvents<{
  "bytecap:threshold-alert": (alert: {
    type: "error" | "warning";
    message: string;
  }) => void;
  "bytecap:file-scan-complete": (summary: {
    fileCount: number;
    caidoFileCount: number;
    totalSize: string;
    caidoTotalSize: string;
  }) => void;
}>;

interface FileInfo {
  name: string;
  size: number;
  sizeFormatted: string;
}

interface DirectoryInfo {
  files: FileInfo[];
  totalSize: number;
  totalSizeFormatted: string;
  scanPath: string;
  caidoFiles: FileInfo[];
  caidoTotalSize: number;
  caidoTotalSizeFormatted: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Check if path exists using accessSync
const pathExists = (path: string): boolean => {
  try {
    accessSync(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

// Get the Caido projects directory based on OS
const getCaidoProjectsDir = (): string => {
  const platform = os.platform();
  const home = os.homedir();

  switch (platform) {
    case "darwin": // macOS
      return `${home}/Library/Application Support/io.caido.Caido/projects`;
    case "linux":
      return `${home}/.local/share/caido/projects`;
    case "win32":
      return `${home}/caido/Caido/data/projects`;
    default:
      return `${home}/projects`;
  }
};

// Expand path with tilde and handle spaces
const expandPath = (inputPath: string): string => {
  let path = inputPath.trim();

  // Handle tilde expansion
  if (path.startsWith("~")) {
    const home = os.homedir();
    path = path.replace("~", home);
  }

  // Remove backslashes used to escape spaces (for copy-paste from terminal)
  path = path.replace(/\\\\ /g, " ");

  return path;
};

const getWorkspaceFiles = async (
  sdk: BytecapBackendSDK,
  workspacePath?: string,
): Promise<DirectoryInfo> => {
  try {
    let path: string;

    if (
      workspacePath !== null &&
      workspacePath !== undefined &&
      workspacePath.length > 0
    ) {
      path = expandPath(workspacePath);
      sdk.console.log(`Using custom path: ${path}`);
    } else {
      // Try to use the Caido projects directory
      const project = await sdk.projects.getCurrent();
      if (!project) {
        return {
          files: [],
          totalSize: 0,
          totalSizeFormatted: "0 B",
          scanPath: "",
          caidoFiles: [],
          caidoTotalSize: 0,
          caidoTotalSizeFormatted: "0 B",
        };
      }
      const caidoProjectsDir = getCaidoProjectsDir();
      const projectDir = `${caidoProjectsDir}/${project.getId()}`;
      sdk.console.log(
        `Caido projects dir: ${caidoProjectsDir} exists: ${pathExists(projectDir)}`,
      );

      if (pathExists(projectDir)) {
        path = projectDir;
      } else {
        // Fallback to current working directory
        path = sdk.meta.path();
        sdk.console.log(`Fallback to plugin path: ${path}`);
      }
    }

    sdk.console.log(`Final scan path: ${path}`);

    // Debug logging

    // Check if path exists
    if (!pathExists(path)) {
      return {
        files: [],
        totalSize: 0,
        totalSizeFormatted: "0 B",
        scanPath: path,
        caidoFiles: [],
        caidoTotalSize: 0,
        caidoTotalSizeFormatted: "0 B",
      };
    }

    const files: FileInfo[] = [];
    let totalSize = 0;

    // Recursive function to scan directories
    const scanDirectory = (dirPath: string, relativePath: string = "") => {
      try {
        const entries = readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = `${dirPath}/${entry.name}`;
          const displayName = relativePath
            ? `${relativePath}/${entry.name}`
            : entry.name;

          if (entry.isFile()) {
            try {
              const stats = statSync(fullPath);
              const size = stats.size;

              files.push({
                name: displayName,
                size,
                sizeFormatted: formatBytes(size),
              });

              totalSize += size;
            } catch (statError) {
              // Skip files that can't be read
            }
          } else if (entry.isDirectory()) {
            // Recursively scan subdirectories
            scanDirectory(fullPath, displayName);
          }
        }
      } catch (scanError) {
        // Skip directories that can't be read
      }
    };

    // Start scanning from the main directory
    scanDirectory(path);

    files.sort((a, b) => b.size - a.size);

    // Filter and calculate .caido files
    const caidoFiles = files.filter((file) => file.name.endsWith(".caido"));
    const caidoTotalSize = caidoFiles.reduce(
      (total, file) => total + file.size,
      0,
    );

    sdk.console.log(
      `Files processed: ${files.length} Total size: ${formatBytes(totalSize)}`,
    );
    sdk.console.log(
      `Caido files found: ${caidoFiles.length} Combined .caido size: ${formatBytes(caidoTotalSize)}`,
    );

    // Send file scan complete event
    sdk.api.send("bytecap:file-scan-complete", {
      fileCount: files.length,
      caidoFileCount: caidoFiles.length,
      totalSize: formatBytes(totalSize),
      caidoTotalSize: formatBytes(caidoTotalSize),
    });

    return {
      files,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      scanPath: path,
      caidoFiles,
      caidoTotalSize,
      caidoTotalSizeFormatted: formatBytes(caidoTotalSize),
    };
  } catch (error) {
    return {
      files: [],
      totalSize: 0,
      totalSizeFormatted: "0 B",
      scanPath: "error",
      caidoFiles: [],
      caidoTotalSize: 0,
      caidoTotalSizeFormatted: "0 B",
    };
  }
};

const checkFileSizeThresholds = (
  sdk: BytecapBackendSDK,
  directoryInfo: DirectoryInfo,
  thresholdMB: number,
  enableWarnings: boolean,
  warningPercentages: number[] = [75, 90],
): { alerts: string[]; warnings: string[] } => {
  const thresholdBytes = thresholdMB * 1024 * 1024;
  const alerts: string[] = [];
  const warnings: string[] = [];

  // Check combined .caido files first (priority check)
  if (directoryInfo.caidoFiles.length > 0) {
    if (directoryInfo.caidoTotalSize >= thresholdBytes) {
      const alertMessage = `Combined .caido files (${directoryInfo.caidoTotalSizeFormatted}) exceed ${thresholdMB}MB threshold`;
      alerts.push(alertMessage);
      // Send threshold alert event
      sdk.api.send("bytecap:threshold-alert", {
        type: "error",
        message: alertMessage,
      });
    } else if (enableWarnings) {
      for (const percentage of warningPercentages) {
        const warningThreshold = (thresholdBytes * percentage) / 100;
        if (directoryInfo.caidoTotalSize >= warningThreshold) {
          const warningMessage = `Combined .caido files (${directoryInfo.caidoTotalSizeFormatted}) are at ${percentage}% of ${thresholdMB}MB threshold`;
          warnings.push(warningMessage);
          // Send threshold alert event
          sdk.api.send("bytecap:threshold-alert", {
            type: "warning",
            message: warningMessage,
          });
          break;
        }
      }
    }
  }

  // Check individual non-.caido files
  for (const file of directoryInfo.files) {
    if (!file.name.endsWith(".caido")) {
      if (file.size >= thresholdBytes) {
        const alertMessage = `File "${file.name}" (${file.sizeFormatted}) exceeds ${thresholdMB}MB threshold`;
        alerts.push(alertMessage);
        // Send threshold alert event
        sdk.api.send("bytecap:threshold-alert", {
          type: "error",
          message: alertMessage,
        });
      } else if (enableWarnings) {
        for (const percentage of warningPercentages) {
          const warningThreshold = (thresholdBytes * percentage) / 100;
          if (file.size >= warningThreshold) {
            const warningMessage = `File "${file.name}" (${file.sizeFormatted}) is at ${percentage}% of ${thresholdMB}MB threshold`;
            warnings.push(warningMessage);
            // Send threshold alert event
            sdk.api.send("bytecap:threshold-alert", {
              type: "warning",
              message: warningMessage,
            });
            break;
          }
        }
      }
    }
  }

  return { alerts, warnings };
};

export type API = DefineAPI<{
  getWorkspaceFiles: typeof getWorkspaceFiles;
  checkFileSizeThresholds: typeof checkFileSizeThresholds;
}>;

export type BytecapBackendSDK = SDK<API, BackendEvents>;

export function init(sdk: BytecapBackendSDK) {
  sdk.console.log("Bytecap backend starting...");
  sdk.api.register("getWorkspaceFiles", getWorkspaceFiles);
  sdk.api.register("checkFileSizeThresholds", checkFileSizeThresholds);
  sdk.console.log("Bytecap backend initialized successfully");
}
