# HireHop Plugins

Custom JavaScript plugins for [HireHop](https://www.hirehop.co.uk) rental software.

---

## Stage Designer Button (`stage-designer-button.js`)

Adds a **🎭 Stage Designer** button to the **Supplying tab** toolbar, sitting next to the existing menu button.

This is the first step toward a full stage designer tool that will:
- Pull predefined staging parts from your stock list
- Auto-scale layouts based on stage dimensions and options selected
- Allow visual drag-and-drop stage planning from within a job

### Installation

1. **Fork or upload** this file to your own GitHub repository.
2. Go to the **raw file URL**, e.g.:
   ```
   https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/stage-designer-button.js
   ```
3. In HireHop, go to **Settings → Company Settings → Plugins**.
4. Paste the raw URL into the Plugins field. If you have other plugins, separate them with a semicolon (`;`).
5. To force browsers to reload after updates, append a version query string:
   ```
   https://raw.githubusercontent.com/.../stage-designer-button.js?v=1
   ```
   Increment `v=1` → `v=2` etc. after each update.

### Verifying it works

Open any job in HireHop and click the **Supplying** tab. You should see the **🎭 Stage Designer** button appear in the toolbar. Clicking it shows a confirmation alert with the current job number.

### How it works

HireHop injects plugin JS files into every page. This plugin:

1. Waits for `$(document).ready`
2. Checks that `$.custom.supplying` exists (the jQuery UI widget that powers the Supplying tab)
3. Extends the widget's `_init_main` function using jQuery UI's inheritance pattern
4. Injects a button after the menu button using HireHop's own `hh_btn` class

A **MutationObserver fallback** is also included in case the widget name varies or loads after the plugin.

### Discovering widget names

HireHop's JS files are minified but readable by appending `.MAX` to the filename:
- `https://myhirehop.com/js/supplying.MAX.js` — the supplying tab widget
- `https://myhirehop.com/js/notes.MAX.js` — the notes tab widget

Use browser DevTools (F12 → Network tab) while clicking around HireHop to discover which `.js` files are loaded and which widget names they define.

---

## Notes

- Plugins only load on paid HireHop accounts.
- Plugins do **not** load on the Settings page (by design).
- Never put API tokens in plugin JavaScript — they run in the browser and are publicly visible.
- Use `?no_plugins=1` as a URL parameter to disable plugins on any page for debugging.
