# HireHop Plugins

Custom JavaScript plugins for [HireHop](https://www.hirehop.co.uk) rental software.

This repo is structured as a **loader + tools**:

- **`loader.js`** — the single URL you put in HireHop. It loads the enabled tools
  and provides the shared machinery that injects their entries into the Supplying
  tab's **New (+)** menu (both the top-left New button dropdown and the right-click
  context menu).
- **`tools/`** — one self-contained file per tool. Each registers itself with the
  loader and owns its own behaviour and version.
  - `tools/stage-designer.js`
  - `tools/videowall-creator.js`

---

## Installation

In HireHop, go to **Settings → Company Settings → Plugins** and add the **loader**
URL (pinned to a release tag):

```
https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@v0.1.23/loader.js
```

> ⚠️ **Use jsDelivr, not `raw.githubusercontent.com`.** GitHub serves raw files as
> `text/plain` with `X-Content-Type-Options: nosniff`, so browsers **refuse to
> execute them as JavaScript** (silently). jsDelivr serves `application/javascript`.

## Turning tools on/off

Edit the `TOOLS` config block at the top of `loader.js`:

```js
var TOOLS = {
  "stage-designer":    { on: true,  ref: "main" },
  "videowall-creator": { on: false, ref: "main" }   // off
};
```

- `on` — whether to load the tool.
- `ref` — which git ref to load it from: `"main"` for the latest, or pin to a tag
  (e.g. `"stage-designer-v0.1.0"`) for stability.

After editing the loader, cut a new loader release and update the HireHop URL's tag.

## Versioning

- The **loader** has its own version (`loader.js` header + a repo tag like `v0.1.1`).
- Each **tool** has its own version (its file header), and can be pinned to its own
  tag via the loader's `ref`.
- jsDelivr tags are immutable and served instantly. `@main` is cached (~7 days) and
  ignores `?v=` query strings — to refresh a `main` ref quickly, purge it:
  `https://purge.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@main/tools/<tool>.js`

## Writing a new tool

Create `tools/<id>.js` that registers itself once the loader is present:

```js
(function () {
  function register() {
    if (!window.HHTools || !window.HHTools.register) { setTimeout(register, 50); return; }
    window.HHTools.register({
      id: "my-tool",
      label: "My Tool",
      icon: "ui-icon-image",          // a jQuery UI ui-icon-* class
      onClick: function (inst) { window.alert("My Tool"); }
    });
  }
  register();
})();
```

Then add it to the `TOOLS` config in `loader.js`.

---

## How it works

The Supplying tab is built by HireHop's **items** widget (`$.custom.items`,
`/js/items.js`) — there is no `supplying` widget. Its instance is created lazily
(and re-rendered) when the tab is opened, and is stored on the tab panel element
`.custom_itemsFrame`. It exposes two New menus:

- `new_item_popup_menu` — the top-left **New (+)** button dropdown (a clone;
  refreshed with `.menu("refresh")`).
- `new_menu` — the **New** submenu inside the right-click context menu
  (`popup_menu`; refreshed via `popup_menu.menu("refresh")`).

The loader waits for jQuery, then runs a light, idempotent interval that, for each
items instance, ensures a separator plus one entry per registered tool exists in
both menus. The interval approach is used because hooking the widget's init is racy
against the lazy creation / re-rendering of the tab.

### Discovering widget names

HireHop's JS files are minified but readable by appending `.MAX` to the filename:

- `https://myhirehop.com/js/items.MAX.js` — the **items** widget (Supplying tab)
- `https://myhirehop.com/js/notes.MAX.js` — the notes tab widget

---

## Notes

- Plugins only load on paid HireHop accounts, and **not** on the Settings page.
- Load via a host that serves `application/javascript` (jsDelivr), **not** raw GitHub.
- Never put API tokens in plugin JavaScript — it runs in the browser and is public.
- Use `?no_plugins=1` as a URL parameter to disable plugins on any page for debugging.
