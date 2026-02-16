export function renderAdminPageHtml(): string {
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Yuuka Grow Admin</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7fb; color: #152034; }
    main { max-width: 1200px; margin: 0 auto; padding: 20px; display: grid; gap: 12px; }
    .card { background: #fff; border: 1px solid #d9e2f2; border-radius: 12px; padding: 14px; box-shadow: 0 10px 24px rgba(30, 46, 78, 0.08); }
    h1 { margin: 0; font-size: 1.3rem; }
    form { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; align-items: end; }
    label { display: grid; gap: 4px; font-size: 13px; }
    input { min-height: 36px; border: 1px solid #b6c8e5; border-radius: 8px; padding: 6px 8px; }
    button { min-height: 36px; border: 1px solid #6d89b3; background: #f8fbff; border-radius: 8px; cursor: pointer; padding: 0 10px; }
    table { width: 100%; border-collapse: collapse; min-width: 980px; }
    th, td { border-bottom: 1px solid #e3eaf7; padding: 8px; text-align: left; vertical-align: top; font-size: 13px; white-space: nowrap; }
    th { background: #edf4ff; position: sticky; top: 0; z-index: 1; }
    .table-wrap { overflow: auto; max-height: 72vh; }
    .row-actions { display: inline-flex; gap: 6px; }
    .status { font-size: 13px; min-height: 18px; margin: 0; }
    @media (max-width: 900px) { form { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h1>Yuuka Grow Admin</h1>
      <p class="status" id="status"></p>
      <form id="search-form">
        <label>shareId
          <input id="share-id" type="text" />
        </label>
        <label>nickname
          <input id="nickname" type="text" />
        </label>
        <label>limit
          <input id="limit" type="number" min="1" max="200" value="50" />
        </label>
        <button id="btn-search" type="submit">Search</button>
      </form>
    </section>
    <section class="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>shareId</th>
            <th>nickname</th>
            <th>ending</th>
            <th>days</th>
            <th>credits</th>
            <th>thigh</th>
            <th>submitted_at</th>
            <th>is_hidden</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody id="result-body"></tbody>
      </table>
    </section>
  </main>
  <script>
    const refs = {
      form: document.getElementById("search-form"),
      shareId: document.getElementById("share-id"),
      nickname: document.getElementById("nickname"),
      limit: document.getElementById("limit"),
      status: document.getElementById("status"),
      body: document.getElementById("result-body"),
    };

    function esc(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function setStatus(text) {
      refs.status.textContent = text || "";
    }

    function qs(params) {
      const p = new URLSearchParams();
      if (params.shareId) p.set("shareId", params.shareId);
      if (params.nickname) p.set("nickname", params.nickname);
      if (params.limit) p.set("limit", String(params.limit));
      return p.toString();
    }

    async function api(path, options) {
      const response = await fetch(path, options);
      if (!response.ok) {
        let message = "Request failed";
        try {
          const body = await response.json();
          if (body && body.error) message = body.error;
        } catch {}
        throw new Error(message);
      }
      return response.json();
    }

    function renderRows(items) {
      refs.body.innerHTML = "";
      for (const item of items) {
        const tr = document.createElement("tr");
        tr.innerHTML = [
          "<td>" + esc(item.share_id) + "</td>",
          "<td>" + esc(item.nickname) + "</td>",
          "<td>" + esc(item.ending_category + "/" + item.ending_id) + "</td>",
          "<td>" + esc(item.survival_days) + "</td>",
          "<td>" + esc(item.final_credits) + "</td>",
          "<td>" + esc(item.final_thigh_cm) + "</td>",
          "<td>" + esc(item.submitted_at_server) + "</td>",
          "<td>" + esc(item.is_hidden) + "</td>",
          '<td><div class="row-actions">' +
            '<button type="button" data-action="edit" data-share="' + esc(item.share_id) + '">Edit</button>' +
            '<button type="button" data-action="toggle" data-share="' + esc(item.share_id) + '" data-hidden="' + esc(item.is_hidden) + '">' + (item.is_hidden ? "Unhide" : "Hide") + "</button>" +
            '<button type="button" data-action="delete" data-share="' + esc(item.share_id) + '">Delete</button>' +
            "</div></td>",
        ].join("");
        refs.body.appendChild(tr);
      }
    }

    async function search() {
      setStatus("Loading...");
      const params = {
        shareId: refs.shareId.value.trim(),
        nickname: refs.nickname.value.trim(),
        limit: refs.limit.value.trim(),
      };
      try {
        const res = await api("/admin/api/search?" + qs(params));
        renderRows(res.items || []);
        setStatus("Loaded " + (res.items || []).length + " rows");
      } catch (err) {
        setStatus(err.message || "Search failed");
      }
    }

    async function editRow(shareId) {
      try {
        const run = await api("/admin/api/run?shareId=" + encodeURIComponent(shareId));
        const item = run.item;
        const nickname = prompt("nickname", item.nickname);
        if (nickname === null) return;
        const endingCategory = prompt("ending_category", item.ending_category);
        if (endingCategory === null) return;
        const endingId = prompt("ending_id", item.ending_id);
        if (endingId === null) return;
        const survivalDays = prompt("survival_days", String(item.survival_days));
        if (survivalDays === null) return;
        const finalCredits = prompt("final_credits", String(item.final_credits));
        if (finalCredits === null) return;
        const finalThighCm = prompt("final_thigh_cm", String(item.final_thigh_cm));
        if (finalThighCm === null) return;
        const finalStage = prompt("final_stage", String(item.final_stage));
        if (finalStage === null) return;

        await api("/admin/api/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shareId,
            nickname,
            ending_category: endingCategory,
            ending_id: endingId,
            survival_days: Number(survivalDays),
            final_credits: Number(finalCredits),
            final_thigh_cm: Number(finalThighCm),
            final_stage: Number(finalStage),
          }),
        });
        await search();
      } catch (err) {
        setStatus(err.message || "Update failed");
      }
    }

    async function toggleHidden(shareId, isHidden) {
      try {
        await api("/admin/api/hide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shareId, isHidden: !isHidden }),
        });
        await search();
      } catch (err) {
        setStatus(err.message || "Hide failed");
      }
    }

    async function deleteRow(shareId) {
      if (!confirm("Delete this row?")) return;
      try {
        await api("/admin/api/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shareId }),
        });
        await search();
      } catch (err) {
        setStatus(err.message || "Delete failed");
      }
    }

    refs.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await search();
    });

    refs.body.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const action = target.dataset.action;
      const shareId = target.dataset.share || "";
      if (!action || !shareId) return;
      if (action === "edit") await editRow(shareId);
      if (action === "toggle") await toggleHidden(shareId, target.dataset.hidden === "1");
      if (action === "delete") await deleteRow(shareId);
    });

    search();
  </script>
</body>
</html>`;
}
