# GitHub Publish Plan

This is a local drafting note for how the repo should be presented before anything is pushed to GitHub.

## Proposed Branch Layout

- `main`
  - current Qtooley stock UI overlay
  - primary project branch
- `standalone-at-terminal`
  - older standalone LAN AT terminal
  - legacy / fallback / reference branch

## Main Branch Messaging

The main branch should present the project as:

- `CFW-3212 Qtooley Overlay`
- focused on the Casa stock UI overlay path
- clearly scoped to Casa Systems `CFW-3212` + Quectel `RG520N-NA`
- not a generic USB modem project

## Standalone Branch Messaging

The standalone branch should be clearly labeled:

- legacy standalone AT terminal
- older project track
- useful as a fallback or reference
- not the primary maintained direction

## Shared Warning To Include

Both branches should mention:

- both tracks share backend assumptions
- both depend on the same platform-native modem access model
- both use the same shared AT lock discipline
- users should not casually install/run both without understanding the overlap

## Suggested Legacy Branch README Heading

`CFW-3212 Standalone AT Terminal (Legacy Branch)`

## Suggested Main Branch Heading

`CFW-3212 Qtooley Overlay`
