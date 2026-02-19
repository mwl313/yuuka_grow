import "./styles.css";
import { initI18n } from "./i18n";
import { initTelemetry } from "./telemetry/telemetry";
import { maybeRunBootThen } from "./ui/boot/bootManager";
import { UiController } from "./ui/uiController";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("app root not found");
}

initI18n();
initTelemetry();
void maybeRunBootThen(() => {
  new UiController(root);
});
