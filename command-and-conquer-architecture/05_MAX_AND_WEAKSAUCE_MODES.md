# MAX and WeakSAUCE Modes

## MAX
Use for:
- architecture
- refactors
- migrations
- risky patches
- cross-system work

Load:
- project primer
- source-of-truth index
- architecture/data flow
- mechanics/system rules
- risk map
- selected cheat sheets
- task spec
- carry-forward notes
- decision anchors from related tasks (AI pulls relevant context)

Behavior:
- full logic
- aggressive context use
- broad reasoning
- expensive but safer for hard work

## WeakSAUCE
Use for:
- tiny bug fixes
- one-file patches
- local UI fixes
- clear targeted work

Load only:
- task spec
- must-not-break rules
- one relevant cheat sheet
- named files
- relevant decision anchors (if any)

Behavior:
- minimum context
- minimum tokens
- no broad repo reread
- no scope widening
- refuse architecture speculation

## Selection rule
Planner recommends mode based on task analysis. User can override.

Task size correlates but does not determine mode:
- Micro tasks are almost always WeakSAUCE
- Standard tasks can be either
- Major tasks are almost always MAX
