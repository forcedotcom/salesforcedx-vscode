# Effect Atom Patterns

Reactive state for React via `@effect-atom/atom-react`. Atom integrates Effect with React rendering.

## Basic Atoms

Define atoms OUTSIDE components (creating inside render makes a new atom each render).

```typescript
import { Atom } from '@effect-atom/atom-react';

const countAtom = Atom.make(0);

// keepAlive for global state that must persist across unmounts
const userPrefsAtom = Atom.make({ theme: 'dark' }).pipe(Atom.keepAlive);
```

## Atom Families (per-entity state)

`Atom.family` returns a stable atom per key — same key yields same atom.

```typescript
const modalAtomFamily = Atom.family((type: string) =>
  Atom.make({ isOpen: false }).pipe(Atom.keepAlive)
);

// Per-user query atom
const userAtomFamily = Atom.family((userId: UserId) =>
  Atom.make(Effect.gen(function* () {
    const users = yield* UserService;
    return yield* users.findById(userId);
  }))
);
```

## React Integration

```typescript
import { useAtomValue, useAtomSet, useAtom, useAtomMount } from '@effect-atom/atom-react';

function Counter() {
  const count = useAtomValue(countAtom); // read only
  const setCount = useAtomSet(countAtom); // write only
  const [value, setValue] = useAtom(countAtom); // read + write

  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// Mount a side-effect atom without reading its value
function App() {
  useAtomMount(keyboardShortcutsAtom);
  return <>{children}</>;
}
```

Use `useAtomSet` to update from components — never `Atom.update` imperatively from React.

## Handling Results with Result.builder

Effectful atoms yield `Result<A, E>`. Render with `Result.builder` — chainable, handles loading/error/success. `onErrorTag` matches a tagged error before the catch-all `onError`.

```typescript
import { Result } from '@effect-atom/atom-react';

function UserProfile() {
  const userResult = useAtomValue(userAtom); // Result<User, Error>

  return Result.builder(userResult)
    .onInitial(() => <div>Loading...</div>)
    .onErrorTag('NotFoundError', () => <div>User not found</div>)
    .onError(error => <div>Error: {error.message}</div>)
    .onSuccess(user => <div>Hello, {user.name}</div>)
    .render();
}
```

Always handle loading + error states; don't render only the success case.

## Atoms with Side Effects

A reader function gets `get`; register cleanup with `get.addFinalizer` (REQUIRED for listeners/subscriptions).

```typescript
const scrollYAtom = Atom.make(get => {
  const onScroll = () => get.setSelf(window.scrollY);

  window.addEventListener('scroll', onScroll);
  get.addFinalizer(() => window.removeEventListener('scroll', onScroll)); // REQUIRED

  return window.scrollY;
}).pipe(Atom.keepAlive);
```

## localStorage Persistence

Hydrate from storage in the reader, persist on set via a finalizer or a write atom.

```typescript
const themeAtom = Atom.make(get => {
  const stored = localStorage.getItem('theme');
  return stored ?? 'dark';
}).pipe(Atom.keepAlive);

// Write-through: persist whenever set
const setThemeAtom = Atom.writable(
  get => get(themeAtom),
  (ctx, value: string) => {
    localStorage.setItem('theme', value);
    ctx.set(themeAtom, value);
  }
);
```

## Anti-Patterns

```typescript
// WRONG - atom created inside render: new atom every render, state lost
function Bad() {
  const atom = Atom.make(0); // never do this
  const v = useAtomValue(atom);
}

// WRONG - global/persistent state without keepAlive: dropped when no subscribers
const sessionAtom = Atom.make(initialSession); // add .pipe(Atom.keepAlive)

// WRONG - imperative update from React
Atom.update(countAtom, c => c + 1); // use useAtomSet instead

// WRONG - side-effect atom without finalizer: listener leaks
Atom.make(get => {
  window.addEventListener('resize', onResize); // no get.addFinalizer cleanup
  return window.innerWidth;
});

// WRONG - rendering only success, ignoring loading/error
const user = useAtomValue(userAtom);
return <div>{user.value.name}</div>; // crashes during Initial/Failure
```
