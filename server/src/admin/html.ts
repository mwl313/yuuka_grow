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
    h2, h3 { margin: 0; }
    h2 { font-size: 1.05rem; }
    h3 { font-size: 0.95rem; color: #2a3e60; }
    form { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; align-items: end; }
    label { display: grid; gap: 4px; font-size: 13px; }
    input, select { min-height: 36px; border: 1px solid #b6c8e5; border-radius: 8px; padding: 6px 8px; }
    button { min-height: 36px; border: 1px solid #6d89b3; background: #f8fbff; border-radius: 8px; cursor: pointer; padding: 0 10px; }
    table { width: 100%; border-collapse: collapse; min-width: 980px; }
    th, td { border-bottom: 1px solid #e3eaf7; padding: 8px; text-align: left; vertical-align: top; font-size: 13px; white-space: nowrap; }
    th { background: #edf4ff; position: sticky; top: 0; z-index: 1; }
    .table-wrap { overflow: auto; max-height: 72vh; }
    .table-section { display: grid; gap: 10px; }
    .table-meta { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
    .pagination { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .pagination button { min-height: 32px; min-width: 38px; }
    .pagination button.active { background: #dde8fb; border-color: #5a7fb4; font-weight: 700; }
    .row-actions { display: inline-flex; gap: 6px; }
    .status { font-size: 13px; min-height: 18px; margin: 0; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; }
    .metrics-card { border: 1px solid #d9e2f2; border-radius: 10px; padding: 10px; background: #f9fbff; display: grid; gap: 4px; }
    .metrics-card .label { font-size: 12px; color: #44608b; }
    .metrics-card .value { font-size: 18px; font-weight: 700; color: #16243b; }
    .metrics-section { display: grid; gap: 8px; margin-top: 10px; }
    .metrics-duo { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 10px; }
    .metrics-table-wrap { max-height: 280px; }
    .metrics-table { min-width: 520px; }
    .metrics-table.compact { min-width: 360px; }
    .tabs { display: inline-flex; gap: 8px; }
    .tabs .tab-btn.active { background: #dde8fb; border-color: #5a7fb4; font-weight: 700; }
    .tab-pane { display: none; gap: 12px; }
    .tab-pane.active { display: grid; }
    @media (max-width: 900px) { form { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h1>Yuuka Grow Admin</h1>
      <div class="tabs">
        <button id="tab-score" class="tab-btn active" type="button">Score Management</button>
        <button id="tab-metrics" class="tab-btn" type="button">Metrics</button>
      </div>
    </section>
    <section id="pane-score" class="tab-pane active">
      <section class="card">
        <p class="status" id="status"></p>
        <form id="search-form">
          <label>shareId
            <input id="share-id" type="text" />
          </label>
          <label>nickname
            <input id="nickname" type="text" />
          </label>
          <label>sort
            <select id="sort">
              <option value="date">Date</option>
              <option value="credit">Credits</option>
              <option value="thigh">Thigh</option>
            </select>
          </label>
          <label>limit
            <input id="limit" type="number" min="1" max="200" value="50" />
          </label>
          <button id="btn-search" type="submit">Search</button>
        </form>
      </section>
      <section class="card table-section">
        <div class="table-wrap">
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
        </div>
        <div class="table-meta">
          <p class="status" id="score-total"></p>
          <div class="pagination" id="pagination"></div>
        </div>
      </section>
    </section>
    <section id="pane-metrics" class="tab-pane">
      <section class="card">
        <h2>Metrics</h2>
        <p class="status" id="metrics-status"></p>
        <div class="row-actions">
          <button id="btn-metrics-refresh" type="button">Refresh Metrics</button>
        </div>
        <div id="metrics-summary" class="metrics-grid"></div>
        <div class="metrics-section">
          <h3>Retention (Last 14 D0 Days)</h3>
          <div class="table-wrap metrics-table-wrap">
            <table class="metrics-table">
              <thead>
                <tr>
                  <th>day</th>
                  <th>D0 users</th>
                  <th>D1 retention</th>
                  <th>D7 retention</th>
                  <th>D14 retention</th>
                </tr>
              </thead>
              <tbody id="retention-body"></tbody>
            </table>
          </div>
        </div>
        <div class="metrics-section">
          <h3>Session Length (Today)</h3>
          <div id="session-stats" class="metrics-grid"></div>
        </div>
        <div class="metrics-duo">
          <div class="metrics-section">
            <h3>Top Countries (7d)</h3>
            <div class="table-wrap metrics-table-wrap">
              <table class="metrics-table compact">
                <thead>
                  <tr>
                    <th>country</th>
                    <th>sessions</th>
                  </tr>
                </thead>
                <tbody id="countries-body"></tbody>
              </table>
            </div>
          </div>
          <div class="metrics-section">
            <h3>Top Referrers (7d)</h3>
            <div class="table-wrap metrics-table-wrap">
              <table class="metrics-table compact">
                <thead>
                  <tr>
                    <th>referrer</th>
                    <th>sessions</th>
                  </tr>
                </thead>
                <tbody id="referrers-body"></tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="metrics-section">
          <h3>Runs (7d)</h3>
          <div id="runs-percentiles" class="metrics-grid"></div>
          <div class="metrics-duo">
            <div class="table-wrap metrics-table-wrap">
              <table class="metrics-table compact">
                <thead>
                  <tr>
                    <th>ending_id</th>
                    <th>count</th>
                  </tr>
                </thead>
                <tbody id="runs-endings-body"></tbody>
              </table>
            </div>
            <div class="table-wrap metrics-table-wrap">
              <table class="metrics-table compact">
                <thead>
                  <tr>
                    <th>stage bucket</th>
                    <th>count</th>
                  </tr>
                </thead>
                <tbody id="runs-stage-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </section>
  </main>
  <script>
    const refs = {
      tabScore: document.getElementById("tab-score"),
      tabMetrics: document.getElementById("tab-metrics"),
      paneScore: document.getElementById("pane-score"),
      paneMetrics: document.getElementById("pane-metrics"),
      form: document.getElementById("search-form"),
      shareId: document.getElementById("share-id"),
      nickname: document.getElementById("nickname"),
      sort: document.getElementById("sort"),
      limit: document.getElementById("limit"),
      status: document.getElementById("status"),
      body: document.getElementById("result-body"),
      scoreTotal: document.getElementById("score-total"),
      pagination: document.getElementById("pagination"),
      metricsStatus: document.getElementById("metrics-status"),
      metricsSummary: document.getElementById("metrics-summary"),
      retentionBody: document.getElementById("retention-body"),
      sessionStats: document.getElementById("session-stats"),
      countriesBody: document.getElementById("countries-body"),
      referrersBody: document.getElementById("referrers-body"),
      runsEndingsBody: document.getElementById("runs-endings-body"),
      runsStageBody: document.getElementById("runs-stage-body"),
      runsPercentiles: document.getElementById("runs-percentiles"),
      btnMetricsRefresh: document.getElementById("btn-metrics-refresh"),
    };
    const paging = {
      page: 1,
      totalPages: 1,
      limit: 50,
      sort: "date",
      totalFiltered: 0,
      totalAll: 0,
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

    function setMetricsStatus(text) {
      refs.metricsStatus.textContent = text || "";
    }

    function setActiveTab(tab) {
      const showScore = tab !== "metrics";
      refs.tabScore.classList.toggle("active", showScore);
      refs.tabMetrics.classList.toggle("active", !showScore);
      refs.paneScore.classList.toggle("active", showScore);
      refs.paneMetrics.classList.toggle("active", !showScore);
    }

    function fmtNumber(value, digits) {
      const num = Number(value);
      if (!Number.isFinite(num)) return "-";
      return digits === undefined ? num.toLocaleString() : num.toFixed(digits);
    }

    function fmtPercentRatio(value, digits) {
      const num = Number(value);
      if (!Number.isFinite(num)) return "-";
      return (num * 100).toFixed(digits === undefined ? 1 : digits) + "%";
    }

    function qs(params) {
      const p = new URLSearchParams();
      if (params.shareId) p.set("shareId", params.shareId);
      if (params.nickname) p.set("nickname", params.nickname);
      if (params.sort) p.set("sort", params.sort);
      if (params.limit) p.set("limit", String(params.limit));
      if (params.page) p.set("page", String(params.page));
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

    function renderScoreMeta() {
      const base = "Total Scores: " + fmtNumber(paging.totalAll);
      if (paging.totalFiltered !== paging.totalAll) {
        refs.scoreTotal.textContent = base + " | Filtered: " + fmtNumber(paging.totalFiltered);
      } else {
        refs.scoreTotal.textContent = base;
      }
    }

    function renderPagination() {
      refs.pagination.innerHTML = "";
      if (paging.totalPages <= 1) return;

      const makeButton = (label, page, disabled, isActive) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        btn.dataset.page = String(page);
        btn.disabled = disabled;
        if (isActive) btn.classList.add("active");
        return btn;
      };

      refs.pagination.appendChild(makeButton("Prev", Math.max(1, paging.page - 1), paging.page <= 1, false));

      const maxWindow = 7;
      let start = Math.max(1, paging.page - Math.floor(maxWindow / 2));
      let end = Math.min(paging.totalPages, start + maxWindow - 1);
      if (end - start + 1 < maxWindow) {
        start = Math.max(1, end - maxWindow + 1);
      }
      for (let p = start; p <= end; p += 1) {
        refs.pagination.appendChild(makeButton(String(p), p, false, p === paging.page));
      }

      refs.pagination.appendChild(
        makeButton("Next", Math.min(paging.totalPages, paging.page + 1), paging.page >= paging.totalPages, false),
      );
    }

    function renderMetricsSummary(summary, funnel) {
      const cards = [
        { label: "DAU Today", value: fmtNumber(summary.dauToday) },
        { label: "WAU (7d)", value: fmtNumber(summary.wau7) },
        { label: "MAU (30d)", value: fmtNumber(summary.mau30) },
        { label: "Stickiness (DAU/MAU)", value: fmtPercentRatio(summary.stickiness, 1) },
        { label: "New Today", value: fmtNumber(summary.newToday) },
        { label: "Returning Today", value: fmtNumber(summary.returningToday) },
        { label: "Sessions Today", value: fmtNumber(summary.sessionsToday) },
        { label: "Avg Session Today (min)", value: fmtNumber(summary.avgSessionMinutesToday, 2) },
        { label: "Bounce Today (<60s)", value: fmtPercentRatio(summary.bounceRateToday, 1) },
        { label: "Engaged Today (>=3m)", value: fmtPercentRatio(summary.engagedRateToday, 1) },
        { label: "Submits Today", value: fmtNumber(summary.submitsToday) },
        { label: "Submit/DAU Today", value: fmtPercentRatio(summary.submitPerDAUToday, 1) },
        { label: "Submit/Session Today", value: fmtPercentRatio(summary.submitPerSessionToday, 1) },
        { label: "Submits 7d", value: fmtNumber(funnel && funnel.rolling7d && funnel.rolling7d.submits) },
        { label: "Submit/DAU 7d", value: fmtPercentRatio(funnel && funnel.rolling7d && funnel.rolling7d.submitPerDAU, 1) },
        {
          label: "Submit/Session 7d",
          value: fmtPercentRatio(funnel && funnel.rolling7d && funnel.rolling7d.submitPerSession, 1),
        },
        { label: "Sessions/DAU Today", value: fmtNumber(summary.sessionsPerDAU, 2) },
        { label: "DAU Yesterday", value: fmtNumber(summary.dauYesterday) },
        { label: "DAU 7-day Avg", value: fmtNumber(summary.dau7Avg, 2) },
      ];
      refs.metricsSummary.innerHTML = cards
        .map(
          (card) =>
            '<div class="metrics-card"><div class="label">' +
            esc(card.label) +
            '</div><div class="value">' +
            esc(card.value) +
            "</div></div>",
        )
        .join("");
    }

    function renderRetention(rows) {
      refs.retentionBody.innerHTML = "";
      for (const row of rows || []) {
        const d1 = row && row.r1 != null ? fmtPercentRatio(row.r1, 1) : "-";
        const d7 = row && row.r7 != null ? fmtPercentRatio(row.r7, 1) : "-";
        const d14 = row && row.r14 != null ? fmtPercentRatio(row.r14, 1) : "-";
        const tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" +
          esc(row.day) +
          "</td><td>" +
          esc(fmtNumber(row.d0)) +
          "</td><td>" +
          esc(d1) +
          "</td><td>" +
          esc(d7) +
          "</td><td>" +
          esc(d14) +
          "</td>";
        refs.retentionBody.appendChild(tr);
      }
    }

    function renderSessionStats(stats) {
      const cards = [
        { label: "Sessions Count", value: fmtNumber(stats.count) },
        { label: "Mean (min)", value: fmtNumber(stats.meanMinutes, 2) },
        { label: "Median p50 (min)", value: fmtNumber(stats.p50Minutes, 2) },
        { label: "p90 (min)", value: fmtNumber(stats.p90Minutes, 2) },
      ];
      refs.sessionStats.innerHTML = cards
        .map(
          (card) =>
            '<div class="metrics-card"><div class="label">' +
            esc(card.label) +
            '</div><div class="value">' +
            esc(card.value) +
            "</div></div>",
        )
        .join("");
    }

    function renderTopCountries(rows) {
      refs.countriesBody.innerHTML = "";
      for (const row of rows || []) {
        const tr = document.createElement("tr");
        tr.innerHTML = "<td>" + esc(row.country || "unknown") + "</td><td>" + esc(fmtNumber(row.sessions)) + "</td>";
        refs.countriesBody.appendChild(tr);
      }
    }

    function renderTopReferrers(rows) {
      refs.referrersBody.innerHTML = "";
      for (const row of rows || []) {
        const tr = document.createElement("tr");
        tr.innerHTML = "<td>" + esc(row.referrer || "(direct)") + "</td><td>" + esc(fmtNumber(row.sessions)) + "</td>";
        refs.referrersBody.appendChild(tr);
      }
    }

    function renderRuns7d(runs) {
      const safe = runs || {};
      refs.runsEndingsBody.innerHTML = "";
      for (const row of safe.endingsTop || []) {
        const tr = document.createElement("tr");
        tr.innerHTML = "<td>" + esc(row.endingId) + "</td><td>" + esc(fmtNumber(row.count)) + "</td>";
        refs.runsEndingsBody.appendChild(tr);
      }

      refs.runsStageBody.innerHTML = "";
      for (const row of safe.stageBuckets || []) {
        const tr = document.createElement("tr");
        tr.innerHTML = "<td>" + esc(row.bucket) + "</td><td>" + esc(fmtNumber(row.count)) + "</td>";
        refs.runsStageBody.appendChild(tr);
      }

      const cards = [
        { label: "Credits p50", value: fmtNumber(safe.creditsP50) },
        { label: "Credits p90", value: fmtNumber(safe.creditsP90) },
        { label: "Credits p99", value: fmtNumber(safe.creditsP99) },
        { label: "Thigh p50", value: fmtNumber(safe.thighP50) },
        { label: "Thigh p90", value: fmtNumber(safe.thighP90) },
        { label: "Thigh p99", value: fmtNumber(safe.thighP99) },
      ];
      refs.runsPercentiles.innerHTML = cards
        .map(
          (card) =>
            '<div class="metrics-card"><div class="label">' +
            esc(card.label) +
            '</div><div class="value">' +
            esc(card.value) +
            "</div></div>",
        )
        .join("");
    }

    async function loadMetrics() {
      setMetricsStatus("Loading metrics...");
      try {
        const res = await api("/admin/api/metrics");
        renderMetricsSummary(res.summary || {}, res.funnel || {});
        renderRetention((res.retention && res.retention.rows) || res.retention || []);
        renderSessionStats(res.sessionLengthToday || {});
        renderTopCountries(res.topCountries7d || []);
        renderTopReferrers(res.topReferrers7d || []);
        renderRuns7d(res.runs7d || {});
        setMetricsStatus("Metrics updated for " + ((res.summary && res.summary.day) || "today"));
      } catch (err) {
        setMetricsStatus((err && err.message) || "Metrics load failed");
      }
    }
    let metricsLoaded = false;

    async function ensureMetricsLoaded() {
      if (metricsLoaded) return;
      await loadMetrics();
      metricsLoaded = true;
    }

    async function search(options) {
      const resetPage = options && options.resetPage === true;
      if (resetPage) paging.page = 1;
      setStatus("Loading...");
      const requestedSort = String((refs.sort && refs.sort.value) || "").trim();
      paging.sort = requestedSort === "credit" || requestedSort === "thigh" ? requestedSort : "date";
      if (refs.sort) refs.sort.value = paging.sort;
      const requestedLimit = Number.parseInt(refs.limit.value.trim(), 10);
      if (Number.isFinite(requestedLimit) && requestedLimit > 0) {
        paging.limit = Math.min(200, Math.max(1, requestedLimit));
      }
      const params = {
        shareId: refs.shareId.value.trim(),
        nickname: refs.nickname.value.trim(),
        sort: paging.sort,
        limit: paging.limit,
        page: paging.page,
      };
      try {
        const res = await api("/admin/api/search?" + qs(params));
        renderRows(res.items || []);
        paging.page = Number(res.page || paging.page);
        paging.totalPages = Number(res.totalPages || 1);
        paging.totalFiltered = Number(res.totalFiltered || 0);
        paging.totalAll = Number(res.totalAll || 0);
        if (res.sort) {
          paging.sort = String(res.sort);
          if (refs.sort) refs.sort.value = paging.sort;
        }
        renderScoreMeta();
        renderPagination();
        setStatus(
          "Loaded " +
            (res.items || []).length +
            " rows (page " +
            paging.page +
            "/" +
            paging.totalPages +
            ")",
        );
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
      await search({ resetPage: true });
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

    refs.tabScore.addEventListener("click", () => {
      setActiveTab("score");
    });
    refs.tabMetrics.addEventListener("click", async () => {
      setActiveTab("metrics");
      await ensureMetricsLoaded();
    });
    refs.btnMetricsRefresh.addEventListener("click", async () => {
      await loadMetrics();
      metricsLoaded = true;
    });
    refs.pagination.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      const page = Number.parseInt(target.dataset.page || "", 10);
      if (!Number.isFinite(page) || page < 1 || page === paging.page) return;
      paging.page = Math.min(Math.max(1, page), paging.totalPages);
      await search();
    });

    setActiveTab("score");
    search();
  </script>
</body>
</html>`;
}
