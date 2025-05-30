import Config from './config.js';
const gaugeIndices = [0, 1];

export default class ChartApp {
  static refererNameCondition = '';
  static updatedGranualarity = 'weekly';

  constructor() {
    this.selectedEntities = [];
    this.colors = {};

    Object.entries(Config.entitiesConfig).forEach(([entity, cfg]) => {
      if (cfg.selected !== false) this.selectedEntities.push(entity);
      this.colors[entity] = cfg.defaultColor;
      cfg.statuses.forEach(s => {
        if (s.selected !== false) this.selectedEntities.push(s.type);
        this.colors[s.type] = s.color;
      });
    });

    this.entities = [...this.selectedEntities];
    this.traces = { bar: [], line: [], area: [], stacked: [], spline: [], step: [] };
    this.readyCount = 0;
    this.keepAliveInterval = null;
    this.currentGranularity = ChartApp.updatedGranualarity;
    this.selectedStart = null;
    this.selectedEnd = null;
    this.sockets = [];
  }

  get wsUrl() { return Config.wsUrl; }

  resetTraces() {
    Object.keys(this.traces).forEach(k => this.traces[k] = []);
  }

  buildTraces(entity, rows, bucketKey) {
    const x = [], y = [];
    rows.forEach(r => { x.push(r[bucketKey]); y.push(r.totalCount || 0); });
    const clr = this.colors[entity] || '#999';
    this.traces.bar.push({ x, y, name: entity, type: 'bar', marker: { color: clr } });
    this.traces.line.push({ x, y, name: entity, type: 'scatter', mode: 'lines', marker: { color: clr } });
    this.traces.area.push({ x, y, name: entity, type: 'scatter', mode: 'lines', fill: 'tozeroy', marker: { color: clr } });
    this.traces.stacked.push({ x, y, name: entity, type: 'bar', marker: { color: clr } });
    this.traces.spline.push({ x, y, name: entity, type: 'scatter', mode: 'lines', line: { shape: 'spline' }, marker: { color: clr } });
    this.traces.step.push({ x, y, name: entity, type: 'scatter', mode: 'lines', line: { shape: 'hv' }, marker: { color: clr } });
  }

  renderCharts() {
    const commonLayout = {
      yaxis: { title: 'Count' },
      legend: { orientation: 'h', x: 0, xanchor: 'left', y: 1.15, yanchor: 'top' },
      margin: { t: 60, l: 60, r: 30, b: 120 },
      barmode: 'group'
    };
    const stackedLayout = { ...commonLayout, barmode: 'stack' };

    const chartConfig = [
      { id: 'barChart', key: 'bar', layout: commonLayout },
      { id: 'lineChart', key: 'line', layout: commonLayout },
      { id: 'areaChart', key: 'area', layout: commonLayout },
      { id: 'stackedBarChart', key: 'stacked', layout: stackedLayout },
      { id: 'splineChart', key: 'spline', layout: commonLayout },
      { id: 'stepChart', key: 'step', layout: commonLayout },
      { id: 'comboChart', key: null, layout: commonLayout }
    ];
    chartConfig.forEach(c => {
      const data = c.id === 'comboChart'
        ? this.traces.bar.concat(this.traces.line)
        : this.traces[c.key];
      Plotly.newPlot(c.id, data, c.layout);
    });

    // Gauge chart only if Jobs is selected
    const gaugeEl = document.getElementById('gaugeChart');
    if (this.entities.includes('Jobs')) {
      gaugeEl.classList.remove('hidden');
      const jobTrace = this.traces.bar.find(t => t.name === 'Jobs');
      if (!jobTrace) return;
      const totalJobs = jobTrace.y.reduce((sum, v) => sum + v, 0);
      const jobCfg = Config.entitiesConfig.Jobs;
      const selStatuses = jobCfg.statuses.filter(s => s.selected !== false);
      const gauges = gaugeIndices.map((idx, i) => {
        const s = selStatuses[idx];
        if (!s) return null;
        const sTrace = this.traces.bar.find(t => t.name === s.type);
        const stCount = sTrace ? sTrace.y.reduce((sum, v) => sum + v, 0) : 0;
        const domainStart = i * 0.5, domainEnd = domainStart + 0.5;
        return {
          type: 'indicator', mode: 'gauge+number', value: stCount, title: { text: s.type },
          domain: { x: [domainStart, domainEnd], y: [0, 1] },
          gauge: {
            axis: { range: [0, totalJobs] },
            bar: { color: this.colors[s.type] },
            steps: [
              { range: [0, stCount], color: this.colors[s.type] },
              { range: [stCount, totalJobs], color: this.colors['Jobs'] }
            ]
          }
        };
      }).filter(Boolean);
      Plotly.newPlot('gaugeChart', gauges, {
        margin: { t: 60, b: 40, l: 20, r: 20 },
        grid: { rows: 1, columns: gauges.length, pattern: 'independent' }
      });
    } else {
      gaugeEl.classList.add('hidden');
    }
  }

