# Zen Workspace Scroller

Small CSS-only Zen Browser mod for Arc 2.0 users.

It keeps Zen's Spaces strip synced to the current sidebar width while letting
individual Space buttons keep their natural size. When there are too many
Spaces to fit, the strip scrolls horizontally instead of squeezing icons.

## Root Cause

Zen defines the sidebar footer as `#zen-sidebar-foot-buttons` and inserts
`zen-workspace-icons#zen-workspaces-button` between the expand-sidebar button
and the create-new button.

Zen's `ZenSpaceIcons.mjs` creates each Space as a direct child:

```text
#zen-sidebar-foot-buttons
└── #zen-workspaces-button
    ├── toolbarbutton[zen-workspace-id]
    ├── toolbarbutton[zen-workspace-id]
    └── ...
```

Arc 2.0 styles `#zen-workspaces-button` and its `toolbarbutton` children. A
previous local fix made the outer strip responsive, but it also allowed the
direct workspace buttons to shrink inside the constrained flex row.

This mod keeps the responsive outer width and restores non-shrinking Space
items with horizontal overflow on the actual Zen element.

## Install

Load this mod after Arc 2.0.

If using Sine, install/import the folder:

```text
D:\Zen Backup sine-mods\sine-mods\Zen-Workspace-Scroller
```

If using manual `chrome` files, paste `userChrome.css` content after Arc 2.0 imports in your final `userChrome.css`.

Restart Zen or reload Sine after installing.
