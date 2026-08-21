(() => {
  const STYLE_ID = "zen-workspace-native-arc-style";
  const LOG_FILE = "wna-debug.log";
  const MAX_BUTTON_SIZE = 32;
  const MIN_BUTTON_SIZE = 16;
  const SEPARATION = 3;

  function writeDebugLine(line) {
    try {
      const writer =
        globalThis.IOUtils ||
        ChromeUtils.importESModule("resource://gre/modules/IOUtils.sys.mjs")
          .IOUtils;
      const tempDir =
        globalThis.PathUtils?.tempDir ||
        Services.dirsvc.get("TmpD", Ci.nsIFile).path;
      const file = globalThis.PathUtils?.join
        ? PathUtils.join(tempDir, LOG_FILE)
        : `${tempDir}\\${LOG_FILE}`;
      writer
        .readUTF8(file)
        .catch(() => "")
        .then((previous) => writer.writeUTF8(file, `${previous}${line}`))
        .catch(() => {});
    } catch {
      /* logging is best-effort */
    }
  }

  class WorkspaceNativeArc {
    constructor(windowRef) {
      this.window = windowRef;
      this.document = windowRef.document;
      this.strip = null;
      this.foot = null;
      this.abortController = new AbortController();
      this.childObserver = null;
      this.resizeObserver = null;
      this.checkQueued = false;
      this.lastState = "";
      this.styleElement = null;
    }

    init() {
      this.strip = this.document.getElementById("zen-workspaces-button");
      this.foot = this.document.getElementById("zen-sidebar-foot-buttons");

      if (!this.strip || !this.foot) {
        this.window.addEventListener(
          "load",
          () => {
            this.strip = this.document.getElementById("zen-workspaces-button");
            this.foot = this.document.getElementById(
              "zen-sidebar-foot-buttons",
            );
            if (this.strip && this.foot) {
              this.start();
            }
          },
          { once: true, signal: this.abortController.signal },
        );
        return;
      }

      this.start();
    }

    start() {
      const signal = this.abortController.signal;
      this.window.__workspaceNativeArcLoaded = true;
      this.installStyle();
      this.log("loaded", { strip: !!this.strip, foot: !!this.foot });

      this.childObserver = new this.window.MutationObserver(() =>
        this.scheduleCheck(),
      );
      this.childObserver.observe(this.strip, { childList: true });

      this.resizeObserver = new this.window.ResizeObserver(() =>
        this.scheduleCheck(),
      );
      this.resizeObserver.observe(this.foot);
      this.resizeObserver.observe(this.strip);

      this.window.addEventListener("resize", () => this.scheduleCheck(), {
        signal,
      });
      this.window.addEventListener(
        "ZenWorkspacesUIUpdate",
        () => this.scheduleCheck(),
        {
          signal,
          capture: true,
        },
      );

      this.check();
    }

    destroy() {
      this.abortController.abort();
      this.childObserver?.disconnect();
      this.resizeObserver?.disconnect();
      this.styleElement?.remove();
      for (const button of this.buttons()) {
        button.style.removeProperty("width");
        button.style.removeProperty("min-width");
        button.style.removeProperty("max-width");
      }
      this.strip?.removeAttribute("icons-overflow");
      this.strip = null;
      this.foot = null;
      this.styleElement = null;
    }

    installStyle() {
      this.document.getElementById(STYLE_ID)?.remove();

      this.styleElement = this.document.createElement("style");
      this.styleElement.id = STYLE_ID;
      this.styleElement.textContent = `
        #zen-sidebar-foot-buttons {
          box-sizing: border-box !important;
          inline-size: 100% !important;
          max-inline-size: 100% !important;
          min-inline-size: 0 !important;
          min-width: 0 !important;
          overflow: hidden !important;
          width: 100% !important;
          max-width: 100% !important;
        }

        #zen-workspaces-button {
          box-sizing: border-box !important;
          container-type: inline-size !important;
          display: flex !important;
          flex: 1 1 0 !important;
          flex-basis: 0 !important;
          flex-wrap: nowrap !important;
          gap: 3px !important;
          inline-size: 0 !important;
          justify-content: center !important;
          max-inline-size: 100% !important;
          max-width: 100% !important;
          min-inline-size: 0 !important;
          min-width: 0 !important;
          overflow: hidden !important;
          overflow-x: hidden !important;
          overflow-y: hidden !important;
          scrollbar-width: none !important;
          white-space: nowrap !important;
          width: 0 !important;
        }

        #zen-workspaces-button[icons-overflow] {
          gap: 0 !important;
          justify-content: safe center !important;
        }

        #zen-workspaces-button > toolbarbutton[zen-workspace-id] {
          flex: 0 1 auto !important;
          flex-shrink: 1 !important;
          max-inline-size: 32px !important;
          max-width: 32px !important;
          min-inline-size: 0 !important;
          min-width: 0 !important;
        }

        @media (-moz-pref("arc-workspace-style", 0)) {
          #zen-workspaces-button {
            flex: 1 1 0 !important;
            flex-basis: 0 !important;
            inline-size: 0 !important;
            overflow: hidden !important;
            width: 0 !important;
          }
        }

        @media (-moz-pref("arc-workspace-style", 2)) {
          #zen-workspaces-button {
            flex: 1 1 0 !important;
            flex-basis: 0 !important;
            inline-size: 0 !important;
            overflow: hidden !important;
            width: 0 !important;
          }
        }
      `;
      this.document.documentElement.appendChild(this.styleElement);
    }

    scheduleCheck() {
      if (this.checkQueued) {
        return;
      }
      this.checkQueued = true;
      this.window.requestAnimationFrame(() => {
        this.checkQueued = false;
        this.check();
      });
    }

    check() {
      const buttons = this.buttons();
      if (!buttons.length) {
        return;
      }

      const available = this.availableWidth();
      const widthPerButton = Math.max(
        (available - SEPARATION * (buttons.length - 1)) / buttons.length,
        MIN_BUTTON_SIZE,
      );
      const buttonWidth = Math.min(widthPerButton, MAX_BUTTON_SIZE);
      const overflow =
        buttons.length * (MIN_BUTTON_SIZE + SEPARATION) > available;

      for (const button of buttons) {
        button.style.setProperty("width", `${buttonWidth}px`, "important");
        button.style.setProperty(
          "max-width",
          `${MAX_BUTTON_SIZE}px`,
          "important",
        );
        button.style.setProperty("min-width", "0", "important");
      }

      if (overflow) {
        this.strip.setAttribute("icons-overflow", "true");
      } else {
        this.strip.removeAttribute("icons-overflow");
      }

      const state = `n=${buttons.length} avail=${available.toFixed(0)} width=${buttonWidth.toFixed(
        1,
      )} overflow=${overflow}`;
      if (state !== this.lastState) {
        this.lastState = state;
        this.log(state);
      }
    }

    buttons() {
      return [
        ...this.strip.querySelectorAll("toolbarbutton[zen-workspace-id]"),
      ];
    }

    availableWidth() {
      if (!this.strip || !this.foot) {
        return 0;
      }
      const footStyles = this.window.getComputedStyle(this.foot);
      const siblings = [...this.foot.children].filter(
        (child) => child !== this.strip && !child.hidden,
      );
      const gap = this.cssPx(footStyles.columnGap);
      let available =
        this.foot.clientWidth -
        this.cssPx(footStyles.paddingLeft) -
        this.cssPx(footStyles.paddingRight) -
        gap * siblings.length;

      for (const sibling of siblings) {
        available -= sibling.getBoundingClientRect().width;
      }

      return Math.max(0, available);
    }

    cssPx(value) {
      const number = Number.parseFloat(value);
      return Number.isFinite(number) ? number : 0;
    }

    log(message, data = null) {
      const line = `[WNA ${new Date().toISOString()}] ${message}${
        data ? " " + JSON.stringify(data) : ""
      }\n`;
      this.window.console.log(line.trim());
      writeDebugLine(line);
    }
  }

  window.__workspaceNativeArc?.destroy();
  window.__workspaceNativeArc = new WorkspaceNativeArc(window);
  window.__workspaceNativeArc.init();

  if (typeof window.addUnloadListener === "function") {
    window.addUnloadListener(() => window.__workspaceNativeArc?.destroy());
  } else {
    window.addEventListener(
      "unload",
      () => window.__workspaceNativeArc?.destroy(),
      {
        once: true,
      },
    );
  }
})();
