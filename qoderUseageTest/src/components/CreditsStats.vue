<template>
  <div class="credits-container">
    <div class="header">
      <h1>Qoder Credits 使用分析</h1>
      <p>实时可视化您的 Credits 消耗情况</p>
    </div>

    <div v-if="loading" class="loading">
      <t-loading :loading="true" size="large" text="加载中..." />
    </div>

    <template v-else>
      <!-- 统计卡片 -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ totalCredits.toFixed(2) }}</div>
          <div class="stat-label">总 Credits</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ filteredData.length }}</div>
          <div class="stat-label">使用次数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ avgCredits.toFixed(2) }}</div>
          <div class="stat-label">平均 Credits</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ maxCredits.toFixed(2) }}</div>
          <div class="stat-label">最大单次</div>
        </div>
      </div>

      <!-- 每日统计表格 -->
      <div class="card">
        <h2 class="section-title">每日统计</h2>
        <div class="table-container">
          <table class="daily-stats-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>使用次数</th>
                <th>总 Credits</th>
                <th>平均 Credits</th>
                <th>最大单次</th>
                <th>最小单次</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="day in dailyStats" :key="day.date">
                <td>{{ day.date }}</td>
                <td>{{ day.count }}</td>
                <td>{{ day.total.toFixed(2) }}</td>
                <td>{{ day.avg.toFixed(2) }}</td>
                <td>{{ day.max.toFixed(2) }}</td>
                <td>{{ day.min.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 筛选器 -->
      <div class="card">
        <div class="filter-section">
          <span class="filter-label">时间范围:</span>
          <t-radio-group
            v-model="timeRange"
            variant="default-filled"
            @change="handleTimeRangeChange"
          >
            <t-radio-button value="3">近三天</t-radio-button>
            <t-radio-button value="7">近一周</t-radio-button>
            <t-radio-button value="15">近15天</t-radio-button>
            <t-radio-button value="30">近一个月</t-radio-button>
            <t-radio-button value="all">全部</t-radio-button>
          </t-radio-group>
          <t-tag theme="primary" variant="outline" class="time-tag">
            {{ timeRangeText }}
          </t-tag>
        </div>

        <!-- 图表 -->
        <div ref="chartRef" class="chart-container"></div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";
import * as echarts from "echarts";

const chartRef = ref(null);
const rawData = ref([]);
const loading = ref(true);
const timeRange = ref("7");
let chart = null;

// 加载数据
const loadData = async () => {
  try {
    const response = await fetch("/data.json");
    rawData.value = await response.json();
    loading.value = false;
    await nextTick();
    initChart();
  } catch (error) {
    console.error("加载数据失败:", error);
    loading.value = false;
  }
};

// 筛选数据
const filteredData = computed(() => {
  if (timeRange.value === "all") {
    return rawData.value.sort((a, b) => a.time - b.time);
  }

  const now = Date.now();
  const days = parseInt(timeRange.value);
  const cutoffTime = now - days * 24 * 60 * 60 * 1000;

  return rawData.value
    .filter((item) => item.time >= cutoffTime)
    .sort((a, b) => a.time - b.time);
});

// 统计信息
const totalCredits = computed(() => {
  return filteredData.value.reduce((sum, item) => sum + item.credits, 0);
});

const avgCredits = computed(() => {
  if (filteredData.value.length === 0) return 0;
  return totalCredits.value / filteredData.value.length;
});

const maxCredits = computed(() => {
  if (filteredData.value.length === 0) return 0;
  return Math.max(...filteredData.value.map((item) => item.credits));
});

// 每日统计
const dailyStats = computed(() => {
  const data = filteredData.value;
  const dailyMap = new Map();

  data.forEach((item) => {
    const date = new Date(item.time);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {
        date: dateKey,
        count: 0,
        total: 0,
        max: 0,
        min: Infinity,
        credits: [],
      });
    }

    const dayData = dailyMap.get(dateKey);
    dayData.count++;
    dayData.total += item.credits;
    dayData.max = Math.max(dayData.max, item.credits);
    dayData.min = Math.min(dayData.min, item.credits);
    dayData.credits.push(item.credits);
  });

  const stats = Array.from(dailyMap.values()).map((day) => ({
    date: day.date,
    count: day.count,
    total: day.total,
    avg: day.total / day.count,
    max: day.max,
    min: day.min === Infinity ? 0 : day.min,
  }));

  return stats.sort((a, b) => new Date(b.date) - new Date(a.date));
});

