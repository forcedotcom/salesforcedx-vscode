# The Org Browser: Your Org, Your Code, One Living View

## The Problem

Salesforce developers are flying blind.

Today, your local project and your org are two disconnected worlds. You edit files in VS Code, and somewhere out there, an org has its own version of the truth. Is your local code ahead? Behind? Conflicting with a teammate's deployment? The only way to know is to stop what you're doing, open a terminal, run a CLI command, and parse the output. Every. Single. Time.

That constant context-switching -- between your editor and your terminal, between your project and a browser tab showing Setup -- is where productivity goes to die. Not in big dramatic failures, but in thousands of small interruptions that break your flow.

We fixed that.

## What the Developer Sees Now

Open the Org Browser sidebar and you're looking at a single, unified view of *everything* -- every metadata type, every component, whether it lives in your local project, in the org, or both. And critically: whether it's in sync.

- A **green checkmark** means you're good.
- A **yellow arrow** means you changed something locally that hasn't been deployed.
- A **blue arrow** means someone changed it in the org and you haven't pulled it yet.
- A **warning icon** means you've got a conflict -- and you see it *now*, not when your deploy fails at 5pm on a Friday.

At the top of the tree, a **Pending Changes** section rolls all of this up: "3 local changes, 2 remote changes, 1 conflict." That's your to-do list, always visible, always current. No commands to run. No output to parse. It's just *there*.

## Four Ways to Look at the Same World

Not every moment calls for the same view. Four modes, switchable with a single click:

1. **Project view** -- just the types and components in your local project. Focused. Clean.
2. **Local only** -- even tighter: only what you've touched.
3. **Org only** -- everything in the org that you *don't* have locally. This is the discovery mode. "What else is out there?"
4. **All types** -- the full catalog. Every metadata type the org supports, whether you're using it or not.

That third mode -- org only -- is the one that changes how teams think about their work. A developer stops seeing just their slice and starts seeing the whole landscape. Components they didn't know existed. Types they've never worked with. The org stops being an abstract black box and becomes navigable terrain.

## Filter by What Matters, Not by What You Remember

An intelligent filter with composable query syntax turns a thousand-component org into a focused, actionable list:

| Filter | What it shows |
|--------|---------------|
| `ApexClass` | Just the ApexClass type |
| `Layout:Account` | Only the Account Layout |
| `@conflict` | Every conflict across every metadata type |
| `@modified @remote` | Everything that changed in the org since you last synced |
| `@deleted @local` | Locally deleted items |
| `@added @remote` | Recently added in the org |

Tags are intuitive: `@added`, `@modified`, `@deleted`, `@conflict`, `@synced`, `@local`, `@remote`. Combine them freely. The filter suggests matching types as you type, and tag completions appear after `@`. Filter state persists across sessions.

## Act Without Leaving Your Editor

See a remote change? Click **Pull**. Ready to deploy your local edits? Click **Deploy**. Want to check what a component looks like in the org without cluttering your project? Click **Preview** -- it opens read-only, in a VS Code tab, no download required.

Need to retrieve an entire filtered set? One button. Deploy all your local changes? One button. Create a new Apex class right from the type node? One button.

This isn't about replacing the CLI. It's about making the 80% workflow -- browse, understand, sync -- require zero terminal interaction.

## Custom Object Introspection

Expanding a CustomObject shows all custom fields with sync state. Drill down to field-level granularity for retrieval and deployment. Field labels show type, length, precision, and relationship names. No more jumping to Setup to check if a field exists or what it looks like.

## The Real Shift: From Reactive to Aware

Here's what changes at a deeper level. Before this, source tracking was something you *did* -- a deliberate act of running a command to find out what happened. Now it's something you *see* -- a passive, continuous awareness of the relationship between your code and your org.

That shift matters because:

- **Conflicts surface immediately**, not at deployment time. The cost of a conflict drops from "broken deploy + emergency triage" to "oh, I see a warning icon, let me handle that before lunch."

- **Team coordination improves organically.** When you can see that three Apex classes were modified remotely this morning, you pull them before you start coding -- not because a process told you to, but because the information was right there.

- **Onboarding accelerates.** A new developer on the team can open the Org Browser and *see* the shape of the org: what metadata types exist, how many components, what's been changing. That's context that used to take weeks to absorb.

- **Decision-making gets better.** "Should I retrieve this component?" stops being a guess. You can see its sync state, preview the org version, and make an informed choice -- all without leaving VS Code.

## Before and After

| Before | After |
|--------|-------|
| "Is this in the org or just my project?" | Unified view shows both, with sync status |
| "What needs syncing?" | Pending Changes section makes it obvious |
| "Retrieve that component" | One-click retrieval from context menu |
| "Deploy my changes" | Bulk deploy all local changes in one click |
| "Which components changed in the org?" | Remote Changes group shows them all |
| "I have a conflict, what do I do?" | Conflicts section highlights both versions |
| "Navigate large orgs" | Four view modes + intelligent filtering |
| "What does this look like in the org?" | Preview org version without downloading |
| "Create a new class" | Context menu integration with generators |
| "Did my deploy work?" | Tree auto-refreshes after deploy completes |

## The One-Liner

**The Org Browser turns your disconnected workspace into a live, navigable map of everything in your org and everything in your project -- with every difference, every conflict, and every action one click away.**

You stop managing two separate realities and start working in one.
