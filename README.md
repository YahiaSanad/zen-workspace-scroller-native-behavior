# Zen Workspace Scroller

Zen Browser mod for Arc 2.0 users.

Keeps the sidebar at its current width no matter how many Spaces you add.
When the Space icons no longer fit, the strip scrolls horizontally instead
of widening the sidebar — the same fit-based overflow stock Zen uses, plus
JavaScript for smooth scrolling behavior.

## Behavior

- Sidebar width never grows when adding Spaces.
- Fit-based trigger: scrolling starts only when icons physically exceed
  the available strip width (around 5+ Spaces at default sizes).
- Below the threshold nothing changes: Arc centers the icons as usual.
- Mouse wheel over the strip scrolls it horizontally while overflowing.
- Switching to a Space scrolled out of view auto-scrolls it into view
  (smooth, same as stock Zen's `scrollIntoView` in `ZenSpaceIcons.mjs`).

## Root Cause

Zen defines the sidebar footer as `#zen-sidebar-foot-buttons` and inserts
`zen-workspace-icons#zen-workspaces-button` between the expand-sidebar button
and the create-new button:

```text
#zen-sidebar-foot-buttons
└── #zen-workspaces-button
    ├── toolbarbutton[zen-workspace-id]
    ├── toolbarbutton[zen-workspace-id]
    └── ...
```

Arc 2.0 styles every Space button with `flex-shrink: 0; width: auto;
max-width: none`, and styles the workspace strip itself with `width: auto`.
That makes the strip use its content width, so each added fixed-width Space
can increase the sidebar/footer width.

Stock Zen avoids this by measuring the icons on window resize
(`ZenSpaceManager.mjs` → `onWindowResize`) and clamping them. This mod
keeps Arc's full-size icons and instead makes the strip an elastic flex
slot with `flex: 1 1 0`, `width: 0`, and `min-width: 0`: CSS pins the strip
to the footer width, and a small chrome script toggles a
`[wss-scroll]` attribute when the icons overflow, wires up wheel-to-
horizontal scrolling, and scrolls the active Space into view.

## Install

Load this mod after Arc 2.0 (Arc first, then this one).

If using Sine:

1. Install/import the folder:
   ```text
   D:\Zen Backup sine-mods\sine-mods\Zen-Workspace-Scroller
   ```
2. JavaScript requires Sine v2.3+. Sine runs mod scripts only when the mod
   is store-origin or when local unsafe JavaScript is enabled. This AppData
   hotfix registers the public GitHub mod as `origin: "store"` in
   `mods.json`, so no browser security preference needs to be changed.
3. Restart Zen or reload Sine after installing.

If using manual `chrome` files, paste `userChrome.css` content after Arc 2.0
imports in your final `userChrome.css`; the JS part needs a userChromeJS
loader (Sine or fx-autoconfig) pointing at `workspace-scroller.uc.js`.
