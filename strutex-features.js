/**
 * strutex-features.js
 * Comprehensive Engine for IndexedDB Offline Queueing, Visual Analytics, and Kanban Boards.
 */

// ==========================================
// 1. INDEXEDDB OFFLINE QUEUEING & STORAGE
// ==========================================

// Initialize localForage instance
localforage.config({
    name: 'StrutexEcosystem',
    storeName: 'operations_data',
    description: 'Robust offline storage for heavy Base64 media and matrix payloads'
});

// Override the existing synchronous saveLocally to utilize asynchronous IndexedDB
window.saveLocally = async function() {
    try {
        await localforage.setItem('strutex_stations_cloud_sync', masterStationsData);
        updateExecutiveDashboard(); // Refresh KPIs whenever data is saved
        renderKanbanBoard();        // Keep Kanban synced
        
        // Log to offline queue if navigator is offline
        if (!navigator.onLine) {
            let queue = await localforage.getItem('strutex_offline_queue') || [];
            queue.push({ timestamp: new Date().toISOString(), type: 'matrix_update', payload: masterStationsData });
            await localforage.setItem('strutex_offline_queue', queue);
        }
    } catch (err) {
        console.error("IndexedDB Save Error:", err);
    }
};

// Override loadStations to fetch from IndexedDB before falling back to Supabase/defaults
const originalLoadStations = window.loadStations;
window.loadStations = async function() {
    try {
        const indexedData = await localforage.getItem('strutex_stations_cloud_sync');
        if (indexedData && indexedData.length > 0) {
            masterStationsData = indexedData;
        }
    } catch (err) {
        console.warn("IndexedDB Load Failed, deferring to standard load process.");
    }
    
    await originalLoadStations();
    updateExecutiveDashboard();
};

// Automatic Queue Flusher when 4G/Internet is restored
window.addEventListener('online', async () => {
    const queue = await localforage.getItem('strutex_offline_queue');
    if (queue && queue.length > 0) {
        showToast(`Syncing ${queue.length} offline actions to Supabase...`, "info");
        await saveToCloud(); // Existing Supabase function
        await localforage.removeItem('strutex_offline_queue');
    }
});


// ==========================================
// 2. EXECUTIVE VISUAL ANALYTICS DASHBOARD
// ==========================================
let runRateChartInstance = null;

function calculateBoQTotalForChart(payload) {
    if (!payload || !payload.scopeItems) return 0;
    let subTotal = 0;
    payload.scopeItems.forEach(item => {
        let rate = parseFloat(item.rate) || 0;
        let qty = parseFloat(item.qty) || 1;
        // Handle legacy string formats
        if (typeof item === 'string' && item.includes('- Rate: KES')) {
            rate = parseFloat(item.split('- Rate: KES')[1].replace(/[^0-9.]/g, '')) || 0;
        }
        subTotal += (rate * qty);
    });
    return subTotal * 1.16; // 16% VAT inclusion
}

function updateExecutiveDashboard() {
    if (!masterStationsData) return;

    let totalQuotedValue = 0;
    let completedCount = 0;
    let pendingOngoingCount = 0;
    let activeTasks = 0;
    
    // Monthly aggregation for Run-Rate chart
    const monthlyData = {};

    masterStationsData.forEach(station => {
        // KPI: Status Counters
        if (station.status === 'Completed') {
            completedCount++;
        } else {
            pendingOngoingCount++;
            if (station.status === 'Ongoing') activeTasks++;
        }

        // KPI: Financials
        if (station.jobCardSaved && station.jobCardPayload) {
            const val = calculateBoQTotalForChart(station.jobCardPayload);
            totalQuotedValue += val;

            const dateStr = station.jobCardPayload.dateIssued || new Date().toISOString();
            const monthKey = new Date(dateStr).toLocaleString('default', { month: 'short', year: 'numeric' });
            
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + val;
        }
    });

    // Update DOM KPIs
    const elTotal = document.getElementById('kpiTotalQuoted');
    if (elTotal) elTotal.innerText = totalQuotedValue.toLocaleString('en-KE', { maximumFractionDigits: 0 });
    
    const elComp = document.getElementById('kpiCompletionRatio');
    if (elComp) elComp.innerText = `${completedCount} / ${pendingOngoingCount}`;
    
    const elAct = document.getElementById('kpiActiveTasks');
    if (elAct) elAct.innerText = activeTasks;

    // Render / Update ApexChart
    renderFinancialChart(monthlyData);
}

function renderFinancialChart(monthlyData) {
    const chartContainer = document.querySelector("#financialRunRateChart");
    if (!chartContainer) return;

    // Sort chronologically (rudimentary sort by converting 'Oct 2026' back to date)
    const sortedMonths = Object.keys(monthlyData).sort((a, b) => new Date(a) - new Date(b));
    const seriesData = sortedMonths.map(month => Math.round(monthlyData[month]));

    const options = {
        series: [{ name: 'Quoted Value (KES)', data: seriesData }],
        chart: { type: 'bar', height: 250, toolbar: { show: false }, fontFamily: 'Segoe UI, sans-serif' },
        colors: ['#003366'],
        plotOptions: { bar: { borderRadius: 4, dataLabels: { position: 'top' } } },
        dataLabels: {
            enabled: true,
            formatter: function (val) { return (val / 1000).toFixed(1) + "K"; },
            offsetY: -20,
            style: { fontSize: '10px', colors: ["#64748b"] }
        },
        xaxis: {
            categories: sortedMonths,
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            labels: { formatter: function (val) { return val.toLocaleString(); } }
        },
        grid: { borderColor: '#f1f5f9', strokeDashArray: 4 }
    };

    if (runRateChartInstance) {
        runRateChartInstance.updateOptions({ xaxis: { categories: sortedMonths } });
        runRateChartInstance.updateSeries([{ data: seriesData }]);
    } else {
        runRateChartInstance = new ApexCharts(chartContainer, options);
        runRateChartInstance.render();
    }
}


