import "./styles.css";
import { initI18n } from "./i18n";
import { maybeRunBootThen } from "./ui/boot/bootManager";
import { UiController } from "./ui/uiController";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("app root not found");
}

initI18n();
void maybeRunBootThen(() => {
  new UiController(root);
});
