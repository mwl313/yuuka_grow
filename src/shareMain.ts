import "./styles.css";
import { renderSharePage } from "./share/sharePage";

const root = document.querySelector<HTMLElement>("#share-app");
if (!root) {
  throw new Error("share root not found");
}

renderSharePage(root);
