# HireHop Plugins

Custom JavaScript plugins for [HireHop](https://www.hirehop.co.uk) rental software.

---

## Stage Designer (`stage-designer-button.js`)

Adds a **ðŸŽ­ Stage Designer** entry to the bottom of the **New (+) dropdown menu** on the **Supplying tab**.

The entry is currently a placeholder (it does nothing yet). It is the first step toward a full stage designer tool that will:
- Pull predefined staging parts from your stock list
- Auto-scale layouts based on stage dimensions and options selected
- Allow visual drag-and-drop stage planning from within a job

### Installation

1. **Fork or upload** this file to your own GitHub repository.
2. Use the **jsDelivr** URL for the file (see the important note below), e.g.:
   ```
   https://cdn.jsdelivr.net/gh/YOUR_USERNAME/YOUR_REPO@main/stage-designer-button.js
   ```
3. In HireHop, go to **Settings â†’ Company Settings â†’ Plugins**.
4. Paste the jsDelivr URL into the Plugins field. If you have other plugins, separate them with a semicolon (`;`).

> âš ï¸ **Do not use the `raw.githubusercontent.com` URL.** GitHub serves raw files as
> `Content-Type: text/plain` with `X-Content-Type-Options: nosniff`, so browsers
> **refuse to execute them as JavaScript** (and the failure is silent). jsDelivr
> mirrors the same repo and serves the file as `application/javascript`, so it runs.

### Updating

jsDelivr caches the `@main` URL (up to ~7 days), so a push may not appear immediately. To control updates:
- **Force a refresh:** purge the cache via
  `https://purge.jsdelivr.net/gh/YOUR_USERNAME/YOUR_REPO@main/stage-designer-button.js`
- **Pin to a release** for predictable, instant updates, e.g. `@v1.7` instead of `@main`
  (create a matching git tag/release).

### Verifying it works

Open any job in HireHop, click the **Supplying** tab, then click the **New (+)** button. You should see **ðŸŽ­ Stage Designer** at the bottom of the dropdown.

### How it works

HireHop injects plugin JS files into every page. The Supplying tab is built by the **items** widget (`$.custom.items`, `/js/items.js`) â€” there is no `supplying` widget. The items widget's instance is created lazily (and re-rendered) when the Supplying tab is opened, and its New (+) dropdown (`new_item_popup_menu`) lives on the page body.

Rather than hook the widget's init (which is racy against lazy creation and re-renders), this plugin:

1. Waits for jQuery, then runs a light, idempotent interval (it does **not** depend on `$(document).ready`).
2. On each tick, finds the items widget instance via its tab panel element (`.custom_itemsFrame`).
3. Appends a `<li>` to the New dropdown matching HireHop's native menu markup, then calls `menu("refresh")`.

The interval is cheap (a class lookup) and bails immediately once the entry already exists.

### Discovering widget names

HireHop's JS files are minified but readable by appending `.MAX` to the filename:
- `https://myhirehop.com/js/items.MAX.js` â€” the **items** widget that powers the Supplying tab
- `https://myhirehop.com/js/notes.MAX.js` â€” the notes tab widget

Use browser DevTools (F12 â†’ Network tab) while clicking around HireHop to discover which `.js` files are loaded and which widget names they define.

---

## Notes

- Plugins only load on paid HireHop accounts.
- Plugins do **not** load on the Settings page (by design).
- Load plugins via a host that serves `application/javascript` (e.g. jsDelivr), **not** `raw.githubusercontent.com`.
- Never put API tokens in plugin JavaScript â€” they run in the browser and are publicly visible.
- Use `?no_plugins=1` as a URL parameter to disable plugins on any page for debugging.
