/*!
 * HireHop Plugin: Stage Designer Button
 * Adds a "Stage Designer" button to the Supplying tab toolbar,
 * next to the existing menu button.
 *
 * GitHub: https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/stage-designer-button.js
 * Usage: Add the above URL to Settings -> Company Settings -> Plugins
 *
 * Version: 1.0
 */

$(document).ready(function () {

  // Safety checks: only run when logged in and on a job/document page
  if (typeof user === "undefined" || typeof doc_type === "undefined") {
    return;
  }

  // ── Approach 1: Extend the supplying widget (preferred) ──────────────────
  // The supplying tab widget is $.custom.supplying (found at /js/supplying.js).
  // We override _init_main to inject our button after the widget initialises.

  if (typeof $.custom !== "undefined" && typeof $.custom.supplying !== "undefined") {

    $.widget("custom.supplying", $.custom.supplying, {

      _init_main: function () {
        // Call the original _init_main first
        this._super(arguments);
        // Then inject our button
        this._add_stage_designer_button();
      },

      _add_stage_designer_button: function () {
        var self = this;

        // Create the button using HireHop's own button style
        var btn = $("<button>", {
          html: "🎭 Stage Designer",
          title: "Open the Stage Designer tool",
          // Use HireHop's standard toolbar button class so it matches the UI
          "class": "hh_btn",
          css: {
            "margin-left": "4px"
          }
        });

        btn.on("click", function () {
          self._open_stage_designer();
        });

        // Insert after the menu button.
        // HireHop stores toolbar button references on `this`; the menu button
        // is typically this.btnMenu. If it doesn't exist we fall back to
        // appending to the toolbar container.
        if (self.btnMenu && self.btnMenu.length) {
          btn.insertAfter(self.btnMenu);
        } else {
          // Fallback: append to whatever toolbar wrapper the widget builds
          var toolbar = self.element.find(".hh_toolbar, .toolbar, [class*='toolbar']").first();
          if (toolbar.length) {
            btn.appendTo(toolbar);
          } else {
            // Last resort: prepend to the widget element itself
            btn.prependTo(self.element);
          }
        }
      },

      _open_stage_designer: function () {
        // Placeholder action — replace with your stage designer UI/URL
        // For now we just show a simple alert so you can confirm the button works.
        alert(
          "Stage Designer\n\n" +
          "Job: " + (typeof job_data !== "undefined" ? job_data.JOB : "unknown") + "\n\n" +
          "(This is where your stage designer will open.)"
        );

        // Future: open a dialog, iframe, or navigate to your designer page, e.g.:
        // window.open("https://YOUR_GITHUB_PAGES_URL/stage-designer/?job=" + job_data.JOB, "stage_designer");
      }

    });

  } else {

    // ── Approach 2: MutationObserver fallback ─────────────────────────────
    // If the widget name is different or loads late, watch the DOM for the
    // supplying tab container and inject the button directly.

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          // The supplying tab div has id="supplying_tab" in most HireHop versions
          var tab = (node.id === "supplying_tab") ? $(node) : $(node).find("#supplying_tab");
          if (tab.length && !tab.data("stage_btn_added")) {
            tab.data("stage_btn_added", true);
            injectButton(tab);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    function injectButton(tabEl) {
      // Find the first toolbar-like container inside the supplying tab
      var toolbar = tabEl.find(".hh_toolbar, .toolbar, [class*='toolbar']").first();
      if (!toolbar.length) toolbar = tabEl;

      var btn = $("<button>", {
        html: "🎭 Stage Designer",
        title: "Open the Stage Designer tool",
        "class": "hh_btn",
        css: { "margin-left": "4px" }
      });

      btn.on("click", function () {
        alert(
          "Stage Designer\n\n" +
          "Job: " + (typeof job_data !== "undefined" ? job_data.JOB : "unknown") + "\n\n" +
          "(This is where your stage designer will open.)"
        );
      });

      // Try to sit next to a menu button, otherwise just prepend
      var menuBtn = toolbar.find("button[class*='menu'], button[title*='Menu'], button[title*='menu']").first();
      if (menuBtn.length) {
        btn.insertAfter(menuBtn);
      } else {
        toolbar.prepend(btn);
      }
    }
  }

});
