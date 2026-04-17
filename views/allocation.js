/**
 * Allocation View
 */
function renderAllocation(container) {
  const EXITED_KEY = 'exitedTradesV2';
  const ALLOC_KEY = 'allocationSelectionV1';

  container.innerHTML = `
    <div class="section-header mb16">
      <div>
        <div class="section-title">Allocation</div>
        <div class="section-sub">Decide how to split receivable amounts and realized P/L from selected exited scripts.</div>
      </div>
      <div class="toolbar">
        <button class="btn-primary" id="allocation-select-btn">Allocate Trades</button>
      </div>
    </div>

    <div class="metrics-grid mb16" id="allocation-kpi"></div>

    <div class="dashboard-row" style="grid-template-columns:1.2fr .8fr;align-items:start;">
      <div class="add-panel allocation-insight-panel">
        <div class="add-panel-title">Allocation Breakdown</div>
        <div id="allocation-breakdown-list" class="allocation-breakdown-list"></div>
      </div>
      <div class="add-panel allocation-insight-panel">
        <div class="add-panel-title">Allocation Mix</div>
        <div class="allocation-donut-wrap">
          <div class="allocation-donut" id="allocation-donut"></div>
          <div class="allocation-donut-center mono" id="allocation-donut-center">0</div>
        </div>
      </div>
    </div>

    <div class="add-panel mt16">
      <div class="add-panel-title">Selected Exited Trades</div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Script</th>
              <th>Type</th>
              <th>Invested</th>
              <th>Receivable</th>
              <th>Net P/L</th>
              <th>Exited</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="allocation-selected-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#allocation-select-btn')?.addEventListener('click', openSelectionModal);

  draw();

  function readExitedTrades() {
    return readJsonArr(EXITED_KEY)
      .map((row) => ({
        ...row,
        buyTotal: Number(row.buyTotal || 0),
        netSoldTotal: Number(row.netSoldTotal || row.soldTotal || 0),
        profit: Number(row.profit || 0),
      }))
      .filter((row) => row.id)
      .sort((a, b) => String(b.exitedAt || '').localeCompare(String(a.exitedAt || '')));
  }

  function readSelection() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ALLOC_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveSelection(ids) {
    localStorage.setItem(ALLOC_KEY, JSON.stringify(ids));
  }

  function buildSummary(selectedTrades) {
    const totals = selectedTrades.reduce((acc, row) => {
      acc.netProfit += Number(row.profit || 0);
      acc.invested += Number(row.buyTotal || 0);
      acc.receivable += Number(row.netSoldTotal || 0);
      return acc;
    }, { netProfit: 0, invested: 0, receivable: 0 });

    const netProfit = totals.netProfit;
    const allocations = [
      { key: 'longTerm', label: 'Long Term', pct: 35, amount: netProfit * 0.35, cls: 'allocation-longterm' },
      { key: 'donation', label: 'Donation', pct: 10, amount: netProfit * 0.10, cls: 'allocation-donation' },
      { key: 'extraExpenses', label: 'Extra Expenses', pct: 5, amount: netProfit * 0.05, cls: 'allocation-extra' },
      { key: 'tradingSize', label: 'Trading Size', pct: 45, amount: netProfit * 0.45, cls: 'allocation-trading' },
      { key: 'allowedExpenses', label: 'Allowed Expenses', pct: 5, amount: netProfit * 0.05, cls: 'allocation-allowed' },
    ];

    return { ...totals, allocations };
  }

  function draw() {
    const allTrades = readExitedTrades();
    const selectedIds = readSelection();
    const selectedTrades = allTrades.filter((row) => selectedIds.includes(row.id));
    const summary = buildSummary(selectedTrades);

    const kpi = container.querySelector('#allocation-kpi');
    kpi.innerHTML = `
      <div class="metric-card"><div class="metric-label">Selected Exits</div><div class="metric-value mono">${selectedTrades.length}</div></div>
      <div class="metric-card"><div class="metric-label">Receivable (After Tax)</div><div class="metric-value mono">${currency(summary.receivable)}</div></div>
      <div class="metric-card"><div class="metric-label">Total Invested Capital</div><div class="metric-value mono">${currency(summary.invested)}</div></div>
      <div class="metric-card"><div class="metric-label">NET P/L</div><div class="metric-value mono ${plClass(summary.netProfit)}">${currency(summary.netProfit)}</div></div>
      <div class="metric-card"><div class="metric-label">Trading Size from NET P/L (45%)</div><div class="metric-value mono">${currency(summary.netProfit * 0.45)}</div></div>
      <div class="metric-card"><div class="metric-label">Trading Size from Invested Capital (100%)</div><div class="metric-value mono">${currency(summary.invested)}</div></div>
    `;

    const breakdown = container.querySelector('#allocation-breakdown-list');
    breakdown.innerHTML = summary.allocations.map((slice) => {
      const ratio = Math.max(0, Math.min(100, Number(slice.pct || 0)));
      return `
        <div class="allocation-row ${slice.cls}">
          <div class="allocation-row-head">
            <strong>${slice.label}</strong>
            <span class="mono">${slice.pct}% • ${currency(slice.amount)}</span>
          </div>
          <div class="allocation-progress"><span style="width:${ratio}%;"></span></div>
        </div>
      `;
    }).join('');

    const donut = container.querySelector('#allocation-donut');
    const center = container.querySelector('#allocation-donut-center');
    const isPositive = summary.netProfit > 0;
    donut.style.background = isPositive
      ? 'conic-gradient(#74b88b 0% 35%, #6aa7ff 35% 45%, #f4cd3d 45% 50%, #8b5cf6 50% 95%, #da4d4d 95% 100%)'
      : 'conic-gradient(var(--border) 0 100%)';
    center.textContent = selectedTrades.length ? `${selectedTrades.length} trades` : 'No data';

    const tbody = container.querySelector('#allocation-selected-tbody');
    if (!selectedTrades.length) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state" style="padding:24px;"><div class="empty-state-icon">🧭</div><div class="empty-state-title">No trades allocated yet</div><div class="empty-state-sub">Use <strong>Allocate Trades</strong> to pick one or more exited scripts.</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = selectedTrades.map((row) => `
      <tr>
        <td>${escHtml(row.name || '—')}</td>
        <td>${escHtml(row.type || '—')}</td>
        <td class="mono">${currency(row.buyTotal)}</td>
        <td class="mono">${currency(row.netSoldTotal)}</td>
        <td class="mono ${plClass(row.profit)}">${currency(row.profit)}</td>
        <td class="mono">${row.exitedAt ? new Date(row.exitedAt).toLocaleDateString() : '—'}</td>
        <td class="actions-td"><button class="btn-ghost" data-remove-id="${row.id}">Remove</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-remove-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-remove-id');
        saveSelection(readSelection().filter((entryId) => entryId !== id));
        draw();
      });
    });
  }

  function openSelectionModal() {
    const allTrades = readExitedTrades();
    const current = new Set(readSelection());

    Modal.open({
      title: 'Allocate Past Trades',
      body: `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
          <span class="form-label" style="margin:0;">Select exited scripts for allocation dashboard</span>
          <button class="btn-secondary" id="allocation-clear-selected" type="button">Clear Selected</button>
        </div>
        <div class="allocation-picker-list" id="allocation-picker-list">
          ${allTrades.length ? allTrades.map((row) => `
            <label class="allocation-pick-item">
              <input type="checkbox" class="allocation-pick-check" value="${row.id}" ${current.has(row.id) ? 'checked' : ''} />
              <span>
                <strong>${escHtml(row.name || '—')}</strong>
                <small class="mono">${currency(row.netSoldTotal)} receivable · ${currency(row.profit)} P/L</small>
              </span>
            </label>
          `).join('') : '<div class="empty-state"><div class="empty-state-sub">No exited trades found in records.</div></div>'}
        </div>
      `,
      footer: `<button class="btn-secondary" id="allocation-cancel">Cancel</button><button class="btn-primary" id="allocation-save">Apply Allocation</button>`,
    });

    const box = document.getElementById('modalBox');
    box.querySelector('#allocation-cancel')?.addEventListener('click', Modal.close);
    box.querySelector('#allocation-clear-selected')?.addEventListener('click', () => {
      box.querySelectorAll('.allocation-pick-check').forEach((chk) => { chk.checked = false; });
    });
    box.querySelector('#allocation-save')?.addEventListener('click', () => {
      const ids = Array.from(box.querySelectorAll('.allocation-pick-check:checked')).map((node) => node.value);
      saveSelection(ids);
      Modal.close();
      draw();
    });
  }
}

window._renderAllocation = renderAllocation;
