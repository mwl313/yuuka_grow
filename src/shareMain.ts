import "./styles.css";
import { initI18n } from "./i18n";
import { renderSharePage } from "./share/sharePage";

const root = document.querySelector<HTMLElement>("#share-app");
if (!root) {
  throw new Error("share root not found");
}

initI18n();
renderSharePage(root);
