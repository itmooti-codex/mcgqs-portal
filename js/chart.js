// Replace PLACEHOLDER_API_KEY with the actual key at runtime.
const apiKey = "PLACEHOLDER_API_KEY";
const visitorRefferalSource = 'Gallagher Melbourne';
const wsUrl = `wss://mcgqs.vitalstats.app/api/v1/graphql?apiKey=${apiKey}`;
const restUrl = `https://mcgqs.vitalstats.app/api/v1/graphql?apiKey=${apiKey}`;
const entities = ["Jobs", "Completed Jobs"]; // "Contacts", "Properties","PartnerLinks"
const colors = { Jobs: "#3b82f6", "Completed Jobs": "#10b981" };

let readyCount = 0, keepAliveInterval;
const traces = {
    bar: [],
    line: [],
    area: [],
    stacked: [],
    spline: [],
    step: []
};
let currentGranularity = "weekly", selectedStart, selectedEnd;

const commonLayout = {
    yaxis: { title: "Count" },
    legend: { orientation: "h", x: 0, xanchor: "left", y: 1.15, yanchor: "top" },
    margin: { t: 60, l: 60, r: 30, b: 120 },
    barmode: "group"
};
const stackedLayout = { ...commonLayout, barmode: "stack" };

function resetTraces() {
    Object.keys(traces).forEach(k => traces[k] = []);
}

function buildTraces(entity, rows, bucketKey) {
    const x = [], y = [];
    rows.forEach(r => { x.push(r[bucketKey]); y.push(r.totalCount || 0); });
    const clr = colors[entity] || "#999";
    traces.bar.push({ x, y, name: entity, type: "bar", marker: { color: clr } });
    traces.line.push({ x, y, name: entity, type: "scatter", mode: "lines", marker: { color: clr } });
    traces.area.push({ x, y, name: entity, type: "scatter", mode: "lines", fill: "tozeroy", marker: { color: clr } });
    traces.stacked.push({ x, y, name: entity, type: "bar", marker: { color: clr } });
    traces.spline.push({ x, y, name: entity, type: "scatter", mode: "lines", line: { shape: "spline" }, marker: { color: clr } });
    traces.step.push({ x, y, name: entity, type: "scatter", mode: "lines", line: { shape: "hv" }, marker: { color: clr } });
}

const chartConfig = [
    { id: "barChart", key: "bar", layout: commonLayout },
    { id: "lineChart", key: "line", layout: commonLayout },
    { id: "areaChart", key: "area", layout: commonLayout },
    { id: "stackedBarChart", key: "stacked", layout: stackedLayout },
    { id: "splineChart", key: "spline", layout: commonLayout },
    { id: "stepChart", key: "step", layout: commonLayout },
    { id: "comboChart", key: null, layout: commonLayout }
];

function renderCharts() {
    chartConfig.forEach(c => {
        if (c.id === "comboChart") {
            Plotly.newPlot(c.id, traces.bar.concat(traces.line), c.layout);
        } else {
            Plotly.newPlot(c.id, traces[c.key], c.layout);
        }
    });
}

function buildSubscriptionQuery(entity, granularity) {
    const target = entity === "Completed Jobs" ? "Jobs" : entity;
    let B = "X_WEEK_BEGIN", E = "X_WEEK_END", F = "DAY";
    if (granularity === "monthly") { B = "X_MONTH_BEGIN"; E = "X_MONTH_END"; F = "Week-WK"; }
    if (granularity === "yearly") { B = "X_YEAR_BEGIN"; E = "X_YEAR_END"; F = "MONTH"; }
    const referralFilter = entity === "Jobs" || "Completed Jobs"
        ? `{andWhere: {Referral_Source: [{where: {Company: [{ where: { name: "Gallagher Melbourne" } }]}}]}}`
        : "";
    const statusFilter = entity === "Completed Jobs" ? `{andWhere:{job_status:"Report Sent"}}` : "";
    return {
        query: `
          subscription sub${target}($${B}:TimestampSecondsScalar,$${E}:TimestampSecondsScalar){
            subscribeToCalc${target}(query:[
              {where:{created_at:$${B},_OPERATOR_:gte}}
              {andWhere:{created_at:$${E},_OPERATOR_:lte}}
               ${statusFilter}
             ${referralFilter}
            ]){
              totalCount:count(args:[{field:["id"]}])
              bucket:field(arg:["created_at"])@dateFormat(value:"${F}")
            }
          }`,
        variables: { [B]: 0, [E]: 0 }
    };
}

