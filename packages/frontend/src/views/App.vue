<script setup lang="ts">
import Button from "primevue/button";
import Card from "primevue/card";
import Checkbox from "primevue/checkbox";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Slider from "primevue/slider";
import { computed, onMounted, ref } from "vue";

import { useSDK } from "@/plugins/sdk";

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

// Retrieve the SDK instance to interact with the backend
const sdk = useSDK();

// Load settings from localStorage with defaults
const loadSettings = () => {
  const saved = localStorage.getItem('bytecap-settings');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return {};
    }
  }
  return {};
};

// Save settings to localStorage
const saveSettings = () => {
  const settings = {
    thresholdMB: thresholdMB.value,
    enableWarnings: enableWarnings.value,
    warningAt75Percent: warningAt75Percent.value,
    warningAt90Percent: warningAt90Percent.value,
  };
  localStorage.setItem('bytecap-settings', JSON.stringify(settings));
};

const savedSettings = loadSettings();

// Reactive state with persisted values
const thresholdMB = ref(savedSettings.thresholdMB ?? 10);
const enableWarnings = ref(savedSettings.enableWarnings ?? true);
const warningAt75Percent = ref(savedSettings.warningAt75Percent ?? true);
const warningAt90Percent = ref(savedSettings.warningAt90Percent ?? true);
const workspaceFiles = ref<DirectoryInfo>({
  files: [],
  totalSize: 0,
  totalSizeFormatted: "0 B",
  scanPath: "",
  caidoFiles: [],
  caidoTotalSize: 0,
  caidoTotalSizeFormatted: "0 B",
});
const alerts = ref<string[]>([]);
const warnings = ref<string[]>([]);
const isLoading = ref(false);
const flashBanner = ref<
  { type: "error" | "warning"; message: string } | undefined
>(undefined);
const scanSummary = ref<
  | {
      fileCount: number;
      caidoFileCount: number;
      totalSize: string;
      caidoTotalSize: string;
    }
  | undefined
>(undefined);
const ignoredAlerts = ref<Set<string>>(new Set());
const alertCounters = ref<
  Map<string, { count: number; intervalId?: ReturnType<typeof setInterval> }>
>(new Map());

// Computed properties
const warningPercentages = computed(() => {
  const percentages: number[] = [];
  if (warningAt75Percent.value) percentages.push(75);
  if (warningAt90Percent.value) percentages.push(90);
  return percentages;
});

// Load workspace files
const loadWorkspaceFiles = async (path?: string) => {
  isLoading.value = true;
  try {
    workspaceFiles.value = await sdk.backend.getWorkspaceFiles();

    // Check if no files were found and show alert
    if (workspaceFiles.value.files.length === 0) {
      alerts.value = [
        `No files found in default project directory: ${workspaceFiles.value.scanPath}`,
      ];
    } else {
      alerts.value = []; // Clear any previous alerts
    }

    // Don't auto-check thresholds on file load - wait for user to click "Apply Settings"
  } catch (error) {
    console.error("Error loading workspace files:", error);
    workspaceFiles.value = {
      files: [],
      totalSize: 0,
      totalSizeFormatted: "0 B",
      scanPath: "error",
      caidoFiles: [],
      caidoTotalSize: 0,
      caidoTotalSizeFormatted: "0 B",
    };
  } finally {
    isLoading.value = false;
  }
};

// Check file size thresholds
const checkThresholds = async () => {
  try {
    const result = await sdk.backend.checkFileSizeThresholds(
      workspaceFiles.value,
      thresholdMB.value,
      enableWarnings.value,
      warningPercentages.value,
    );
    alerts.value = result.alerts;
    warnings.value = result.warnings;
  } catch (error) {
    console.error("Error checking thresholds:", error);
  }
};

// Refresh data
const onRefreshClick = async () => {
  await loadWorkspaceFiles();
};

// Apply settings and check thresholds manually
const applySettings = async () => {
  // Save settings to localStorage
  saveSettings();

  // Clear any existing notifications first
  clearAllNotifications();

  // Now check thresholds with new settings
  await checkThresholds();
};

// Dismiss flash banner
const dismissFlashBanner = () => {
  flashBanner.value = undefined;
};

// Clear all notifications and reset alert system
const clearAllNotifications = () => {
  // Clear all pending intervals
  alertCounters.value.forEach((counter) => {
    if (counter.intervalId) {
      clearInterval(counter.intervalId);
    }
  });

  // Reset all alert state
  alertCounters.value.clear();
  ignoredAlerts.value.clear();
  flashBanner.value = undefined;
  alerts.value = [];
  warnings.value = [];

  console.log("All notifications cleared and alert system reset");
};

