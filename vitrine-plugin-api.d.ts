/**
 * Vitrine public plugin API, version 1.
 *
 * The contract an EXTERNAL plugin (loaded at runtime from a trusted source)
 * builds against. Self-contained on purpose: this file imports nothing from
 * Vitrine internals, so internal refactors never change the API a released
 * plugin was compiled against. Each layer's adapter
 * (`src/{server,frontend,electron}/plugins/external/adapt-v1.ts`) maps these
 * shapes onto the internal plugin contracts.
 *
 * The plugin template ships a byte-identical copy of this file as
 * `vitrine-plugin-api.d.ts` (a parity test enforces it). See
 * docs/architecture/EXTERNAL_PLUGINS.md § Public API.
 */

/** The API version this file describes. */
export type PluginApiVersionV1 = 1;

// ── Manifest (`vitrine-plugin.json`) ─────────────────────────────────────────

export interface PluginConfigOptionV1 {
  value: string;
  label: string;
}

export interface PluginConfigSelectV1 {
  id: string;
  label: string;
  options: PluginConfigOptionV1[];
  default: string;
}

export interface PluginConfigMultiSelectV1 {
  id: string;
  label: string;
  options: PluginConfigOptionV1[];
  default: string[];
}

export type PluginProjectSettingsFieldV1 =
  | { id: string; kind: 'text'; label: string; description?: string; placeholder?: string }
  | { id: string; kind: 'boolean'; label: string; description?: string };

export interface PluginProjectSettingsV1 {
  label: string;
  description?: string;
  presentation?: 'section' | 'inline';
  fields: PluginProjectSettingsFieldV1[];
}

export interface ExternalPluginManifestV1 {
  /** Lowercase letters, digits, and hyphens; starts with a letter. */
  slug: string;
  name: string;
  description: string;
  /** `major.minor.patch`. */
  version: string;
  apiVersion: PluginApiVersionV1;
  /** Optional Vitrine version range, e.g. `>=0.40.0` or `^0.40.0`. */
  engines?: { vitrine?: string };
  /** Defaults to `project`. */
  scope?: 'global' | 'project';
  defaultDisabled?: boolean;
  homepage?: string;
  configSelects?: PluginConfigSelectV1[];
  configMultiSelect?: PluginConfigMultiSelectV1;
  projectSettings?: PluginProjectSettingsV1;
  /** File name (no directories) of each layer's built entry. At least one. */
  entries: { server?: string; frontend?: string; electron?: string };
  /** `sha256-<base64>` per entry file name. Required for GitHub releases. */
  integrity?: Record<string, string>;
}

// ── Shared building blocks ───────────────────────────────────────────────────

export type PluginLogLevelV1 = 'info' | 'warn' | 'error';

export interface PluginFeatureV1 {
  id: string;
  label: string;
  description: string;
}

/** Read access to THIS plugin's own persisted config values. */
export interface PluginConfigReaderV1 {
  /** A single-select value (or `undefined` when unset). */
  get(id: string): string | undefined;
  /** A multi-select value split into its options (`[]` when unset). */
  getList(id: string): string[];
}

export interface PluginBaseContextV1 {
  log(level: PluginLogLevelV1, text: string): void;
  config: PluginConfigReaderV1;
}

// ── Server layer ─────────────────────────────────────────────────────────────

export interface PromptContextV1 extends PluginBaseContextV1 {
  /** Vitrine's agent role taxonomy (`worker`, `planner`, `reviewer`, `shepherd`, …). */
  role: string;
}

export type ToolContentV1 =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

export interface ToolV1 {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  parameters: Record<string, unknown>;
  /** Return a string (one text block) or explicit content blocks. */
  execute(args: Record<string, unknown>): Promise<string | { content: ToolContentV1[] }>;
}

export interface TaskAgentContextV1 extends PromptContextV1 {
  projectDir: string;
  taskId: string | null;
  isWorkflowTask: boolean;
  /** A project-settings field this plugin declared. */
  projectSetting(id: string): string | boolean | undefined;
  /** This plugin's own durable per-task data. */
  taskData: {
    get(): Record<string, string> | undefined;
    update(patch: Record<string, string | undefined>): void;
  };
}

export interface TaskAgentContributionV1 {
  tools: ToolV1[];
  promptFragments?: string[];
}

export interface HttpRequestV1 {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}

export interface HttpResponseV1 {
  status?: number;
  json?: unknown;
  text?: string;
}

export type HttpHandlerV1 = (req: HttpRequestV1) => Promise<HttpResponseV1> | HttpResponseV1;

/** Routes mount under `/__vitrine__/api/plugins/<slug>/`. POST routes carry
 * Vitrine's loopback + JSON + same-origin guard. */