function initializeSocket(entity, granularity) {
    const socket = new WebSocket(wsUrl, "vitalstats");
    socket.onopen = () => {
        keepAliveInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN)
                socket.send(JSON.stringify({ type: "KEEP_ALIVE" }));
        }, 28000);
        socket.send(JSON.stringify({ type: "CONNECTION_INIT" }));
        const { query, variables } = buildSubscriptionQuery(entity, granularity);
        socket.send(JSON.stringify({ id: `sub_${entity}`, type: "GQL_START", payload: { query, variables } }));
    };
    socket.onmessage = e => {
        const d = JSON.parse(e.data);
        if (d.type === "GQL_DATA" && d.payload?.data) {
            const rows = Object.values(d.payload.data)[0] || [];
            buildTraces(entity, rows, "bucket");
            readyCount++;
            if (readyCount === entities.length) {
                clearInterval(keepAliveInterval);
                document.getElementById("loader").classList.add("hidden");
                const hasData = traces.bar.some(t => t.y.some(v => v > 0));
                if (hasData) {
                    document.getElementById("chartGrid").classList.remove("hidden");
                    renderCharts();
                } else {
                    document.getElementById("noDataMessage").classList.remove("hidden");
                }
            }
        }
    };
    socket.onerror = () => console.error(`WS error ${entity}`);
    socket.onclose = () => clearInterval(keepAliveInterval);
}

function loadData(granularity) {
    readyCount = 0;
    resetTraces();
    document.getElementById("chartGrid").classList.add("hidden");
    document.getElementById("noDataMessage").classList.add("hidden");
    document.getElementById("loader").classList.remove("hidden");
    entities.forEach(e => initializeSocket(e, granularity));
}

function loadCustomRange(rangeStartDate, rangeEndDate) {
    let selectedFormatInRangeFormat = 'Yearly';
    const selectedFormatInRange = document.getElementById("selectedFormatInRange")?.textContent;
    if (selectedFormatInRange === 'Yearly') selectedFormatInRangeFormat = 'MONTH';
    else if (selectedFormatInRange === 'Monthly') selectedFormatInRangeFormat = 'Week-WK';
    else if (selectedFormatInRange === 'Weekly') selectedFormatInRangeFormat = 'DAY';
    const dateFormat = selectedFormatInRangeFormat;

    readyCount = 0;
    resetTraces();
    document.getElementById("chartGrid").classList.add("hidden");
    document.getElementById("noDataMessage").classList.add("hidden");
    document.getElementById("loader").classList.remove("hidden");

    function buildRangeSub(entity) {
        const target = entity === "Completed Jobs" ? "Jobs" : entity;
        const statusFilter = entity === "Completed Jobs" ? `{andWhere:{job_status:"Report Sent"}}` : "";
        const referralFilter = entity === "Jobs" || "Completed Jobs"
            ? `{andWhere: {Referral_Source: [{where: {Company: [{ where: { name: "Gallagher Melbourne" } }]}}]}}`
            : "";
        return {
            query: `
                            subscription subscribeToCalc${target}(
                                $rangeStartDate: TimestampSecondsScalar,
                                $rangeEndDate:   TimestampSecondsScalar
                                ) {
                                subscribeToCalc${target}(
                                    query: [
                                        { where:    { created_at: $rangeStartDate, _OPERATOR_: gte } }
                                        { andWhere: { created_at: $rangeEndDate,   _OPERATOR_: lte } }
                                         ${statusFilter}
                                         ${referralFilter}
                                    ]
                                ) {
                                    totalCount: count(args:[{ field:["id"] }])
                                    Date_Added:  field(arg:["created_at"]) @dateFormat(value:"${dateFormat}")
                                }
                            }
                         `,
            variables: { rangeStartDate, rangeEndDate }
        };
    }

    entities.forEach(entity => {
        const socket = new WebSocket(wsUrl, "vitalstats");
        socket.onopen = () => {
            keepAliveInterval = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN)
                    socket.send(JSON.stringify({ type: "KEEP_ALIVE" }));
            }, 28000);
            socket.send(JSON.stringify({ type: "CONNECTION_INIT" }));
            const payload = buildRangeSub(entity);
            socket.send(JSON.stringify({ id: `range_${entity}`, type: "GQL_START", payload }));
        };
        socket.onmessage = event => {
            const data = JSON.parse(event.data);
            if (data.type === "GQL_DATA" && data.payload?.data) {
                const rows = data.payload.data[`subscribeToCalc${entity}`] || [];
                buildTraces(entity, rows, "Date_Added");
                readyCount++;
                if (readyCount === entities.length) {
                    clearInterval(keepAliveInterval);
                    document.getElementById("loader").classList.add("hidden");
                    const hasData = traces.bar.some(t => t.y.some(v => v > 0));
                    if (hasData) {
                        document.getElementById("chartGrid").classList.remove("hidden");
                        renderCharts();
                    } else {
                        document.getElementById("noDataMessage").classList.remove("hidden");
                    }
                }
            }
        };
        socket.onerror = () => console.error(`WebSocket error for ${entity}`);
        socket.onclose = () => clearInterval(keepAliveInterval);
    });
}

