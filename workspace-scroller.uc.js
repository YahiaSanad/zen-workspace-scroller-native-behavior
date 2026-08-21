(() => {
  const STYLE_ID = "zen-workspace-scroller-js-style";
  const LOG_FILE = "wss-debug.log";

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

  writeDebugLine(`[WSS ${new Date().toISOString()}] top-level\n`);

  class WorkspaceScroller {
    constructor(windowRef) {
      this.window = windowRef;
      this.document = windowRef.document;
      this.strip = null;
      this.foot = null;
      this.abortController = new AbortController();
      this.childObserver = null;
      this.activeObserver = null;
      this.resizeObserver = null;
      this.styleElement = null;
      this.checkQueued = false;
      this.lastState = "";
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
      this.window.__wssLoaded = true;
      this.installStyle();
      this.log("loaded", { strip: !!this.strip, foot: !!this.foot });

      this.childObserver = new this.window.MutationObserver(() => this.check());
      this.childObserver.observe(this.strip, { childList: true });

      this.activeObserver = new this.window.MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName === "active") {
            this.scrollActiveIntoView(true);
            break;
          }
        }
      });
      this.activeObserver.observe(this.strip, {
        attributes: true,
        attributeFilter: ["active"],
        subtree: true,
      });

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

      this.strip.addEventListener("wheel", (event) => this.onWheel(event), {
        passive: false,
        signal,
      });

      this.check();
    }

    destroy() {
      this.abortController.abort();
      this.childObserver?.disconnect();
      this.activeObserver?.disconnect();
      this.resizeObserver?.disconnect();
      if (this.strip) {
        this.strip.removeAttribute("wss-scroll");
        this.strip.style.removeProperty("max-width");
      }
      this.styleElement?.remove();
      this.styleElement = null;
      this.strip = null;
      this.foot = null;
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
          overflow: hidden !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
        }

        #zen-workspaces-button {
          box-sizing: border-box !important;
          display: flex !important;
          flex: 1 1 0 !important;
          flex-basis: 0 !important;
          flex-wrap: nowrap !important;
          inline-size: 0 !important;
          width: 0 !important;
          max-inline-size: 100% !important;
          max-width: 100% !important;
          min-inline-size: 0 !important;
          min-width: 0 !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          scrollbar-width: none !important;
          white-space: nowrap !important;
        }

        #zen-workspaces-button > toolbarbutton[zen-workspace-id] {
          flex: 0 0 auto !important;
          flex-shrink: 0 !important;
          inline-size: revert !important;
          max-inline-size: revert !important;
          max-width: revert !important;
          min-inline-size: 26px !important;
          min-width: 26px !important;
          width: revert !important;
        }

        #zen-workspaces-button[wss-scroll] {
          justify-content: flex-start !important;
          scroll-behavior: smooth !important;
        }

        @media (-moz-pref("arc-workspace-style", 0)) {
          #zen-workspaces-button {
            flex: 1 1 0 !important;
            flex-basis: 0 !important;
            inline-size: 0 !important;
            width: 0 !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
          }
        }

        @media (-moz-pref("arc-workspace-style", 2)) {
          #zen-workspaces-button {
            flex: 1 1 0 !important;
            flex-basis: 0 !important;
            inline-size: 0 !important;
            width: 0 !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
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
      if (!buttons.length || !this.foot) {
        this.clearOverflow();
        return;
      }

      const needed = this.neededWidth(buttons);
      const available = this.availableWidth();
      const overflow = buttons.length > 1 && needed > available + 1;

      if (available > 0) {
        this.strip.style.maxWidth = `${Math.floor(available)}px`;
      }

      if (overflow) {
        this.strip.setAttribute("wss-scroll", "true");
      } else {
        this.strip.removeAttribute("wss-scroll");
      }

      const state = `n=${buttons.length} needed=${needed.toFixed(0)} avail=${available.toFixed(
        0,
      )} scroll=${overflow}`;
      if (state !== this.lastState) {
        this.lastState = state;
        this.log(state);
      }
    }

    clearOverflow() {
      if (!this.strip) {
        return;
      }
      this.strip.removeAttribute("wss-scroll");
      this.strip.style.removeProperty("max-width");
    }

    buttons() {
      return [
        ...this.strip.querySelectorAll("toolbarbutton[zen-workspace-id]"),
      ];
    }

    neededWidth(buttons) {
      const styles = this.window.getComputedStyle(this.strip);
      const gap = this.cssPx(styles.columnGap);
      let total =
        gap * (buttons.length - 1) +
        this.cssPx(styles.paddingLeft) +
        this.cssPx(styles.paddingRight);

      for (const button of buttons) {
        total += button.getBoundingClientRect().width;
      }

      return total;
    }

    availableWidth() {
      const styles = this.window.getComputedStyle(this.foot);
      const siblings = [...this.foot.children].filter(
        (child) => child !== this.strip && !child.hidden,
      );
      const gap = this.cssPx(styles.columnGap);
      let available =
        this.foot.clientWidth -
        this.cssPx(styles.paddingLeft) -
        this.cssPx(styles.paddingRight) -
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

    onWheel(event) {
      if (!this.strip.hasAttribute("wss-scroll")) {
        return;
      }
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (!delta) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.strip.scrollLeft += delta;
    }

    scrollActiveIntoView(smooth) {
      if (!this.strip.hasAttribute("wss-scroll")) {
        return;
      }
      const active = this.strip.querySelector('toolbarbutton[active="true"]');
      active?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        inline: "nearest",
        block: "nearest",
      });
    }

    log(message, data = null) {
      const line = `[WSS ${new Date().toISOString()}] ${message}${
        data ? " " + JSON.stringify(data) : ""
      }\n`;
      this.window.console.log(line.trim());
      writeDebugLine(line);
    }
  }

  window.__workspaceScroller?.destroy();
  window.__workspaceScroller = new WorkspaceScroller(window);
  window.__workspaceScroller.init();

  if (typeof window.addUnloadListener === "function") {
    window.addUnloadListener(() => window.__workspaceScroller?.destroy());
  } else {
    window.addEventListener(
      "unload",
      () => window.__workspaceScroller?.destroy(),
      { once: true },
    );
  }
})();
