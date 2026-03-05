# Implementation Research Notes (v1)

## 1. Purpose
Capture concrete implementation findings from the current AstrBot codebase to guide the 5-phase refactor execution.

## 2. Source Scope
Primary source root:
- `/root/work/AstrBot/`

Key inspected modules:
1. Runtime lifecycle and pipeline
- `astrbot/core/core_lifecycle.py`
- `astrbot/core/pipeline/*`
2. Dify and third-party runner integration
- `astrbot/core/pipeline/process_stage/method/agent_sub_stages/third_party.py`
- `astrbot/core/agent/runners/dify/*`
3. Tools and MCP
- `astrbot/core/provider/func_tool_manager.py`
- `astrbot/dashboard/routes/tools.py`
4. Skills
- `astrbot/core/skills/skill_manager.py`
- `astrbot/dashboard/routes/skills.py`
5. Plugins
- `astrbot/core/star/star_manager.py`
- `astrbot/dashboard/routes/plugin.py`
6. SubAgent
- `astrbot/core/subagent_orchestrator.py`
- `astrbot/dashboard/routes/subagent.py`
7. Proactive and cron
- `astrbot/core/cron/manager.py`
- `astrbot/dashboard/routes/cron.py`
8. Knowledge base
- `astrbot/core/knowledge_base/kb_mgr.py`
- `astrbot/dashboard/routes/knowledge_base.py`
9. Open API and streaming
- `astrbot/dashboard/routes/open_api.py`
- `openapi.json`
10. Sandbox/computer runtime
- `astrbot/core/computer/*`
- `astrbot/core/astr_main_agent_resources.py`
- `astrbot/core/astr_main_agent.py`

## 3. Confirmed Implementation Facts

### 3.1 Pipeline and Runtime
1. Pipeline is stage-based and ordered.
2. Process stage combines plugin path and agent/provider path.
3. Runtime supports streaming output and post-processing stages.

### 3.2 Dify Integration
1. Dify is already integrated via third-party runner path.
2. Existing behavior includes streaming and final result aggregation semantics.
3. Conversation persistence is session-oriented and must be preserved in refactor.

### 3.3 Tools and MCP
1. Function tool manager is the runtime hub for tool registration and lifecycle.
2. MCP supports config persistence, runtime enable/disable, connection test, and tool exposure.
3. MCP runtime has timeout controls and cleanup behavior that should be mirrored.

### 3.4 Skills
1. Skill inventory is local-file based (`SKILL.md`) with active-state config.
2. ZIP import includes path sanitation and archive structure checks.
3. Skill metadata cache exists for sandbox-side visibility and sync.

### 3.5 Plugins
1. Plugin manager supports install from repo/upload, reload, enable/disable, uninstall.
2. Plugin hot-reload and failure tracking exist.
3. Plugin failure isolation is explicit and should be retained as a hard requirement.

### 3.6 SubAgent
1. Subagent definitions are config-driven and dynamically converted to handoff tools.
2. Per-subagent provider override exists (still Dify-only in new scope).
3. Available-tools endpoint excludes recursive handoff tool misuse.

### 3.7 Proactive / Cron
1. Cron manager supports recurring and run-once jobs.
2. Active jobs re-enter main-agent pipeline through session context.
3. Cron APIs expose create/list/update/delete patterns and run metadata.

### 3.8 Knowledge Base
1. KB manager supports create/list/update/delete and retrieval.
2. Document upload/import is async and progress-aware.
3. Retrieval output includes formatted context and source metadata.

### 3.9 Sandbox Runtime
1. Runtime modes include `none`, `local`, and `sandbox`.
2. Sandbox file/shell/python/browser tools are capability-driven.
3. Skills can be synchronized into active sandbox sessions.

### 3.10 API Surface Pattern
1. Existing dashboard APIs are route-rich and operation-centric.
2. OpenAPI path includes SSE chat and session list patterns.
3. Refactor should keep contract-first strategy and typed shared models.

## 4. Refactor Decisions from Research
1. Keep architecture intent, not endpoint naming parity.
2. Keep capability parity where in-scope, simplify where not required.
3. Keep strong isolation boundaries for plugin and sandbox runtime.
4. Keep MCP and skills as first-class tool sources.
5. Keep proactive flow as scheduler-driven pipeline re-entry.

## 5. Required Parity Priorities
1. Dify streaming and conversation binding behavior.
2. Plugin lifecycle and failure isolation.
3. Skills import/toggle safety constraints.
4. MCP runtime management and timeout behavior.
5. Proactive and subagent traceability in stream/logs.

## 6. Known Simplifications (Intentional)
1. Remove all messaging platform adapters from v1.
2. Remove all non-Dify providers from v1.
3. Remove plugin marketplace from v1, keep local plugin lifecycle only.

---
Status: Research baseline complete for planning and implementation.
Date: 2026-03-05
