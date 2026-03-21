# State of Things (Command)

## ✅ FIXED
- [v1.0.0] Unified `TaskEdit` component replaces duplicated form in `TaskBoard`.
- [v1.0.0] `PromptGenerator` state persistence with `sessionStorage` in `revisionUtils`.
- [v1.0.0] Bidirectional navigation between `TaskBoard` and `PromptGenerator` with `returnTo` param.
- [v1.0.0] Renamed `PromptBuilder` to `PromptGenerator` everywhere.

## 🔄 POSSIBLE
-   Clean up unused state (e.g. `applyError`) in `PromptGenerator.tsx`.
-   Increase lint discipline for `any` types.
-   Add automated tests for `revisionUtils`.
