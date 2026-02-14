import { formatNumber, t } from "../i18n";
import { parseShareQuery } from "./shareLink";

function createRow(label: string, value: string): HTMLLIElement {
  const row = document.createElement("li");
  row.className = "score-row";
  const labelSpan = document.createElement("span");
  labelSpan.className = "score-label";
  labelSpan.textContent = label;
  const valueSpan = document.createElement("span");
  valueSpan.className = "score-value";
  valueSpan.textContent = value;
  row.append(labelSpan, valueSpan);
  return row;
}

function createPlayButton(): HTMLAnchorElement {
  const button = document.createElement("a");
  button.className = "skin-button font-title idle share-play-button";
  button.href = "./";
  button.textContent = t("share.playCta");
  return button;
}

export function renderSharePage(root: HTMLElement): void {
  root.className = "share-root font-plain";
  const shell = document.createElement("main");
  shell.className = "share-shell";

  const card = document.createElement("section");
  card.className = "skin-panel share-card";
  const title = document.createElement("h1");
  title.className = "share-title font-title";
  title.textContent = t("share.title");
  card.append(title);

  const parsed = parseShareQuery(window.location.search);
  if (!parsed) {
    const invalid = document.createElement("p");
    invalid.className = "share-invalid";
    invalid.textContent = t("share.invalid");
    card.append(invalid, createPlayButton());
    shell.append(card);
    root.append(shell);
    return;
  }

  const cardTitle = document.createElement("p");
  cardTitle.className = "share-card-title";
  cardTitle.textContent = t("share.score");

  const list = document.createElement("ul");
  list.className = "score-list";
  list.append(
    createRow(t("result.ending"), t(`ending.${parsed.ending}.title`)),
    createRow(t("result.finalThigh"), t("format.cm", { value: formatNumber(parsed.thigh) })),
    createRow(t("result.dayReached"), t("format.day", { value: formatNumber(parsed.day) })),
    createRow(t("result.finalCredits"), t("format.credits", { value: formatNumber(parsed.money) })),
    createRow(t("result.finalStress"), formatNumber(parsed.stress)),
  );

  card.append(cardTitle, list, createPlayButton());
  shell.append(card);
  root.append(shell);
}
