# Coaching Guide — How Mike Should Run Stage 1 and When to Switch to Codex

## The stage we are in

We are not in scale-building mode yet.

We are in **repair and architecture stabilisation mode**.

That means Claude Code should lead until the truth/data architecture is stable.

## Your role, Mike

Act like a product owner and technical reviewer.

Do not ask Claude Code to “build the whole product.”
Ask it to complete one bounded stage at a time.

Good instruction style:

```text
Do only Task 1. Fix build/test reliability. Do not add new UI.
```

Bad instruction style:

```text
Fix everything and make it production ready.
```

The second will create sprawl.

## Stage 1 order

Run prompts in this order:

1. Master context
2. Build/test stabilisation
3. /capabilities audit
4. Truth Engine minimum contract
5. /capabilities truth-safe upgrade
6. Connector scaffold

## Stop after each task

After each prompt, ask Claude Code:

```text
Summarise:
1. files changed
2. commands run
3. tests/build result
4. remaining risks
5. whether the next task is safe
```

Do not continue if build/test stability gets worse.

## When to stay with Claude Code

Keep Claude Code leading while work is:

- debugging build failures
- fixing Prisma
- fixing TypeScript architecture
- tracing data flow
- auditing sources
- enforcing ProductScope / TruthRecord logic
- refactoring `/capabilities`
- writing audit reports
- making critical sequencing decisions

Claude Code is better here because it can work locally, inspect files, run commands, and reason across the codebase.

## When to switch to Codex

Switch to Codex when these are true:

1. `npm test` passes.
2. `npm run build` passes.
3. TypeScript passes.
4. `/capabilities` renders truth-safe data.
5. ProductScope is enforced.
6. Truth Engine helpers exist and are tested.
7. Data-source connector interface exists.
8. There is a connector status page.
9. Seed data is visibly labelled.
10. Remaining tasks can be split into independent modules.

Codex is better once tasks are discrete and parallel.

## Best Codex tasks after Stage 1

Use Codex for parallel, PR-shaped tasks:

```text
Implement the SEC connector only. Do not touch unrelated files.
```

```text
Implement the FRED connector only. Add tests and status integration.
```

```text
Implement the Alpha Vantage connector only.
```

```text
Implement the GDELT connector only.
```

```text
Build the capability evidence drawer UI only.
```

```text
Build the data-source status dashboard UI only.
```

```text
Implement vendor docs connector for OpenAI model catalogue only.
```

## Do not switch to Codex too early

If you switch now, Codex may add more feature code on top of weak seed data. That makes the app look better but less trustworthy.

Your current danger is feature sprawl.

The discipline is:

```text
truth first, connectors second, features third.
```

## Your success checklist before Codex

Use this checklist.

- [ ] Build passes
- [ ] Tests pass
- [ ] Prisma issue fixed
- [ ] Google font issue fixed
- [ ] Truth Engine helpers implemented
- [ ] ProductScope registry implemented
- [ ] /capabilities upgraded
- [ ] Seed labels visible
- [ ] Source validation required labels visible
- [ ] Connector interface implemented
- [ ] Data-source status page exists
- [ ] Audit reports written

When at least the first 10 are done, Codex can start helping.

## Coach's blunt advice

Do not let either Claude Code or Codex seduce you with nice UI before the data layer is credible.

AI Enterprise’s advantage is not more cards.

Its advantage is:

```text
credible, source-backed AI market intelligence.
```

Every development decision should protect that.
