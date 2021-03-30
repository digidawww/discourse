import Application from "@ember/application";
import Mousetrap from "mousetrap";
import { buildResolver } from "discourse-common/resolver";
import { setDefaultOwner } from "discourse-common/lib/get-owner";

const _pluginCallbacks = [];
const _themeSettings = {};

const Discourse = Application.extend({
  rootElement: "#main",

  customEvents: {
    paste: "paste",
  },

  reset() {
    this._super(...arguments);
    Mousetrap.reset();
  },

  Resolver: buildResolver("discourse"),

  _prepareInitializer(moduleName) {
    const module = requirejs(moduleName, null, null, true);
    if (!module) {
      throw new Error(moduleName + " must export an initializer.");
    }

    const init = module.default;
    const oldInitialize = init.initialize;
    init.initialize = (app) => oldInitialize.call(init, app.__container__, app);

    return init;
  },

  // Start up the Discourse application by running all the initializers we've defined.
  start() {
    setDefaultOwner(this.__container__);
    this._registerThemeSettings();

    $("noscript").remove();

    Object.keys(requirejs._eak_seen).forEach((key) => {
      if (/\/pre\-initializers\//.test(key)) {
        this.initializer(this._prepareInitializer(key));
      } else if (/\/(api\-)?initializers\//.test(key)) {
        this.instanceInitializer(this._prepareInitializer(key));
      }
    });

    // Plugins that are registered via `<script>` tags.
    const withPluginApi = requirejs("discourse/lib/plugin-api").withPluginApi;
    let initCount = 0;
    _pluginCallbacks.forEach((cb) => {
      this.instanceInitializer({
        name: `_discourse_plugin_${++initCount}`,
        after: "inject-objects",
        initialize: () => withPluginApi(cb.version, cb.code),
      });
    });
  },

  _registerPluginCode(version, code) {
    _pluginCallbacks.push({ version, code });
  },

  _registerThemeSettings() {
    const themeSettingsService = this.__container__.lookup(
      "service:theme-settings"
    );
    Object.keys(_themeSettings).forEach((themeId) => {
      themeSettingsService.registerSettings(themeId, _themeSettings[themeId]);
    });
  },
});

export default Discourse;

export function registerThemeSettings(themeId, settings) {
  if (_themeSettings[themeId]) {
    return;
  }
  _themeSettings[themeId] = settings;
}
