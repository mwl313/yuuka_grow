import "./styles.css";
import { UiController } from "./ui/uiController";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("app root not found");
}

new UiController(root);