// Show alert with ignore functionality and repeat alerts
const showThresholdAlert = (alert: {
  type: "error" | "warning";
  message: string;
}) => {
  const alertKey = `${alert.type}:${alert.message}`;

  // Check if this alert type is ignored
  if (ignoredAlerts.value.has(alertKey)) {
    return;
  }

  // Initialize counter for this alert if it doesn't exist
  if (!alertCounters.value.has(alertKey)) {
    alertCounters.value.set(alertKey, { count: 0 });
  }

  const counter = alertCounters.value.get(alertKey)!;

  const showSingleAlert = (alertNumber: number) => {
    const result = confirm(
      `🚨 BYTECAP THRESHOLD ALERT (${alertNumber}/3)\n\n` +
        `${alert.message}\n\n` +
        `This is alert ${alertNumber} of 3. ${alertNumber < 3 ? "Next alert in 1 minute." : "This is the final alert."}\n\n` +
        `Click OK to acknowledge, or CANCEL to ignore all future alerts of this type.`,
    );

    if (!result) {
      // User clicked Cancel - ignore future alerts of this type
      ignoredAlerts.value.add(alertKey);
      // Clear any pending intervals for this alert
      if (counter.intervalId) {
        clearInterval(counter.intervalId);
        delete counter.intervalId;
      }
      console.log(`User ignored future alerts for: ${alertKey}`);
      return;
    }

    // Only show flash banner in plugin page for first alert
    if (alertNumber === 1) {
      flashBanner.value = {
        type: alert.type,
        message: alert.message,
      };
    }
  };

  // Show first alert immediately
  counter.count = 1;
  showSingleAlert(1);

  // Schedule next 2 alerts if not ignored
  if (!ignoredAlerts.value.has(alertKey)) {
    counter.intervalId = setInterval(() => {
      if (ignoredAlerts.value.has(alertKey)) {
        if (counter.intervalId) {
          clearInterval(counter.intervalId);
          delete counter.intervalId;
        }
        return;
      }

      counter.count++;
      showSingleAlert(counter.count);

      if (counter.count >= 3) {
        if (counter.intervalId) {
          clearInterval(counter.intervalId);
          delete counter.intervalId;
        }
        console.log(`Completed all 3 alerts for: ${alertKey}`);
      }
    }, 60000); // 1 minute intervals
  }
};

// Load data on component mount
onMounted(() => {
  console.log("Frontend mounted, calling backend...");

  // Set up event listeners for backend alerts
  sdk.backend.onEvent("bytecap:threshold-alert", (alert) => {
    showThresholdAlert(alert);
  });

  sdk.backend.onEvent("bytecap:file-scan-complete", (summary) => {
    scanSummary.value = summary;
  });

  // Listen for project changes and refresh data
  sdk.backend.onEvent("bytecap:project-changed", (data) => {
    console.log(`Project changed to: ${data.projectName}`);
    loadWorkspaceFiles();
  });

  loadWorkspaceFiles();
});
</script>

