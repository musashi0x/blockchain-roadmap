/* Module 10 — Blockchain DevOps & Validator Operations (lessons 44-47) */
(function (L) {

L.push({
  id: 'l44', module: 10, num: 44,
  title: 'Blockchain Nodes, P2P Networking and Capacity',
  level: 'Intermediate', minutes: 85,
  summary: 'Choose the right node role, size its hardware and storage, and operate its network boundary without confusing uptime with trustworthiness.',
  objectives: [
    'Distinguish full, archive, sentry, RPC and validator node roles',
    'Estimate disk growth, bandwidth and headroom from a chain workload',
    'Design a validator-sentry topology that limits exposure without isolating consensus',
    'Explain why snapshots accelerate sync but do not replace verification'
  ],
  body: `
<h3>Start with the job, not the binary</h3>
<p>“Run a node” can mean very different operational commitments. A <strong>full node</strong> validates the chain and retains the state needed by its client. An <strong>archive node</strong> retains historical state for deep queries and is expensive in disk and I/O. An <strong>RPC node</strong> is a public product surface: it needs rate limits, caching and capacity isolation. A <strong>validator</strong> signs consensus messages and therefore carries key-custody and slashing risk. A <strong>sentry</strong> sits at the public P2P edge so a validator can keep a small, controlled peer set.</p>
<div class="table-scroll"><table><thead><tr><th>Role</th><th>Primary risk</th><th>Operational priority</th></tr></thead><tbody>
<tr><td>Validator</td><td>Downtime, double-signing, key compromise</td><td>Reliable signing and conservative changes</td></tr>
<tr><td>Sentry</td><td>DDoS and hostile peers</td><td>Peer diversity and network filtering</td></tr>
<tr><td>Public RPC</td><td>Abuse and noisy neighbours</td><td>Rate limits, caching and horizontal scale</td></tr>
<tr><td>Archive</td><td>Disk exhaustion and slow queries</td><td>Storage planning and query isolation</td></tr>
</tbody></table></div>

<h3>Capacity has a growth curve</h3>
<p>Do not size only for today’s database. Estimate state growth, block history growth, snapshots, logs, the time needed to restore, and at least 30% free disk headroom. IOPS and latency matter as much as raw capacity: when a node cannot commit its database fast enough, more CPU does not fix it. Measure the actual chain and client under realistic load; published minimums are a floor, not a production target.</p>
<pre><code>diskNeeded ≈ currentData + (dailyGrowth × retentionDays)
             + snapshotWorkingSpace + logBudget + 30% headroom</code></pre>

<h3>Network the validator deliberately</h3>
<p>A validator should not expose every service port to the internet. Put public P2P traffic on sentries, allow validator P2P only to known sentries and peers required by the chain, keep RPC and metrics on a private network or authenticated gateway, and restrict SSH through a bastion or identity-aware access layer. Firewall rules are part of consensus availability: a rule that blocks every peer can look secure while silently causing missed blocks.</p>
<p>Fast-sync and snapshots are operational conveniences. The node must still verify headers, signatures and state commitments according to the protocol. A snapshot source that is fast but untrusted is acceptable only when the client validates the resulting state; never import a database dump as though it were consensus proof.</p>
`,
  code: [{
    lang: 'yaml', file: 'docker-compose.node.yml', caption: 'A teaching topology: a validator has no public RPC port; a separate RPC service carries the public boundary. Real operators also pin images, verify releases and use a secret manager.',
    src: 'services:\n  validator:\n    image: examplechain/node:1.8.2\n    command: ["start", "--moniker=validator-a"]\n    volumes:\n      - validator-data:/var/lib/examplechain\n      - /run/secrets/validator-key:/run/validator-key:ro\n    networks: [private]\n    expose: ["26656", "26660"] # P2P and private metrics only\n    restart: unless-stopped\n\n  rpc:\n    image: examplechain/node:1.8.2\n    command: ["start", "--rpc.laddr=tcp://0.0.0.0:26657"]\n    volumes: [rpc-data:/var/lib/examplechain]\n    networks: [edge, private]\n    ports: ["127.0.0.1:26657:26657"]\n    restart: unless-stopped\n\nnetworks:\n  edge: {}\n  private: { internal: true }\nvolumes:\n  validator-data: {}\n  rpc-data: {}'
  }],
  lab: 'nodeops',
  quiz: [
    { q: 'Why place sentries in front of a validator?', options: ['To make the validator key public', 'To absorb public P2P exposure while keeping the validator connected through a controlled peer set', 'To avoid running a full node', 'To let an RPC server sign blocks'], answer: 1, why: 'Sentries reduce the validator’s public attack surface but are not a reason to isolate it. The validator still needs reliable, diverse consensus connectivity.' },
    { q: 'What does a snapshot let an operator skip?', options: ['All consensus verification', 'Only some historical replay work; the client must still validate state commitments', 'Disk capacity planning', 'Key management'], answer: 1, why: 'A snapshot speeds bootstrap. It is not a replacement for protocol validation or a trusted database import.' },
    { q: 'Which signal most directly warns of an imminent disk outage?', options: ['Node version', 'Free space and projected growth until exhaustion', 'Validator moniker', 'Number of SSH users'], answer: 1, why: 'Operators need both present free space and the rate at which state, snapshots and logs consume it. Alert before the disk reaches a critical level.' }
  ],
  tasks: [
    'Use the lab to size a node for 90 days of retention and leave at least 30% disk headroom.',
    'Draw the firewall boundary for validator, sentry, RPC, metrics and admin access.',
    'Write a restore-time objective and calculate whether your snapshot and disk throughput can meet it.',
    'List the queries that require an archive node versus a normal full node.'
  ],
  resources: [
    { type: 'docs', title: 'Ethereum node architecture', url: 'https://ethereum.org/en/developers/docs/nodes-and-clients/' },
    { type: 'docs', title: 'CometBFT node operator guide', url: 'https://docs.cometbft.com/' },
    { type: 'docs', title: 'Prometheus node exporter', url: 'https://github.com/prometheus/node_exporter' }
  ]
});

L.push({
  id: 'l45', module: 10, num: 45,
  title: 'Validator Keys, Staking and Slashing Safety',
  level: 'Advanced', minutes: 85,
  summary: 'Operate a validator as a signing system: separate keys, prevent double-signing, plan failover, and understand the economic cost of downtime.',
  objectives: [
    'Separate withdrawal, operator and consensus-signing keys by blast radius',
    'Explain the difference between liveness penalties and slashable equivocation',
    'Design a failover that cannot run two signers at once',
    'Create a key-rotation and emergency-withdrawal runbook'
  ],
  body: `
<h3>A validator is a production signing service</h3>
<p>Its consensus key authorises messages that the protocol treats as your validator’s action. Losing it can enable equivocation; losing an operator key can change configuration; losing a withdrawal key can lose the stake itself. These are different duties and should not be a single hot file on the same machine. Use the narrowest key possible for each job and keep high-value withdrawal authority offline or behind a multisig.</p>

<h3>Downtime and double-signing are different failures</h3>
<p>Most proof-of-stake systems penalise missed participation over a window: the validator loses rewards or incurs a small liveness penalty. Double-signing is more serious: two conflicting votes for the same height and round can break safety, so protocols impose a slash and may jail the validator. The exact rules vary by chain, but the operational conclusion is universal: availability failover must never create two active signers.</p>
<div class="note danger"><span class="tag">Failover invariant</span>Before starting a standby signer, prove the primary is stopped, fenced from the network and unable to access the signing key. A health check that merely times out is not proof that the old process cannot still sign.</div>

<h3>Remote signing reduces key exposure</h3>
<p>A remote signer or HSM can enforce chain ID, validator identity, monotonic height and round rules before it emits a signature. It does not make operations automatic: the signer state must be backed up carefully, upgrades must preserve compatibility, and the validator must be unable to bypass it with a duplicate key. Test recovery on a non-production environment before relying on it during an incident.</p>

<h3>Runbooks turn panic into a bounded change</h3>
<p>Write down who can halt, unjail, rotate an operator key, change commission, move stake or trigger withdrawal. Include the exact verification step after every action: compare validator public key, chain ID, latest signed height, peers and explorer status. Store contact paths out of band; an incident that takes down the node can take down the chat bot you planned to use.</p>
`,
  code: [{
    lang: 'bash', file: 'validator-failover-check.sh', caption: 'A failover gate should refuse to start the standby until the old host is fenced and the signer state is present. Adapt commands to the chain and your infrastructure.',
    src: '#!/usr/bin/env bash\nset -euo pipefail\n\nPRIMARY=validator-a.internal\nSTANDBY_SERVICE=examplechaind\n\n# A timeout is not fencing. The runbook must disable the old host network,\n# revoke its signer access or power it off before this point.\nif ssh -o ConnectTimeout=3 "$PRIMARY" "systemctl is-active --quiet $STANDBY_SERVICE"; then\n  echo "REFUSE: primary validator process is still active" >&2\n  exit 1\nfi\n\n./remote-signer verify --chain-id example-1 --validator "$VALIDATOR_PUBKEY"\nsystemctl start "$STANDBY_SERVICE"\n\n# Record evidence for the incident timeline.\nexamplechaind status --output json\nexamplechaind query slashing signing-info "$VALIDATOR_CONSENSUS_ADDRESS"'
  }],
  lab: 'valops',
  quiz: [
    { q: 'What is the safe precondition for validator failover?', options: ['The standby has more CPU', 'The old signer is fenced and cannot access the consensus key', 'The operator has waited one block', 'Both nodes can reach the internet'], answer: 1, why: 'A timeout does not prove the original validator is incapable of signing. Failover must enforce single active signing authority.' },
    { q: 'Why separate a withdrawal key from a consensus key?', options: ['It lowers block time', 'A compromise of an online signer should not directly control withdrawal of the stake', 'It removes the need for backups', 'It lets two validators share one identity'], answer: 1, why: 'Key separation limits blast radius. The online role needs only the authority required to sign consensus messages.' },
    { q: 'What is an example of a slashable equivocation event?', options: ['A node restarts slowly', 'Two conflicting consensus votes signed for the same height and round', 'A public RPC query times out', 'A log file fills a disk'], answer: 1, why: 'Protocols treat contradictory signatures as a safety failure. Missed blocks are liveness failures and commonly have different penalties.' }
  ],
  tasks: [
    'Use the lab to test a planned failover timeline and identify the moment double-sign risk begins.',
    'Make a key inventory with purpose, custody location, rotation trigger and recovery authority.',
    'Write a two-person emergency procedure for a suspected consensus-key compromise.',
    'Test a remote signer or mock signer rejection for the wrong chain ID and a stale height.'
  ],
  resources: [
    { type: 'docs', title: 'Ethereum validator keys and withdrawal credentials', url: 'https://ethereum.org/en/staking/withdrawals/' },
    { type: 'docs', title: 'CometBFT remote signer', url: 'https://docs.cometbft.com/main/learn/advanced/remote-signer' },
    { type: 'read', title: 'Ethereum slashing protection interchange', url: 'https://eips.ethereum.org/EIPS/eip-3076' }
  ]
});

L.push({
  id: 'l46', module: 10, num: 46,
  title: 'Observability, Upgrades and Incident Response',
  level: 'Advanced', minutes: 90,
  summary: 'Turn node telemetry into actionable alerts, upgrade without gambling on consensus availability, and run an incident from detection to postmortem.',
  objectives: [
    'Define node, consensus, host and RPC service-level indicators',
    'Write alerts that identify a risk before it becomes validator downtime',
    'Plan a canary upgrade, rollback decision and database migration check',
    'Run an incident with evidence, roles, communication and a blameless postmortem'
  ],
  body: `
<h3>Metrics need a decision attached</h3>
<p>Collecting every metric is not observability. An operator needs questions answered early enough to act: Is the node behind the network? Are peers disappearing? Is the signer producing votes? Is disk exhaustion predictable? Is RPC latency degrading only for one expensive method? Metrics, logs and traces answer different parts of that picture.</p>
<div class="table-scroll"><table><thead><tr><th>Signal</th><th>Why it matters</th><th>Typical action</th></tr></thead><tbody>
<tr><td>Latest block lag</td><td>Node may not participate or serve current data</td><td>Inspect peers, consensus and I/O</td></tr>
<tr><td>Missed-vote window</td><td>Approaching jail or liveness penalty</td><td>Escalate before the threshold</td></tr>
<tr><td>Disk-free forecast</td><td>Outage is predictable days ahead</td><td>Expand storage or prune safely</td></tr>
<tr><td>Peer count and churn</td><td>Isolation and eclipse risk</td><td>Check sentries, firewall and seed peers</td></tr>
<tr><td>RPC error rate by method</td><td>Public traffic can starve node resources</td><td>Rate-limit, cache or isolate workload</td></tr>
</tbody></table></div>

<h3>Consensus upgrades are change-management events</h3>
<p>Read the release notes and chain upgrade proposal, verify binaries and checksums, test the exact migration against a snapshot, estimate downtime and disk expansion, and rehearse rollback conditions. Upgrade a non-critical RPC or sentry first where the chain allows it. Validators often must switch at a coordinated height, so “wait and see” can be riskier than a prepared, monitored change.</p>

<h3>Incident response protects the next hour and the next release</h3>
<p>Declare severity, name an incident lead and communications owner, preserve timestamps and commands, and make one reversible change at a time. For a signing incident, prioritise safety: halt or fence before attempting fast recovery. Finish with a blameless postmortem that records impact, timeline, contributing conditions, detection gaps and concrete owners with due dates. “Human error” is not a root cause; ask which guardrail would have made the unsafe action impossible or obvious.</p>
`,
  code: [{
    lang: 'yaml', file: 'alerts.yml', caption: 'Alerts should be tied to a runbook and an action. Names vary by client; use the metrics your node actually exports.',
    src: 'groups:\n  - name: validator-safety\n    rules:\n      - alert: ValidatorFallingBehind\n        expr: (chain_network_height - node_latest_height) > 3\n        for: 2m\n        labels: { severity: page }\n        annotations:\n          summary: "Validator is more than three blocks behind"\n          runbook: "runbooks/validator-lag.md"\n\n      - alert: DiskExhaustionForecast\n        expr: predict_linear(node_filesystem_free_bytes[6h], 24 * 3600) < 0\n        for: 15m\n        labels: { severity: ticket }\n        annotations:\n          summary: "Disk projected to fill within 24 hours"\n          runbook: "runbooks/disk-growth.md"\n\n      - alert: MissedVoteBudgetLow\n        expr: validator_missed_votes_remaining < 10\n        for: 1m\n        labels: { severity: page }\n        annotations:\n          summary: "Validator is near its liveness threshold"\n          runbook: "runbooks/missed-votes.md"'
  }],
  lab: 'opsobserve',
  quiz: [
    { q: 'Which alert is most actionable?', options: ['CPU is 62 percent', 'Disk projected to fill within 24 hours, linked to a storage runbook', 'There are many metrics', 'The node has a name'], answer: 1, why: 'The forecast creates enough time to act and names the response. A raw utilisation number may be normal for a busy node.' },
    { q: 'Why test an upgrade against a snapshot before the coordinated height?', options: ['To avoid reading release notes', 'To discover migration time, storage changes and rollback limits before validator availability is at stake', 'To bypass signature verification', 'To make validators run two versions at once'], answer: 1, why: 'A rehearsal turns unknown migration behaviour into observed evidence. It also lets the team prepare capacity and an explicit go or no-go decision.' },
    { q: 'What comes first in a suspected double-sign incident?', options: ['Restart every node', 'Preserve signing safety by halting or fencing the affected signer', 'Publish a postmortem', 'Increase RPC rate limits'], answer: 1, why: 'The immediate priority is preventing another contradictory signature. Recovery and explanation follow once active signing is safely bounded.' }
  ],
  tasks: [
    'Use the lab to trigger a block-lag, missed-vote and disk forecast alert, then choose the correct first action.',
    'Write one alert for each: consensus safety, host capacity and public RPC abuse.',
    'Create an upgrade checklist with binary verification, snapshot rehearsal, owner, abort conditions and rollback decision.',
    'Draft a one-page incident template with incident lead, timeline, evidence and follow-up owner fields.'
  ],
  resources: [
    { type: 'docs', title: 'Prometheus alerting rules', url: 'https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/' },
    { type: 'docs', title: 'Google SRE incident management', url: 'https://sre.google/workbook/incident-management/' },
    { type: 'docs', title: 'Grafana alerting', url: 'https://grafana.com/docs/grafana/latest/alerting/' }
  ]
});

L.push({
  id: 'l47', module: 10, num: 47,
  title: 'Infrastructure as Code and Validator Ops Capstone',
  level: 'Advanced', minutes: 90,
  summary: 'Make node operations reproducible with declarative infrastructure, immutable releases, tested backups and a capstone runbook that another operator can execute.',
  objectives: [
    'Separate declarative infrastructure from runtime secrets and chain data',
    'Build a repeatable release path with version pinning and verification',
    'Test backups by restoring and validating a node, not by trusting a success log',
    'Deliver an operations capstone with runbooks, alerts and a recovery drill'
  ],
  body: `
<h3>Reproducible beats heroic</h3>
<p>A production node should not depend on commands remembered by one person. Infrastructure as code declares hosts, networks, firewalls, monitoring and service configuration; version control reviews the change; a CI job validates formatting and plans; and a controlled rollout applies it. Keep secrets out of that repository and inject them through a purpose-built secret manager with auditable access.</p>

<h3>Immutable releases and verifiable inputs</h3>
<p>Pin client versions and image digests, verify release signatures or checksums from the upstream project, and record the exact chain ID, genesis checksum, configuration hash and upgrade height. “Latest” is not a release policy. Build a canary path for RPC or sentry nodes first, then promote only when sync, peer health, disk and error-rate checks pass.</p>

<h3>Backups only count after restore</h3>
<p>Back up the data required for recovery: configuration, genesis, addresses, remote-signer or slashing-protection state according to the protocol, and snapshots or databases where appropriate. Encrypt and access-control every sensitive backup. Then restore into an isolated environment, validate the chain identity and state, measure recovery time, and document every manual step. A backup job that reports green but has never restored is an assumption, not a control.</p>

<h3>Capstone: hand the pager to someone else</h3>
<p>Build a testnet validator or node environment that another operator can run from your repository. Include architecture, Terraform or equivalent plan, service configuration, alert rules, upgrade procedure, backup restore proof and an incident runbook. The acceptance test is simple: another person follows the docs and can deploy, monitor, intentionally break and safely recover the system without asking what you meant.</p>
`,
  code: [{
    lang: 'hcl', file: 'main.tf', caption: 'A compact IaC shape: infrastructure parameters are declarative, while validator keys are referenced from a secret system and never embedded in state or user data.',
    src: 'terraform {\n  required_version = ">= 1.6"\n}\n\nvariable "node_image_digest" { type = string }\nvariable "allowed_admin_cidr" { type = string }\n\nresource "example_firewall" "validator" {\n  inbound { port = 26656, cidr = "10.0.0.0/8" } # sentry P2P only\n  inbound { port = 22,    cidr = var.allowed_admin_cidr }\n  outbound { protocol = "tcp", cidr = "0.0.0.0/0" }\n}\n\nresource "example_instance" "validator" {\n  image_digest = var.node_image_digest\n  disk_gb      = 2000\n  firewall_id  = example_firewall.validator.id\n\n  # Fetch an opaque secret reference at runtime. Do not put a key in Terraform.\n  user_data = "remote-signer-endpoint=signer.internal:9443"\n}\n\noutput "validator_private_address" {\n  value = example_instance.validator.private_ip\n}'
  }],
  lab: 'opsrelease',
  quiz: [
    { q: 'What proves a backup is useful?', options: ['A scheduled job says success', 'An isolated restore reaches the expected chain state within the recovery objective', 'The backup file is large', 'It is stored on the same disk as the node'], answer: 1, why: 'Restore testing verifies accessibility, completeness, compatibility and time to recover. A successful upload alone proves none of those.' },
    { q: 'Where should a validator consensus key be stored in an IaC design?', options: ['Hard-coded in Terraform variables', 'In a purpose-built secret or remote-signing system, referenced at runtime', 'Inside a public container image', 'In the monitoring dashboard'], answer: 1, why: 'Versioned infrastructure and remote state have broad read paths. Keep signing authority outside them and grant the node only the narrow access it needs.' },
    { q: 'What makes an operations capstone complete?', options: ['A node starts once', 'Another operator can deploy, monitor, intentionally fail and recover it using the documented runbooks', 'The repository has a logo', 'All alerts are disabled'], answer: 1, why: 'Operations quality is repeatability under normal and failure conditions, not a one-time manual launch.' }
  ],
  tasks: [
    'Use the lab to evaluate a release plan and identify every unsafe configuration choice.',
    'Write IaC for a testnet node, private metrics endpoint and public RPC gateway with explicit firewall rules.',
    'Perform and time an isolated restore; record chain ID, height, integrity checks and recovery time.',
    'Give another person your runbook and run a failure drill without guiding them.'
  ],
  resources: [
    { type: 'docs', title: 'Terraform best practices', url: 'https://developer.hashicorp.com/terraform/tutorials/configuration-language' },
    { type: 'docs', title: 'CIS controls for secure configuration', url: 'https://www.cisecurity.org/controls' },
    { type: 'read', title: 'Google SRE workbook — emergency response', url: 'https://sre.google/workbook/emergency-response/' }
  ]
});

})(window.ROADMAP.lessons);