// ==========================================
// 3. Trello-Style KANBAN BOARD VIEW
// ==========================================
let sortableInstances = [];

window.switchMatrixView = function(view) {
    const tableArea = document.getElementById('tableViewArea') || document.querySelector('.table-responsive');
    const kanbanArea = document.getElementById('kanbanBoardArea');
    const btnTable = document.getElementById('btnTableView');
    const btnKanban = document.getElementById('btnKanbanView');

    if (view === 'kanban') {
        tableArea.style.display = 'none';
        kanbanArea.style.display = 'flex';
        btnKanban.style.background = '#ffffff';
        btnKanban.style.borderColor = '#0284c7';
        btnKanban.style.color = '#0284c7';
        btnTable.style.background = 'transparent';
        btnTable.style.borderColor = 'transparent';
        btnTable.style.color = 'inherit';
        renderKanbanBoard();
    } else {
        tableArea.style.display = 'block';
        kanbanArea.style.display = 'none';
        btnTable.style.background = '#ffffff';
        btnTable.style.borderColor = '#0284c7';
        btnTable.style.color = '#0284c7';
        btnKanban.style.background = 'transparent';
        btnKanban.style.borderColor = 'transparent';
        btnKanban.style.color = 'inherit';
        renderTable(); // Re-render table in case array was sorted/updated in Kanban
    }
};

function renderKanbanBoard() {
    const kanbanArea = document.getElementById('kanbanBoardArea');
    if (!kanbanArea || kanbanArea.style.display === 'none') return;

    const columns = {
        'Pending': document.querySelector('#kanban-pending .kanban-list'),
        'Ongoing': document.querySelector('#kanban-ongoing .kanban-list'),
        'Completed': document.querySelector('#kanban-completed .kanban-list')
    };

    // Clear existing
    Object.values(columns).forEach(col => col.innerHTML = '');
    let counts = { 'Pending': 0, 'Ongoing': 0, 'Completed': 0 };

    masterStationsData.forEach((station, index) => {
        // Fallback for empty/unrecognized status
        const status = ['Pending', 'Ongoing', 'Completed'].includes(station.status) ? station.status : 'Pending';
        counts[status]++;

        const isAuth = Boolean(currentAuthUser);
        const hasCard = station.jobCardSaved && station.jobCardPayload;
        
        let headerColor = station.tier.includes('Tier 1') ? '#E2001A' : (station.tier.includes('Tier 2') ? '#d97706' : '#15803d');

        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.dataset.index = index;
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="kanban-drag-handle" style="cursor: grab; color: #64748b; font-size: 1.1rem; letter-spacing: -1.5px; padding: 2px 6px; background: #e2e8f0; border-radius: 4px; border: 1px solid #cbd5e1; user-select: none;" title="Drag to move">⋮⋮</div>
                    <span style="background: ${headerColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: bold; text-transform: uppercase;">${station.tier.split(':')[0]}</span>
                </div>
                <span style="font-size: 0.7rem; color: #64748b; font-weight: bold;">#${station.rank}</span>
            </div>
            <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; margin-bottom: 4px; line-height: 1.2;">${station.name}</div>
            <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 12px; display: flex; align-items: center; gap: 4px;">
                <span>👷</span> ${station.info || 'Unassigned'}
            </div>
            ${hasCard ? 
                `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                    <button class="btn btn-secondary" style="font-size: 0.65rem; padding: 4px;" onclick="viewSavedJobCard(masterStationsData[${index}].jobCardPayload)">👁️ Card</button>
                    <button class="btn btn-secondary" style="font-size: 0.65rem; padding: 4px; background: #0f766e; color: white; border: none;" onclick="viewBoQ(masterStationsData[${index}].jobCardPayload)">💰 BoQ</button>
                </div>` : 
                `<button class="btn" style="width: 100%; font-size: 0.7rem; padding: 4px;" ${!isAuth ? 'disabled' : ''} onclick="if(requireAuth('deploy station')) { activeRow = document.querySelector('#tableBody').rows[${index}]; openChecklist(this); }">Deploy Wizard</button>`
            }
        `;
        columns[status].appendChild(card);
    });

    // Update Counter Badges
    document.getElementById('kanban-count-pending').innerText = counts['Pending'];
    document.getElementById('kanban-count-ongoing').innerText = counts['Ongoing'];
    document.getElementById('kanban-count-completed').innerText = counts['Completed'];

    // Initialize SortableJS for Drag & Drop Cross-Column sync
    if (sortableInstances.length > 0) {
        sortableInstances.forEach(inst => inst.destroy());
        sortableInstances = [];
    }

    Object.values(columns).forEach(col => {
        const sortable = Sortable.create(col, {
            group: 'matrix',
            handle: '.kanban-drag-handle', // Restricts dragging to the grip icon only
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async function (evt) {
                const itemEl = evt.item;
                const newStatus = evt.to.dataset.status;
                const dataIndex = itemEl.dataset.index;

                // Only update if it actually moved to a different column
                if (evt.from !== evt.to) {
                    if (!requireAuth("change status")) {
                        renderKanbanBoard(); // Revert visual move if unauthenticated
                        return;
                    }
                    
                    masterStationsData[dataIndex].status = newStatus;
                    await saveLocally(); // LocalForage background save
                    
                    if (dbClient && navigator.onLine) {
                        saveToCloud(); // Sync to Supabase immediately if online
                    }
                    
                    // Update badges without full re-render for smooth UX
                    renderKanbanBoard();
                }
            }
        });
        sortableInstances.push(sortable);
    });
}