<template>
  <div class="p-4 h-full overflow-y-auto">
    <div class="max-w-6xl mx-auto space-y-6">
      <!-- Header -->
      <div class="text-center">
        <h1 class="text-3xl font-bold mb-2">Bytecap - File Size Monitor</h1>
        <p class="text-gray-600">Monitor and manage workspace file sizes</p>
      </div>

      <!-- Flash Banner -->
      <div v-if="flashBanner" class="mb-4">
        <Message
          :severity="flashBanner.type === 'error' ? 'error' : 'warn'"
          :closable="true"
          class="animate-pulse"
          @close="dismissFlashBanner"
        >
          <strong>🚨 THRESHOLD ALERT:</strong> {{ flashBanner.message }}
        </Message>
      </div>

      <!-- Controls -->
      <Card>
        <template #title>Settings</template>
        <template #content>
          <div class="space-y-4">
            <!-- Threshold Slider -->
            <div>
              <label class="block text-sm font-medium mb-2">
                Size Threshold: {{ thresholdMB }}MB
              </label>
              <div class="flex gap-4 items-center">
                <Slider
                  v-model="thresholdMB"
                  :min="1"
                  :max="20480"
                  :step="10"
                  class="flex-1"
                />
                <InputText
                  v-model.number="thresholdMB"
                  type="number"
                  :min="1"
                  :max="20480"
                  class="w-20"
                  style="text-align: center"
                />
                <span class="text-sm text-gray-500">MB</span>
              </div>
              <div class="flex justify-between text-xs text-gray-500 mt-1">
                <span>1MB</span>
                <span>20GB</span>
              </div>
            </div>

            <!-- Warning Options -->
            <div>
              <div class="flex items-center mb-2">
                <Checkbox v-model="enableWarnings" binary />
                <label class="ml-2 text-sm font-medium"
                  >Enable Additional Warnings</label
                >
              </div>

              <div v-if="enableWarnings" class="ml-6 space-y-2">
                <div class="flex items-center">
                  <Checkbox v-model="warningAt75Percent" binary />
                  <label class="ml-2 text-sm"
                    >Warning at 75% of threshold</label
                  >
                </div>
                <div class="flex items-center">
                  <Checkbox v-model="warningAt90Percent" binary />
                  <label class="ml-2 text-sm"
                    >Warning at 90% of threshold</label
                  >
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2">
              <Button
                label="Apply Settings"
                :loading="isLoading"
                icon="pi pi-check"
                severity="success"
                @click="applySettings"
              />
              <Button
                label="Refresh Files"
                :loading="isLoading"
                icon="pi pi-refresh"
                @click="onRefreshClick"
              />
              <Button
                label="Clear Alerts"
                icon="pi pi-times-circle"
                severity="secondary"
                outlined
                @click="clearAllNotifications"
              />
            </div>
          </div>
        </template>
      </Card>

      <!-- Alerts and Warnings -->
      <div v-if="alerts.length > 0 || warnings.length > 0" class="space-y-2">
        <div v-for="alert in alerts" :key="alert" class="w-full">
          <Message severity="error" :closable="false">{{ alert }}</Message>
        </div>
        <div v-for="warning in warnings" :key="warning" class="w-full">
          <Message severity="warn" :closable="false">{{ warning }}</Message>
        </div>
      </div>

      <!-- Caido Files Summary -->
      <Card v-if="workspaceFiles.caidoFiles.length > 0">
        <template #title>
          📁 Caido Project Files ({{ workspaceFiles.caidoFiles.length }}) -
          Combined Size: {{ workspaceFiles.caidoTotalSizeFormatted }}
        </template>
        <template #content>
          <div
            class="p-3 mb-4"
            style="border: 1px solid var(--surface-border); border-radius: 6px"
          >
            <p class="mb-2" style="font-size: 14px">
              <strong>Note:</strong> These .caido files are monitored as a
              combined unit for size threshold checks.
            </p>
            <div class="space-y-1">
              <div
                v-for="file in workspaceFiles.caidoFiles"
                :key="file.name"
                class="flex justify-between"
                style="font-size: 14px"
              >
                <span class="font-mono">{{ file.name }}</span>
                <span class="font-medium" style="color: var(--primary-color)">{{
                  file.sizeFormatted
                }}</span>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- All Files List -->
      <Card>
        <template #title>
          All Workspace Files ({{ workspaceFiles.files.length }}) - Total:
          {{ workspaceFiles.totalSizeFormatted }}
        </template>
        <template #content>
          <DataTable
            :value="workspaceFiles.files"
            :loading="isLoading"
            paginator
            :rows="20"
            :show-gridlines="true"
            :striped-rows="true"
          >
            <Column field="name" header="File Name" sortable>
              <template #body="slotProps">
                <span
                  :class="[
                    'font-mono text-sm',
                    slotProps.data.name.endsWith('.caido')
                      ? 'text-blue-600 font-semibold'
                      : '',
                  ]"
                >
                  <span
                    v-if="slotProps.data.name.endsWith('.caido')"
                    class="mr-1"
                    >📁</span
                  >
                  {{ slotProps.data.name }}
                </span>
              </template>
            </Column>
            <Column field="sizeFormatted" header="Size" sortable>
              <template #body="slotProps">
                <span
                  :class="[
                    'font-medium',
                    slotProps.data.size >= thresholdMB * 1024 * 1024
                      ? 'text-red-600'
                      : enableWarnings &&
                          slotProps.data.size >= thresholdMB * 1024 * 1024 * 0.9
                        ? 'text-orange-600'
                        : enableWarnings &&
                            slotProps.data.size >=
                              thresholdMB * 1024 * 1024 * 0.75
                          ? 'text-yellow-600'
                          : 'text-green-600',
                  ]"
                >
                  {{ slotProps.data.sizeFormatted }}
                </span>
              </template>
            </Column>
            <Column header="Status">
              <template #body="slotProps">
                <!-- Special handling for .caido files -->
                <span
                  v-if="slotProps.data.name.endsWith('.caido')"
                  class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                >
                  📁 Part of Combined Check
                </span>
                <!-- Regular file threshold checks -->
                <span
                  v-else-if="slotProps.data.size >= thresholdMB * 1024 * 1024"
                  class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800"
                >
                  Exceeds Threshold
                </span>
                <span
                  v-else-if="
                    enableWarnings &&
                    slotProps.data.size >= thresholdMB * 1024 * 1024 * 0.9
                  "
                  class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800"
                >
                  90% Warning
                </span>
                <span
                  v-else-if="
                    enableWarnings &&
                    slotProps.data.size >= thresholdMB * 1024 * 1024 * 0.75
                  "
                  class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800"
                >
                  75% Warning
                </span>
                <span
                  v-else
                  class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800"
                >
                  OK
                </span>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </div>
  </div>
</template>
