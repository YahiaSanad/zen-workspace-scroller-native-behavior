# Zen Workspace Scroller Native Behavior

Zen Browser mod for Arc 2.0 users.

This is the native-behavior version of Zen Workspace Scroller. It does not
make the workspace strip horizontally scrollable. Instead, it keeps Arc 2.0's
workspace styling while restoring Zen's native fit-based workspace sizing:
the sidebar footer stays at the current sidebar width, and each Space button
is resized by the same sizing model Zen uses in `ZenSpaceManager.mjs`.

## Behavior

- No horizontal scrolling added by this mod.
- Sidebar width never grows when adding Spaces.
- Fit-based sizing: Space buttons shrink only within Zen's normal min/max
  range instead of forcing the sidebar wider.
- Arc's `width: auto` workspace strip rule is overridden.
- Arc's fixed/non-shrinking button rules are overridden.
- Space buttons resize between Zen's native minimum and maximum sizes.
- Arc's style 0/style 2 hover animation stays intact: inactive spaces show
  dots, the active space shows its icon, and hovered spaces reveal their icons.
- Zen's footer Library button remains visible on hover because the workspace
  fix no longer rewrites the footer's display model.
- Footer width is measured through `getBoundingClientRect()` with ancestor
  and safe-width fallback for newer Zen builds where XUL `clientWidth` can
  report `0` during startup.

## Root Cause

Zen defines the sidebar footer as `#zen-sidebar-foot-buttons` and inserts
`zen-workspace-icons#zen-workspaces-button` between the expand/sidebar or
Library controls and the create-new button:

```text
#zen-sidebar-foot-buttons
├── #zen-library-button / #zen-expand-sidebar-button
├── #zen-workspaces-button
│   ├── toolbarbutton[zen-workspace-id]
│   ├── toolbarbutton[zen-workspace-id]
│   └── ...
└── #zen-create-new-button / add button
```

Stock Zen makes `#zen-workspaces-button` a flex row and resizes workspace
buttons in `ZenSpaceManager.mjs` using:

- `maxButtonSize = 32`
- `minButtonSize = 16`
- `separation = 3`
- `widthPerButton = (parent.clientWidth - separation * (count - 1)) / count`

Arc 2.0 overrides that with:

```css
#zen-workspaces-button toolbarbutton {
  flex-shrink: 0 !important;
  width: auto !important;
  max-width: none !important;
  min-width: 26px !important;
}

#zen-workspaces-button {
  width: auto !important;
}
```

Because Arc uses `!important`, Zen's normal inline `style.width = "...px"`
cannot win. Arc's non-shrinking buttons can then make the workspace strip
grow with its content, which can widen the sidebar or crush the updated
footer controls.

This mod keeps the strip inside the available footer width with
`flex: 1 1 0`, `width: 0`, and `min-width: 0`, then applies Zen's fit-based
button width as inline `!important` after Arc. It intentionally avoids
rewriting the whole footer display model so new Zen footer controls, including
the Library button, keep their native behavior.

## Install

Load this mod after Arc 2.0 (Arc first, then this one).

If using Sine:

1. Install/import the folder:
   ```text
   D:\Zen Backup sine-mods\sine-mods\Zen-Workspace-Native-Arc
   ```
2. JavaScript requires Sine v2.3+. Sine runs mod scripts only when the mod
   is store-origin or when local unsafe JavaScript is enabled. This AppData
   hotfix registers the public GitHub mod as `origin: "store"` in
   `mods.json`, so no browser security preference needs to be changed.
3. Keep this mod enabled and disable `Zen-Workspace-Scroller`.
4. Restart Zen or reload Sine after installing.

If using manual `chrome` files, paste `userChrome.css` content after Arc 2.0
imports in your final `userChrome.css`; the JS part needs a userChromeJS
loader (Sine or fx-autoconfig) pointing at `workspace-native-arc.uc.js`.
