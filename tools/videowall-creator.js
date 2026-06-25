/*!
 * HireHop Tool: Videowall Creator
 * Loaded by loader.js, which provides window.HHTools.register().
 * Currently a placeholder: clicking the entry shows a confirmation dialog.
 *
 * Version: 0.1.0
 */

(function () {

  function register() {
    if (!window.HHTools || !window.HHTools.register) { setTimeout(register, 50); return; } // wait for loader

    window.HHTools.register({
      id: "videowall-creator",
      label: "Videowall Creator",
      icon: "ui-icon-image",
      onClick: function (inst) {
        // Placeholder - simple confirmation dialog echoing the action name.
        // Future: window.open("https://YOUR_PAGES_URL/videowall-creator/?job=" + inst.options.job_data.JOB, "videowall_creator");
        window.alert("Videowall Creator");
      }
    });
  }

  register();

})();