  buildSubscriptionQuery(entity, granularity) {
    // For weekly/monthly/yearly
    let B = 'X_WEEK_BEGIN', E = 'X_WEEK_END', F = 'DAY';
    if (granularity === 'monthly') { B = 'X_MONTH_BEGIN'; E = 'X_MONTH_END'; F = 'Week-WK'; }
    if (granularity === 'yearly') { B = 'X_YEAR_BEGIN'; E = 'X_YEAR_END'; F = 'MONTH'; }

    // Find parent + statusFilter
    let parent = entity, statusFilter = '';
    if (!Config.entitiesConfig[entity]) {
      for (const [ent, cfg] of Object.entries(Config.entitiesConfig)) {
        const m = cfg.statuses.find(s => s.type === entity);
        if (m) {
          parent = ent;
          statusFilter = `{andWhere:{${cfg.statusField}:"${m.condition}"}}`;
          break;
        }
      }
    }

    // referral only for Jobs
    const rf = parent === 'Jobs'
      ? `{andWhere:{${Config.entitiesConfig[parent].referralField}:[{where:{Company:[{where:{name:"${Config.visitorReferralSource}"}}]}}]}}`
      : '';

    // refererNameCondition only for Jobs
    const rc = (parent === 'Jobs') ? ChartApp.refererNameCondition : '';

    return {
      query: `
        subscription sub${parent}($${B}: TimestampSecondsScalar, $${E}: TimestampSecondsScalar) {
          subscribeToCalc${parent}(query:[
            { where:    { created_at: $${B}, _OPERATOR_: gte } },
            { andWhere: { created_at: $${E}, _OPERATOR_: lte } },
            ${statusFilter},
            ${rf},
            ${rc}
          ]) {
            totalCount: count(args:[{ field:["id"] }])
            bucket:     field(arg:["created_at"]) @dateFormat(value:"${F}")
          }
        }`,
      variables: { [B]: 0, [E]: 0 }
    };
  }

  buildRangeSubscriptionQuery(entity, dateFormat) {
    // For custom date range
    let parent = entity, statusFilter = '';
    if (!Config.entitiesConfig[entity]) {
      for (const [ent, cfg] of Object.entries(Config.entitiesConfig)) {
        const m = cfg.statuses.find(s => s.type === entity);
        if (m) {
          parent = ent;
          statusFilter = `{andWhere:{${cfg.statusField}:"${m.condition}"}}`;
          break;
        }
      }
    }

    // referral only for Jobs
    const rf = parent === 'Jobs'
      ? `{andWhere:{${Config.entitiesConfig[parent].referralField}:[{where:{Company:[{where:{name:"${Config.visitorReferralSource}"}}]}}]}}`
      : '';

    // refererNameCondition only for Jobs
    const rc = (parent === 'Jobs') ? ChartApp.refererNameCondition : '';

    return {
      query: `
        subscription subRange${parent}(
          $rangeStart: TimestampSecondsScalar,
          $rangeEnd:   TimestampSecondsScalar
        ) {
          subscribeToCalc${parent}(query:[
            { where:    { created_at: $rangeStart, _OPERATOR_: gte } },
            { andWhere: { created_at: $rangeEnd,   _OPERATOR_: lte } },
            ${statusFilter},
            ${rf},
            ${rc}
          ]) {
            totalCount: count(args:[{ field:["id"] }])
            Date_Added: field(arg:["created_at"]) @dateFormat(value:"${dateFormat}")
          }
        }`,
      variables: { rangeStart: 0, rangeEnd: 0 }
    };
  }