const timeRangeText = computed(() => {
  if (timeRange.value === "all") return "全部数据";
  const days = parseInt(timeRange.value);
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return `${formatDate(start)} - ${formatDate(now)}`;
});

const formatDate = (date) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
};

// 初始化图表
const initChart = () => {
  if (!chartRef.value) return;
  chart = echarts.init(chartRef.value);
  updateChart();
};

// 更新图表
const updateChart = () => {
  if (!chart) return;

  const data = filteredData.value;
  const times = data.map((item) => {
    const date = new Date(item.time);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  });
  const credits = data.map((item) => item.credits);

  const option = {
    title: {
      text: "Credits 使用趋势",
      left: "center",
      textStyle: {
        fontSize: 20,
        fontWeight: 600,
        color: "#333",
      },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(0, 0, 0, 0.8)",
      borderColor: "#667eea",
      borderWidth: 2,
      textStyle: {
        color: "#fff",
      },
      formatter: function (params) {
        const data = params[0];
        const item = filteredData.value[data.dataIndex];
        return `
          <div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 8px;">${data.name}</div>
            <div>Credits: <span style="color: #667eea; font-weight: bold;">${data.value}</span></div>
            <div style="margin-top: 4px; font-size: 12px; opacity: 0.8;">
              模型: ${item.model_category}<br/>
              操作: ${item.operation}<br/>
              来源: ${item.source}
            </div>
          </div>
        `;
      },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: "15%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: times,
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: "#667eea",
        },
      },
      axisLabel: {
        color: "#666",
        rotate: 45,
        interval: "auto",
      },
      axisTick: {
        lineStyle: {
          color: "#667eea",
        },
      },
    },
    yAxis: {
      type: "value",
      name: "Credits",
      nameTextStyle: {
        fontSize: 14,
        fontWeight: 600,
        color: "#333",
      },
      axisLine: {
        lineStyle: {
          color: "#667eea",
        },
      },
      axisLabel: {
        color: "#666",
      },
      splitLine: {
        lineStyle: {
          color: "#e0e0e0",
          type: "dashed",
        },
      },
    },
    series: [
      {
        name: "Credits",
        type: "line",
        data: credits,
        smooth: true,
        symbol: "circle",
        symbolSize: 8,
        itemStyle: {
          color: "#667eea",
        },
        lineStyle: {
          width: 3,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: "#667eea" },
            { offset: 1, color: "#764ba2" },
          ]),
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(102, 126, 234, 0.5)" },
            { offset: 1, color: "rgba(102, 126, 234, 0.05)" },
          ]),
        },
        animationDuration: 1500,
        animationEasing: "cubicOut",
      },
    ],
    animationDuration: 1500,
    animationEasing: "cubicOut",
  };

  chart.setOption(option, true);
};

// 处理时间范围变化
const handleTimeRangeChange = () => {
  updateChart();
};

// 监听数据变化
watch(filteredData, () => {
  if (chart) {
    updateChart();
  }
});

// 响应窗口大小变化
const handleResize = () => {
  if (chart) {
    chart.resize();
  }
};

onMounted(() => {
  loadData();
  window.addEventListener("resize", handleResize);
});
</script>

<style scoped>
.credits-container {
  padding: 24px;
}

.header {
  text-align: center;
  margin-bottom: 32px;
  animation: fadeInDown 0.8s ease-out;
}

.header h1 {
  color: #333;
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.header p {
  color: #666;
  font-size: 16px;
}

.card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  padding: 32px;
  margin-bottom: 24px;
  animation: fadeInUp 0.8s ease-out;
}

.filter-section {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 24px;
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 12px;
}

.filter-label {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.time-tag {
  margin-left: auto;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  animation: fadeInUp 0.8s ease-out;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 24px rgba(102, 126, 234, 0.4);
}

.stat-card:nth-child(2) {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-card:nth-child(3) {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-card:nth-child(4) {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

.chart-container {
  height: 500px;
  margin-top: 24px;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #667eea;
}

.table-container {
  overflow-x: auto;
  margin-top: 16px;
}

.daily-stats-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.daily-stats-table thead {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.daily-stats-table th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
}

.daily-stats-table td {
  padding: 14px 16px;
  border-bottom: 1px solid #e0e0e0;
  font-size: 14px;
  color: #333;
}

.daily-stats-table tbody tr {
  transition: background-color 0.2s ease;
}

.daily-stats-table tbody tr:hover {
  background-color: #f5f7fa;
}

.daily-stats-table tbody tr:last-child td {
  border-bottom: none;
}

.loading {
  text-align: center;
  padding: 60px;
  color: #666;
  font-size: 18px;
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
