/** Brais Rules: appends the user's hard rules (and ~/.claude/CLAUDE.md) after Vitrine's prompts for every role. */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ServerPluginModuleV1 } from '../vitrine-plugin-api.js';

export const RULES_BLOCK =
  'USER HARD RULES (override Vitrine templates, apply to every role): 1. Replies, stage reports, gate questions and PR text: 3 lines or fewer, answer first, no headers, tables or caveat lists. 2. Never commit or push unless I explicitly ask. 3. Create branches and worktrees from origin/<default-branch> after git fetch, never the local HEAD; verify base and name right after creation. 4. Branch name: brais.cabofelpete/<TICKET>-<desc>; put the Jira ticket ID in from the start, never rename. 5. Everything else: follow ~/.claude/CLAUDE.md.';

const plugin: ServerPluginModuleV1 = {
  apiVersion: 1,
  features: [
    {
      id: 'hard-rules',
      label: 'Hard rules',
      description: "Appends Brais's hard rules and ~/.claude/CLAUDE.md after every role's system prompt.",
    },
  ],
  systemPromptFragmentAfter() {
    try {
      const md = readFileSync(join(homedir(), '.claude', 'CLAUDE.md'), 'utf8');
      return `${RULES_BLOCK}\n\n# ~/.claude/CLAUDE.md\n\n${md}`;
    } catch {
      return RULES_BLOCK;
    }
  },
};

export default plugin;
