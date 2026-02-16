
# OpenClaw Skill: fdv.lol (CLI / Headless Memecoin Auto Trader)

This skill is for running fdv.lol **CLI mode** (`cli.mjs`) with **Agent Gary Full AI Control** enabled, so the AI can fully drive Auto Trader decisions.

Users must **pre-configure a profile JSON** (RPC + wallet + Jupiter + LLM).

This published skill bundle includes a safe profile template you can copy and fill in:

- [openclaw.example.json](openclaw.example.json)

If you need to cross-check the upstream profile schema/examples, refer to the public repo:

- https://github.com/build23w/fdv.lol
- https://github.com/build23w/fdv.lol/blob/main/tools/profiles/fdv.profiles.example.json

Important: do **not** publish real wallet secrets or API keys inside an OpenClaw skill bundle. Use placeholder values like the example profile below.

ClawDBot contract:
- It must create the real profile JSON locally at runtime (with secrets) and run the CLI against that local file.
- It must not upload or publish the profile anywhere.

---

## First Run (User Has No Secrets)

If a user installs this skill from ClawHub and has **no RPC, API keys, or wallet secret yet**, the only workable flow is an onboarding/wizard flow.

ClawDBot should do this:

1) **Generate a new local wallet** (non-custodial): create a fresh Solana keypair and store its secret **locally** (not uploaded).
2) Show the **public address** and instruct the user to **fund it with a small amount of SOL**.
3) Collect or provision the remaining inputs:

- **RPC URL** (mandatory)
	- Direct users to create an RPC endpoint here: https://quicknode.com/signup?via=lf
	- After signup, they must paste the Solana Mainnet RPC URL into the generated profile as `rpc.url`.

- **Jupiter API key** (mandatory)
	- Users must get a FREE Jupiter API key here: https://portal.jup.ag/pricing
	- ClawDBot must refuse to start without it.
	- Paste it into the generated profile as `jupiter.apiKey`.

- **LLM API key** (required for “Full AI Control”; OpenAI recommended)
	- Recommended provider: `openai`.
	- If the user has no OpenAI API key, direct them to create one and paste it into `agentGaryFullAi.apiKey`.
	- If no LLM key is provided, ClawDBot must refuse to start in Full AI Control mode.

4) Write a complete `./profile.json` with the gathered/generated values.
5) Run the CLI against that local file.

Minimum hard requirements to actually trade headlessly:
- `wallet.secret` (must exist; can be generated)
- `rpc.url` (must be provided)
- `jupiter.apiKey` (must be provided)

Minimum hard requirements for **Full AI Control** specifically:
- `agentGaryFullAi.apiKey` (or platform-provided equivalent)
- `agentGaryFullAi.fullAiControl: true`

---

## What “Full Control” Means

fdv.lol’s Auto Trader has an AI assist mode (Agent Gary). When you enable:

- `agentGaryFullAi.enabled: true`
- `agentGaryFullAi.fullAiControl: true`

…the runtime sets `fdv_agent_full_control=true`, and the trading engine treats AI decisions as authoritative (it can bypass some “enforce” gates that would otherwise hard-block actions).

This is intentionally powerful. Use a burner wallet and small balances.

---

## Required Inputs (Profile)

Your CLI run will only work if the profile includes:

- RPC
	- `rpc.url` (or `rpcUrl`)
	- optional `rpc.headers` (or `rpcHeaders`)
- Wallet (for signing swaps)
	- `wallet.secret` (or `autoWalletSecret`) **required**
	- optional `wallet.recipientPub` (or `recipientPub`)
- Jupiter
	- `jupiter.apiKey` (or `jupApiKey`) **required** (get one: https://portal.jup.ag/pricing)
- Agent Gary Full AI
	- `agentGaryFullAi.provider` (openai|gemini|grok|deepseek)
	- `agentGaryFullAi.model`
	- `agentGaryFullAi.riskLevel` (safe|medium|degen)
	- `agentGaryFullAi.enabled: true`
	- `agentGaryFullAi.fullAiControl: true`
	- `agentGaryFullAi.apiKey` (or provide via env var)

Notes:
- The CLI supports reading API keys from env vars too:
	- OpenAI: `OPENAI_API_KEY` or `FDV_OPENAI_KEY`
	- Gemini: `GEMINI_API_KEY` or `FDV_GEMINI_KEY`
	- Grok: `XAI_API_KEY` / `GROK_API_KEY` / `FDV_GROK_KEY`
	- DeepSeek: `DEEPSEEK_API_KEY` or `FDV_DEEPSEEK_KEY`

---

## How To Run (CLI)

Assume you only have this skill directory (no local repo). ClawDBot should:

1) Generate a local profile file (with sensitive values) at runtime (example filename: `./profile.json`).
2) Fetch `cli.mjs`.
3) Run `--run-profile` pointing at the local profile file.

Primary (recommended) execution:

- `curl -fsSL https://fdv.lol/cli.mjs | node - run-profile --profile-url ./profile.json --log-to-console`

Alternate fetch (directly from GitHub):

- `curl -fsSL https://raw.githubusercontent.com/build23w/fdv.lol/main/cli.mjs | node - run-profile --profile-url ./profile.json --log-to-console`

Notes:
- `--profile-url` accepts local paths too (like `./dev.json` or `./profile.json`).
- You can also use `--profiles ./profile.json` for local files; both are supported.

---

## Safe Example Profile

Upstream secret-free template (reference):

- https://github.com/build23w/fdv.lol/blob/main/tools/profiles/fdv.profiles.example.json

If you want an example that matches the **prod profile shape** but with placeholders (recommended for onboarding), use:

- [openclaw.example.json](openclaw.example.json)

---

## OpenClaw Operating Rules

When acting as “OpenClaw” in CLI mode:

- Do not attempt to run without a fully populated profile.
- Assume the user has explicitly granted full control when `fullAiControl=true`.
- Do not print or persist secrets in logs.
- Only change behavior by editing the profile (or documented env vars); don’t invent new flags.

