# Zen Workspace Native Arc

Arc 2.0 companion mod for Zen Browser.

This version does not make the workspace strip horizontally scrollable. It
keeps Arc 2.0's workspace styling, but restores Zen's native sizing model:
the workspace strip uses the available sidebar footer width, and each Space
button is resized by the same fit-based logic Zen uses in
`ZenSpaceManager.mjs`.

## Behavior

- No horizontal scrolling added by this mod.
- Sidebar footer keeps the current sidebar width.
- Arc's `width: auto` workspace strip rule is overridden.
- Arc's fixed/non-shrinking button rules are overridden.
- Space buttons resize between Zen-style minimum and maximum sizes.
- Adding Spaces does not make the sidebar grow.
- Arc's style 0/style 2 hover animation stays intact: inactive spaces show
  dots, the active space shows its icon, and hovered spaces reveal their icons.

## Source Evidence

Zen creates this DOM in `zen-sidebar-icons.inc.xhtml`:

```text
#zen-sidebar-foot-buttons
├── #zen-expand-sidebar-button
├── zen-workspace-icons#zen-workspaces-button
└── #zen-create-new-button
```

`ZenSpaceIcons.mjs` creates each Space as a direct
`toolbarbutton[zen-workspace-id]` child.

`zen-workspaces.css` makes `#zen-workspaces-button` a flex row with
`width: 100%`, `gap: 3px`, and workspace buttons with a Zen-sized max width.

`ZenSpaceManager.mjs` resizes workspace buttons in `onWindowResize()` using:

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
cannot win. This mod applies Zen's sizing as inline `!important` after Arc.

## Install

Load after Arc 2.0.

If using Sine, keep this mod enabled and disable `Zen-Workspace-Scroller`.
Restart Zen after changing active mods.