window.addEventListener("DOMContentLoaded", () => {
    loadData(currentGranularity);
    ["weeklyBtn", "monthlyBtn", "yearlyBtn"].forEach(id => {
        document.getElementById(id).addEventListener("click", () => {
            currentGranularity = id.replace("Btn", "");
            ["weeklyBtn", "monthlyBtn", "yearlyBtn"].forEach(x => {
                document.getElementById(x).classList.replace("bg-blue-500", "bg-gray-300");
                document.getElementById(x).classList.replace("text-white", "text-gray-700");
            });
            document.getElementById(id).classList.replace("bg-gray-300", "bg-blue-500");
            document.getElementById(id).classList.replace("text-gray-700", "text-white");
            $("#dateRange").val("");
            loadData(currentGranularity);
        });
    });

    $('#dateRange').daterangepicker({
        opens: 'center', autoUpdateInput: false,
        locale: { cancelLabel: 'Clear', format: 'YYYY-MM-DD' }
    });
    $('#dateRange').on('apply.daterangepicker', function (ev, picker) {
        selectedStart = Math.floor(picker.startDate.toDate().getTime() / 1000);
        selectedEnd = Math.floor(picker.endDate.toDate().getTime() / 1000);
        $(this).val(
            picker.startDate.format('YYYY-MM-DD') + ' to ' + picker.endDate.format('YYYY-MM-DD')
        );
    });
    $('#dateRange').on('cancel.daterangepicker', function () {
        $(this).val(''); selectedStart = selectedEnd = null;
    });
    $('#viewRangeBtn').on('click', () => {
        if (!selectedStart || !selectedEnd) return alert("Select a valid date range");
        loadCustomRange(selectedStart, selectedEnd);
    });
});

window.addEventListener("DOMContentLoaded", () => {
    const multiselect = document.getElementById("multiselect");
    const toggle = document.getElementById("dropdown-toggle");
    const input = document.getElementById("dropdown-input");
    const list = document.getElementById("dropdown-list");
    const selectedContainer = document.getElementById("selected-items");
    const dropdownEntities = [...entities];
    let selectedEntities = [...entities];

    function populateList() {
        list.innerHTML = "";
        dropdownEntities.forEach(item => {
            const li = document.createElement("li");
            li.className = "flex items-center px-2 py-1 hover:bg-gray-100 cursor-pointer";
            li.addEventListener("click", e => {
                e.stopPropagation();
                const idx = selectedEntities.indexOf(item);
                if (idx > -1) selectedEntities.splice(idx, 1);
                else selectedEntities.push(item);
                updateSelected();
                populateList();
            });
            const box = document.createElement("div");
            box.className = "w-4 h-4 mr-2 border rounded-sm flex items-center justify-center";
            if (selectedEntities.includes(item)) {
                box.classList.add("border-blue-600");
                box.innerHTML = `<svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>`;
            }
            li.append(box, document.createTextNode(item));
            list.appendChild(li);
        });
        const applyLi = document.createElement("li");
        applyLi.className = "px-2 py-2 flex justify-center hover:bg-gray-100 cursor-pointer";
        const applyButton = document.createElement("button");
        applyButton.textContent = "Apply";
        applyButton.className = "bg-blue-600 text-white px-3 py-1 rounded w-full";
        applyButton.addEventListener("click", e => {
            e.stopPropagation();
            entities.splice(0, entities.length, ...selectedEntities);
            list.classList.add("hidden");
            if (selectedStart && selectedEnd) loadCustomRange(selectedStart, selectedEnd);
            else loadData(currentGranularity);
            updateSelected();
        });
        applyLi.appendChild(applyButton);
        list.appendChild(applyLi);
    }

    function updateSelected() {
        selectedContainer.innerHTML = "";
        selectedEntities.forEach(item => {
            const badge = document.createElement("div");
            badge.className = "flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm";
            badge.textContent = item;
            const remove = document.createElement("span");
            remove.innerHTML = "×";
            remove.className = "ml-1 cursor-pointer";
            remove.addEventListener("click", e => {
                e.stopPropagation();
                selectedEntities.splice(selectedEntities.indexOf(item), 1);
                updateSelected();
                populateList();
            });
            badge.appendChild(remove);
            selectedContainer.appendChild(badge);
        });
        input.value = selectedEntities.join(", ");
    }

    function openDropdown() {
        populateList();
        list.classList.remove("hidden");
    }

    toggle.addEventListener("click", e => { e.stopPropagation(); openDropdown(); });
    input.addEventListener("click", e => { e.stopPropagation(); openDropdown(); });
    document.addEventListener("click", e => {
        if (!multiselect.contains(e.target)) list.classList.add("hidden");
    });

    updateSelected();
});