export interface HttpRouterV1 {
  get(path: string, handler: HttpHandlerV1): void;
  post(path: string, handler: HttpHandlerV1): void;
}

export interface HttpRoutesContextV1 extends PluginBaseContextV1 {
  router: HttpRouterV1;
  isEnabled(): boolean;
}

export interface ServerPluginModuleV1 {
  apiVersion: PluginApiVersionV1;
  features?: PluginFeatureV1[];
  /** Ordinary system-prompt fragment for `ctx.role`, or `undefined`. */
  systemPromptFragment?(ctx: PromptContextV1): string | undefined;
  /** Last-word system-prompt fragment (appended after everything else). */
  systemPromptFragmentAfter?(ctx: PromptContextV1): string | undefined;
  /** Fragment prepended to a role's first user-turn message at dispatch. */
  roleInitialMessage?(ctx: PromptContextV1): string | undefined;
  /** Role-aware task-agent tools and prompt fragments. */
  taskAgentContribution?(ctx: TaskAgentContextV1): TaskAgentContributionV1 | undefined;
  /** Global plugins only. Return a disposer to clean up. */
  httpRoutes?(ctx: HttpRoutesContextV1): void | { dispose(): void };
  /** Global plugins only. Synchronous rewrite of an agent Bash command. */
  bashCommandTransform?(ctx: PluginBaseContextV1): ((command: string) => string) | undefined;
}

// ── Frontend (UI) layer ──────────────────────────────────────────────────────

export interface FrontendContextV1 {
  project: { name: string } | null;
  log(level: PluginLogLevelV1, text: string): void;
  /** Invoke this plugin's Electron `invokeAction` hook (global plugins). */
  invokeElectronAction(action: string, payload?: unknown): Promise<unknown>;
  /** URL of an asset served by this plugin's Electron `resolveAsset` hook. */
  assetUrl(assetId: string): string;
}

export interface TaskSummaryV1 {
  id: string;
  title: string;
  status: string;
  branch?: string;
  prUrl?: string;
  /** This plugin's own per-task data. */
  data?: Record<string, string>;
}

export interface DevShortcutV1 {
  id: string;
  label: string;
  onClick(): void;
}

export interface TaskActionV1 {
  id: string;
  label: string;
  loadingLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  onClick(): void | Promise<void>;
}

export interface TaskLinkV1 {
  label: string;
  url: string;
  tooltip?: string;
}

export interface SettingsControlsContextV1 {
  enabled: boolean;
  persistConfig(id: string, value: string): Promise<void>;
}

export interface SettingsControlsV1 {
  element: HTMLElement;
  setEnabled(enabled: boolean): void;
}

export type AlertSinkModeV1 = 'off' | 'show' | 'sound';

export interface AlertV1 {
  type: string;
  title: string;
  body: string;
}

export interface AlertSinkV1 {
  id: string;
  label: string;
  description: string;
  modes: AlertSinkModeV1[];
  /** Pure: derive the mode from this plugin's state. */
  getMode(state: { enabled: boolean; config: PluginConfigReaderV1 }): AlertSinkModeV1;
  setMode(mode: AlertSinkModeV1): Promise<void>;
  deliver(alert: AlertV1, mode: AlertSinkModeV1): void;
}

export interface FrontendPluginModuleV1 {
  apiVersion: PluginApiVersionV1;
  features?: PluginFeatureV1[];
  /** Inline SVG markup for the plugin card's logo tile. */
  cardGlyph?: string;
  devShortcuts?(ctx: FrontendContextV1): DevShortcutV1[];
  taskActions?(task: TaskSummaryV1, ctx: FrontendContextV1): TaskActionV1[];
  taskLinks?(task: TaskSummaryV1): TaskLinkV1[];
  toolActivityLabel?(toolName: string): string | undefined;
  settingsControls?(ctx: SettingsControlsContextV1): SettingsControlsV1;
  /** Global plugins only. */
  alertSinks?(): AlertSinkV1[];
}

// ── Electron layer (global plugins only) ─────────────────────────────────────

export interface ElectronBackgroundContextV1 {
  isDev: boolean;
  log(level: PluginLogLevelV1, text: string): void;
  showWorkspace(): void;
  setEnabled(enabled: boolean): void;
}

export interface ElectronPluginModuleV1 {
  apiVersion: PluginApiVersionV1;
  features?: PluginFeatureV1[];
  background?: {
    start(ctx: ElectronBackgroundContextV1): void;
    stop(): void;
  };
  invokeAction?(action: string, payload: unknown): Promise<unknown>;
  /** Absolute path of a plugin-owned file, or `null`. */
  resolveAsset?(assetId: string): { path: string } | null;
}