  initializeSocket(entity, granularityOrFormat, isRange = false) {
    const socket = new WebSocket(this.wsUrl, 'vitalstats');
    this.sockets.push(socket);

    socket.onopen = () => {
      this.keepAliveInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'KEEP_ALIVE' }));
        }
      }, 28000);
      socket.send(JSON.stringify({ type: 'CONNECTION_INIT' }));

      const { query, variables } = isRange
        ? this.buildRangeSubscriptionQuery(entity, granularityOrFormat)
        : this.buildSubscriptionQuery(entity, granularityOrFormat);

      // override variables for range
      if (isRange) {
        variables.rangeStart = this.selectedStart;
        variables.rangeEnd = this.selectedEnd;
      }

      socket.send(JSON.stringify({
        id: isRange ? `range_${entity}` : `sub_${entity}`,
        type: 'GQL_START',
        payload: { query, variables }
      }));
    };

    socket.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.type === 'GQL_DATA' && d.payload?.data) {
        const rows = Object.values(d.payload.data)[0] || [];
        const key = isRange ? 'Date_Added' : 'bucket';
        this.buildTraces(entity, rows, key);
        this.readyCount++;
        if (this.readyCount === this.entities.length) {
          clearInterval(this.keepAliveInterval);
          document.getElementById('loader').classList.add('hidden');
          const hasData = this.traces.bar.some(t => t.y.some(v => v > 0));
          if (hasData) {
            document.getElementById('chartGrid').classList.remove('hidden');
            this.renderCharts();
          } else {
            document.getElementById('noDataMessage').classList.remove('hidden');
          }
        }
      }
    };

    socket.onerror = () => console.error(`WS error ${entity}`);
    socket.onclose = () => clearInterval(this.keepAliveInterval);
  }

  closeSockets() {
    this.sockets.forEach(s => { try { s.close(); } catch { } });
    this.sockets = [];
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
  }

  loadData(granularity) {
    this.closeSockets();
    this.readyCount = 0;
    this.resetTraces();
    document.getElementById('chartGrid').classList.add('hidden');
    document.getElementById('noDataMessage').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');
    this.entities.forEach(e => this.initializeSocket(e, granularity, false));
  }

  loadCustomRange(rangeStart, rangeEnd) {
    this.selectedStart = rangeStart;
    this.selectedEnd = rangeEnd;
    this.closeSockets();
    this.readyCount = 0;
    this.resetTraces();
    document.getElementById('chartGrid').classList.add('hidden');
    document.getElementById('noDataMessage').classList.add('hidden');
    document.getElementById('loader').classList.remove('hidden');

    // determine dateFormat from UI
    const txt = document.getElementById('selectedFormatInRange')?.textContent;
    const dateFormat = txt === 'Yearly' ? 'MONTH'
      : txt === 'Monthly' ? 'Week-WK'
        : 'DAY';

    this.entities.forEach(e => this.initializeSocket(e, dateFormat, true));
  }

  setupControls() {
    this.loadData(this.currentGranularity);
    ['weeklyBtn', 'monthlyBtn', 'yearlyBtn'].forEach(id => {
      document.getElementById(id).addEventListener('click', () => {
        this.currentGranularity = id.replace('Btn', '');
        ChartApp.updatedGranualarity = this.currentGranularity;
        ['weeklyBtn', 'monthlyBtn', 'yearlyBtn'].forEach(x => {
          document.getElementById(x).classList.replace('bg-blue-500', 'bg-gray-300');
          document.getElementById(x).classList.replace('text-white', 'text-gray-700');
        });
        document.getElementById(id).classList.replace('bg-gray-300', 'bg-blue-500');
        document.getElementById(id).classList.replace('text-gray-700', 'text-white');
        $('#dateRange').val('');
        this.loadData(this.currentGranularity);
      });
    });

    // date-range picker
    $('#dateRange').daterangepicker({
      opens: 'center', autoUpdateInput: false,
      locale: { cancelLabel: 'Clear', format: 'YYYY-MM-DD' }
    });
    $('#dateRange').on('apply.daterangepicker', (ev, picker) => {
      this.selectedStart = Math.floor(picker.startDate.toDate().getTime() / 1000);
      this.selectedEnd = Math.floor(picker.endDate.toDate().getTime() / 1000);
      $('#dateRange').val(
        picker.startDate.format('YYYY-MM-DD') + ' to ' + picker.endDate.format('YYYY-MM-DD')
      );
    });
    $('#dateRange').on('cancel.daterangepicker', () => {
      $('#dateRange').val('');
      this.selectedStart = this.selectedEnd = null;
    });
    document.getElementById('viewRangeBtn').addEventListener('click', () => {
      if (!this.selectedStart || !this.selectedEnd) return alert('Select a valid date range');
      this.loadCustomRange(this.selectedStart, this.selectedEnd);
    });

    // dropdown multi-select
    const multiselect = document.getElementById('multiselect');
    const toggle = document.getElementById('dropdown-toggle');
    const input = document.getElementById('dropdown-input');
    const list = document.getElementById('dropdown-list');
    const selContainer = document.getElementById('selected-items');
    let selectedEntities = [...this.selectedEntities];

    const updateSelected = () => {
      selContainer.innerHTML = '';
      selectedEntities.forEach(item => {
        const badge = document.createElement('div');
        badge.className = 'flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm';
        badge.textContent = item;
        const remove = document.createElement('span');
        remove.innerHTML = '×';
        remove.className = 'ml-1 cursor-pointer';
        remove.addEventListener('click', e => {
          e.stopPropagation();
          selectedEntities = selectedEntities.filter(x => x !== item);
          updateSelected();
          populateList();
        });
        badge.appendChild(remove);
        selContainer.appendChild(badge);
      });
      input.value = selectedEntities.join(', ');
    };

    const populateList = () => {
      list.innerHTML = '';
      Object.entries(Config.entitiesConfig).forEach(([entity, cfg]) => {
        const li = document.createElement('li');
        // parent
        const parentRow = document.createElement('div');
        parentRow.className = 'flex items-center px-2 py-1 hover:bg-gray-100 cursor-pointer';
        parentRow.addEventListener('click', e => {
          e.stopPropagation();
          const idx = selectedEntities.indexOf(entity);
          if (idx > -1) selectedEntities.splice(idx, 1);
          else selectedEntities.push(entity);
          updateSelected();
          populateList();
        });
        const box = document.createElement('div');
        box.className = 'w-4 h-4 mr-2 border rounded-sm flex items-center justify-center';
        if (selectedEntities.includes(entity)) {
          box.classList.add('border-blue-600');
          box.innerHTML = `<svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                           </svg>`;
        }
        parentRow.append(box, document.createTextNode(entity));
        li.appendChild(parentRow);

        // children if any
        if (cfg.statuses.length) {
          const childUl = document.createElement('ul');
          childUl.className = 'ml-6 list-none';
          cfg.statuses.forEach(s => {
            const childLi = document.createElement('li');
            childLi.className = 'flex items-center px-2 py-1 hover:bg-gray-50 cursor-pointer';
            childLi.addEventListener('click', e => {
              e.stopPropagation();
              const i = selectedEntities.indexOf(s.type);
              if (i > -1) selectedEntities.splice(i, 1);
              else selectedEntities.push(s.type);
              updateSelected();
              populateList();
            });
            const cbox = document.createElement('div');
            cbox.className = 'w-4 h-4 mr-2 border rounded-sm flex items-center justify-center';
            if (selectedEntities.includes(s.type)) {
              cbox.classList.add('border-blue-600');
              cbox.innerHTML = `<svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                                </svg>`;
            }
            childLi.append(cbox, document.createTextNode(s.type));
            childUl.appendChild(childLi);
          });
          li.appendChild(childUl);
        }

        list.appendChild(li);
      });

      // apply button
      const applyLi = document.createElement('li');
      applyLi.className = 'px-2 py-2 flex justify-center hover:bg-gray-100 cursor-pointer';
      const applyBtn = document.createElement('button');
      applyBtn.textContent = 'Apply';
      applyBtn.className = 'bg-blue-600 text-white px-3 py-1 rounded w-full';
      applyBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.selectedEntities = [...selectedEntities];
        this.entities = [...this.selectedEntities];
        list.classList.add('hidden');
        if (this.selectedStart && this.selectedEnd) {
          this.loadCustomRange(this.selectedStart, this.selectedEnd);
        } else {
          this.loadData(this.currentGranularity);
        }
      });
      applyLi.appendChild(applyBtn);
      list.appendChild(applyLi);
    };

    toggle.addEventListener('click', e => {
      e.stopPropagation();
      populateList();
      list.classList.remove('hidden');
    });
    input.addEventListener('click', e => {
      e.stopPropagation();
      populateList();
      list.classList.remove('hidden');
    });
    document.addEventListener('click', e => {
      if (!multiselect.contains(e.target)) list.classList.add('hidden');
    });

    updateSelected();
  }

  start() {
    this.setupControls();
  }

  refererConditionUpdater(name) {
    ChartApp.refererNameCondition = name
      ? `{ andWhere: { Referrer: [{ where: { id: ${name} } }] } }`
      : '';
    // apply only if Jobs remains selected
    if (this.entities.includes('Jobs')) {
      this.loadData(ChartApp.updatedGranualarity);
    }
  }
}
