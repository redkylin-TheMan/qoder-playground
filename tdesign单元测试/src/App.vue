<template>
  <div class="app-container">
    <h1 class="page-title">TDesign Table 全样式展示</h1>
    <p class="page-desc">涵盖 TDesign Vue Next Table 组件的所有主要功能与样式变体</p>

    <!-- ====== 1. 基础表格 ====== -->
    <section class="demo-section">
      <h2>1. 基础表格 (Base Table)</h2>
      <p class="section-desc">最基本的表格用法，展示纯数据列表。</p>
      <t-table :data="baseData" :columns="baseColumns" row-key="id" />
    </section>

    <!-- ====== 2. 边框表格 ====== -->
    <section class="demo-section">
      <h2>2. 边框表格 (Bordered)</h2>
      <p class="section-desc"><code>bordered</code> 属性为表格添加外边框和列边框。</p>
      <t-table :data="baseData" :columns="baseColumns" bordered row-key="id" />
    </section>

    <!-- ====== 3. 斑马纹表格 ====== -->
    <section class="demo-section">
      <h2>3. 斑马纹表格 (Stripe)</h2>
           <p class="section-desc"><code>stripe</code> 属性使隔行变色，提升可读性。</p>
      <t-table :data="baseData" :columns="baseColumns" stripe row-key="id" />
    </section>

    <!-- ====== 4. 悬浮高亮 ====== -->
    <section class="demo-section">
      <h2>4. 悬浮高亮 (Hover)</h2>
      <p class="section-desc"><code>hover</code> 属性使鼠标悬浮行高亮显示。</p>
      <t-table :data="baseData" :columns="baseColumns" hover row-key="id" />
    </section>

    <!-- ====== 5. 尺寸变体 ====== -->
    <section class="demo-section">
      <h2>5. 尺寸变体 (Size)</h2>
      <p class="section-desc"><code>size</code> 属性控制表格大小：<code>small</code>、<code>medium</code>（默认）、<code>large</code>。</p>
      <div class="size-group">
        <div class="size-item">
          <h4>Small</h4>
          <t-table :data="baseData" :columns="baseColumns" size="small" row-key="id" />
        </div>
        <div class="size-item">
          <h4>Medium (默认)</h4>
          <t-table :data="baseData" :columns="baseColumns" size="medium" row-key="id" />
        </div>
        <div class="size-item">
          <h4>Large</h4>
          <t-table :data="baseData" :columns="baseColumns" size="large" row-key="id" />
        </div>
      </div>
    </section>

    <!-- ====== 6. 加载状态 ====== -->
    <section class="demo-section">
      <h2>6. 加载状态 (Loading)</h2>
      <p class="section-desc"><code>loading</code> 属性展示数据加载中的状态。</p>
      <div style="display: flex; gap: 12px; margin-bottom: 12px;">
        <t-button @click="loading = !loading" variant="outline">
          {{ loading ? '关闭加载' : '开启加载' }}
        </t-button>
      </div>
      <t-table :data="baseData" :columns="baseColumns" :loading="loading" row-key="id" />
    </section>

    <!-- ====== 7. 空数据 ====== -->
    <section class="demo-section">
      <h2>7. 空数据 (Empty)</h2>
      <p class="section-desc"><code>data</code> 为空数组时显示空状态。可使用 <code>empty</code> 插槽自定义。</p>
      <t-table :data="[]" :columns="baseColumns" row-key="id" />
    </section>

    <!-- ====== 8. 自定义空数据 ====== -->
    <section class="demo-section">
      <h2>8. 自定义空数据 (Custom Empty)</h2>
      <t-table :data="[]" :columns="baseColumns" row-key="id">
        <template #empty>
          <div style="padding: 40px; text-align: center; color: #999;">
            <t-icon name="info-circle" size="32px" />
            <p style="margin-top: 8px;">暂无数据，请稍后再试～</p>
          </div>
        </template>
      </t-table>
    </section>

    <!-- ====== 9. 文本省略 ====== -->
    <section class="demo-section">
      <h2>9. 文本省略 (Ellipsis)</h2>
      <p class="section-desc">列配置 <code>ellipsis</code> 为 true 时，超长文本自动省略并以 Tooltip 显示。</p>
      <t-table :data="ellipsisData" :columns="ellipsisColumns" row-key="id" />
    </section>

    <!-- ====== 10. 固定表头 ====== -->
    <section class="demo-section">
      <h2>10. 固定表头 (Fixed Header)</h2>
      <p class="section-desc">设置 <code>max-height</code> 或 <code>height</code> 后表头固定，内容区域可滚动。</p>
      <t-table :data="scrollData" :columns="baseColumns" max-height="240" row-key="id" />
    </section>

    <!-- ====== 11. 固定列 ====== -->
    <section class="demo-section">
      <h2>11. 固定列 (Fixed Column)</h2>
      <p class="section-desc">列配置 <code>fixed: 'left'</code> 或 <code>fixed: 'right'</code> 可固定列。</p>
      <t-table :data="fixedData" :columns="fixedColumns" table-layout="fixed" bordered row-key="id" />
    </section>

    <!-- ====== 12. 排序 ====== -->
    <section class="demo-section">
      <h2>12. 排序 (Sortable)</h2>
      <p class="section-desc">列配置 <code>sortable</code> 启用排序。监听 <code>sort-change</code> 获取排序变化。</p>
      <t-table
        :data="sortData"
        :columns="sortColumns"
        row-key="id"
        @sort-change="onSortChange"
      />
      <div v-if="sortInfo" class="event-log">
        排序事件: 字段={{ sortInfo.sortBy }}, 方式={{ sortInfo.sortOrder }}
      </div>
    </section>

    <!-- ====== 13. 筛选 ====== -->
    <section class="demo-section">
      <h2>13. 筛选 (Filter)</h2>
      <p class="section-desc">列配置 <code>filter</code> 启用筛选功能。支持单选/多选筛选。</p>
      <t-table
        :data="filterData"
        :columns="filterColumns"
        row-key="id"
        @filter-change="onFilterChange"
      />
      <div v-if="filterInfo" class="event-log">
        筛选事件: {{ JSON.stringify(filterInfo) }}
      </div>
    </section>

    <!-- ====== 14. 多选 ====== -->
    <section class="demo-section">
      <h2>14. 多选 (Selection)</h2>
      <p class="section-desc">列配置 <code>colKey: 'row-select'</code> 启用行选择。</p>
      <t-table
        :data="selectData"
        :columns="selectColumns"
        :selected-row-keys="selectedRowKeys"
        row-key="id"
        @select-change="onSelectChange"
      />
      <div class="event-log">
        已选中: {{ selectedRowKeys.length }} 行 — IDs: {{ selectedRowKeys.join(', ') || '无' }}
      </div>
    </section>

    <!-- ====== 15. 单选 ====== -->
    <section class="demo-section">
      <h2>15. 单选 (Radio Selection)</h2>
      <t-table
        :data="selectData"
        :columns="radioSelectColumns"
        :selected-row-keys="radioSelectedKey"
        row-key="id"
        @select-change="onRadioSelectChange"
      />
      <div class="event-log">
        已选中: {{ radioSelectedKey.length ? radioSelectedKey[0] : '无' }}
      </div>
    </section>

    <!-- ====== 16. 展开行 ====== -->
    <section class="demo-section">
      <h2>16. 可展开行 (Expandable Row)</h2>
      <p class="section-desc">列配置 <code>colKey: 'expand'</code> 启用行展开，使用 <code>#expanded-row</code> 插槽自定义展开内容。</p>
      <t-table
        :data="expandData"
        :columns="expandColumns"
        :expanded-row-keys="expandedRowKeys"
        row-key="id"
        @expand-change="onExpandChange"
      >
        <template #expanded-row="{ row }">
          <div class="expand-content">
            <p><strong>详细信息：</strong></p>
            <p>姓名：{{ row.name }} | 年龄：{{ row.age }} | 部门：{{ row.department }}</p>
            <p>个人简介：{{ row.bio }}</p>
          </div>
        </template>
      </t-table>
    </section>

    <!-- ====== 17. 树形数据 ====== -->
    <section class="demo-section">
      <h2>17. 树形数据 (Tree Data)</h2>
      <p class="section-desc">数据中嵌套 <code>children</code> 字段，表格自动渲染树形结构。</p>
      <t-table :data="treeData" :columns="treeColumns" row-key="id" />
    </section>

    <!-- ====== 18. 分页 ====== -->
    <section class="demo-section">
      <h2>18. 分页 (Pagination)</h2>
      <p class="section-desc">配置 <code>pagination</code> 属性启用分页。监听 <code>page-change</code> 获取分页变化。</p>
      <t-table
        :data="paginationData"
        :columns="baseColumns"
        :pagination="pagination"
        row-key="id"
        @page-change="onPageChange"
      />
    </section>

    <!-- ====== 19. 自定义单元格渲染 ====== -->
    <section class="demo-section">
      <h2>19. 自定义单元格渲染 (Custom Cell Render)</h2>
      <p class="section-desc">通过列的 <code>cell</code> 插槽或 <code>render</code> 函数自定义单元格内容。</p>
      <t-table :data="customCellData" :columns="customCellColumns" row-key="id" />
    </section>

    <!-- ====== 20. 自定义表头 ====== -->
    <section class="demo-section">
      <h2>20. 自定义表头 (Custom Header)</h2>
      <p class="section-desc">通过列的 <code>title</code> 插槽自定义表头内容。</p>
      <t-table :data="baseData" :columns="customHeaderColumns" row-key="id" />
    </section>

    <!-- ====== 21. 行样式 & 类名 ====== -->
    <section class="demo-section">
      <h2>21. 行样式 & 类名 (Row ClassName)</h2>
      <p class="section-desc"><code>rowClassName</code> 为函数时，可按条件为行添加类名。</p>
      <t-table
        :data="rowStyleData"
        :columns="baseColumns"
        row-key="id"
        :row-class-name="getRowClassName"
      />
    </section>

    <!-- ====== 22. 对齐方式 ====== -->
    <section class="demo-section">
      <h2>22. 对齐方式 (Align)</h2>
      <p class="section-desc">列配置 <code>align</code> 控制水平对齐：<code>left</code>、<code>center</code>、<code>right</code>。</p>
      <t-table :data="baseData" :columns="alignColumns" bordered row-key="id" />
    </section>

    <!-- ====== 23. 垂直对齐 ====== -->
    <section class="demo-section">
      <h2>23. 垂直对齐 (Vertical Align)</h2>
      <p class="section-desc"><code>verticalAlign</code> 控制单元格垂直对齐：<code>top</code>、<code>middle</code>、<code>bottom</code>。</p>
      <t-table :data="baseData" :columns="baseColumns" vertical-align="top" bordered row-key="id" />
    </section>

    <!-- ====== 24. 表尾合计 ====== -->
    <section class="demo-section">
      <h2>24. 表尾合计 (Footer Summary)</h2>
      <p class="section-desc">使用 <code>footData</code> 和 <code>#footerSummary</code> 插槽在表格底部显示合计行。</p>
      <t-table
        :data="summaryData"
        :columns="summaryColumns"
        row-key="id"
        bordered
      >
        <template #footerSummary>
          <div class="summary-row">
            <span class="summary-cell" style="width: 100px; padding: 8px 16px;"><strong>合计</strong></span>
            <span class="summary-cell" style="flex: 1; padding: 8px 16px;"></span>
            <span class="summary-cell" style="flex: 1; padding: 8px 16px; color: #e34d59; font-weight: bold;">{{ totalSalary }}</span>
            <span class="summary-cell" style="flex: 1; padding: 8px 16px; color: #0052d9; font-weight: bold;">{{ totalCount }} 人</span>
          </div>
        </template>
      </t-table>
    </section>

    <!-- ====== 25. 多级表头 ====== -->
    <section class="demo-section">
      <h2>25. 多级表头 (Group Header)</h2>
      <p class="section-desc">列配置中使用 <code>children</code> 嵌套实现多级表头。</p>
      <t-table :data="groupHeaderData" :columns="groupHeaderColumns" bordered row-key="id" />
    </section>

    <!-- ====== 26. 可拖拽排序 ====== -->
    <section class="demo-section">
      <h2>26. 可拖拽排序 (Drag Sort)</h2>
      <p class="section-desc">使用 <code>dragSort</code> 属性启用行拖拽排序。支持 <code>row</code>（行拖拽）、<code>row-handle-col</code>（拖拽手柄列）。</p>
      <t-table
        :data="dragData"
        :columns="dragColumns"
        row-key="id"
        drag-sort="row"
        @drag-sort="onDragSort"
      />
      <div class="event-log">
        拖拽排序后顺序: {{ dragData.map(d => d.name).join(' → ') }}
      </div>
    </section>

    <!-- ====== 27. 可调整列宽 ====== -->
    <section class="demo-section">
      <h2>27. 可调整列宽 (Resizable)</h2>
      <p class="section-desc">列配置 <code>resizable: true</code> 启用拖拽调整列宽功能。</p>
      <t-table :data="baseData" :columns="resizableColumns" bordered row-key="id" table-layout="fixed" />
    </section>

    <!-- ====== 28. 显示首行数据 ====== -->
    <section class="demo-section">
      <h2>28. 首行固定 (First Full Row)</h2>
      <p class="section-desc">使用 <code>firstFullRow</code> 插槽在表格首行插入自定义内容。</p>
      <t-table :data="baseData" :columns="baseColumns" row-key="id" bordered>
        <template #firstFullRow>
          <tr>
            <td :colspan="baseColumns.length" style="background: #e8f3ff; text-align: center; padding: 12px; color: #0052d9;">
              📢 首行自定义内容：重要通知区域
            </td>
          </tr>
        </template>
      </t-table>
    </section>

    <!-- ====== 29. 最后一行全行 ====== -->
    <section class="demo-section">
      <h2>29. 末行自定义 (Last Full Row)</h2>
      <t-table :data="baseData" :columns="baseColumns" row-key="id" bordered>
        <template #lastFullRow>
          <tr>
            <td :colspan="baseColumns.length" style="background: #fff7e6; text-align: center; padding: 12px; color: #e37318;">
              📊 末行自定义内容：数据统计摘要区域
            </td>
          </tr>
        </template>
      </t-table>
    </section>

    <!-- ====== 30. 行点击事件 ====== -->
    <section class="demo-section">
      <h2>30. 行点击事件 (Row Click Events)</h2>
      <p class="section-desc">监听 <code>row-click</code>、<code>row-dblclick</code>、<code>row-hover</code> 等事件。</p>
      <t-table
        :data="baseData"
        :columns="baseColumns"
        row-key="id"
        hover
        @row-click="onRowClick"
        @row-hover="onRowHover"
      />
      <div class="event-log" v-if="rowEventLog">
        {{ rowEventLog }}
      </div>
    </section>

    <!-- ====== 31. 虚拟滚动 ====== -->
    <section class="demo-section">
      <h2>31. 虚拟滚动 (Virtual Scroll)</h2>
      <p class="section-desc">大量数据时，使用 <code>scroll</code> 配合 <code>type: 'virtual'</code> 实现虚拟滚动，提升性能。</p>
      <t-table
        :data="virtualData"
        :columns="baseColumns"
        row-key="id"
        :scroll="{ type: 'virtual', rowHeight: 48, bufferSize: 10 }"
        style="height: 300px;"
        bordered
      />
      <div class="event-log">共 {{ virtualData.length }} 条数据（虚拟渲染）</div>
    </section>

    <!-- ====== 32. 表格布局模式 ====== -->
    <section class="demo-section">
      <h2>32. 表格布局 (Table Layout)</h2>
      <p class="section-desc"><code>table-layout</code> 属性：<code>auto</code>（默认，列宽自适应）vs <code>fixed</code>（列宽固定）。</p>
      <div class="size-group">
        <div class="size-item">
          <h4>Auto Layout</h4>
          <t-table :data="baseData" :columns="baseColumns" table-layout="auto" bordered row-key="id" />
        </div>
        <div class="size-item">
          <h4>Fixed Layout</h4>
          <t-table :data="baseData" :columns="baseColumns" table-layout="fixed" bordered row-key="id" />
        </div>
      </div>
    </section>

    <!-- ====== 33. 综合用法 ====== -->
    <section class="demo-section">
      <h2>33. 综合用法 (Full Featured)</h2>
      <p class="section-desc">结合边框、斑马纹、悬浮、排序、筛选、分页、多选等特性。</p>
      <t-table
        :data="fullFeatureData"
        :columns="fullFeatureColumns"
        row-key="id"
        bordered
        stripe
        hover
        :pagination="fullPagination"
        :selected-row-keys="fullSelectedKeys"
        @page-change="onFullPageChange"
        @select-change="onFullSelectChange"
        @sort-change="onFullSortChange"
        @filter-change="onFullFilterChange"
      />
      <div class="event-log">
        选中: {{ fullSelectedKeys.length }} 行 | 排序: {{ fullSortInfo || '默认' }} | 筛选: {{ fullFilterInfo || '无' }}
      </div>
    </section>

    <!-- ====== 34. 序号列 ====== -->
    <section class="demo-section">
      <h2>34. 序号列 (Serial Number)</h2>
      <p class="section-desc">列配置 <code>colKey: 'serial-number'</code> 自动生成行号。</p>
      <t-table :data="baseData" :columns="serialColumns" bordered row-key="id" />
    </section>

    <!-- ====== 35. 行高亮 ====== -->
    <section class="demo-section">
      <h2>35. 行高亮 (Active Row)</h2>
      <p class="section-desc"><code>activeRowType</code> 为 <code>single</code> 或 <code>multiple</code> 时，点击行可高亮。通过 <code>activeRowKeys</code> 控制高亮行。</p>
      <t-table
        :data="baseData"
        :columns="baseColumns"
        row-key="id"
        active-row-type="single"
        :active-row-keys="activeRowKeys"
        @active-change="onActiveChange"
      />
      <div class="event-log">
        高亮行 ID: {{ activeRowKeys.join(', ') || '无（点击行试试）' }}
      </div>
    </section>

    <!-- ====== 36. 可编辑单元格 ====== -->
    <section class="demo-section">
      <h2>36. 可编辑单元格 (Editable Cell)</h2>
      <p class="section-desc">列配置 <code>edit</code> 属性启用单元格编辑功能，支持 Input、Select 等编辑组件。</p>
      <t-table
        :data="editableData"
        :columns="editableColumns"
        row-key="id"
        :editable-row-keys="editableRowKeys"
        bordered
      />
      <div class="event-log">
        双击「姓名」或「部门」列的单元格进行编辑
      </div>
    </section>

    <!-- ====== 37. 合并单元格 ====== -->
    <section class="demo-section">
      <h2>37. 合并单元格 (Rowspan &amp; Colspan)</h2>
      <p class="section-desc">通过 <code>rowspanAndColspan</code> 函数自定义单元格合并规则。</p>
      <t-table
        :data="mergeData"
        :columns="mergeColumns"
        row-key="id"
        bordered
        :rowspan-and-colspan="onRowspanAndColspan"
      />
    </section>

    <!-- ====== 38. 多列排序 ====== -->
    <section class="demo-section">
      <h2>38. 多列排序 (Multiple Sort)</h2>
      <p class="section-desc"><code>multipleSort</code> 为 true 时支持同时按多列排序。</p>
      <t-table
        :data="multiSortData"
        :columns="multiSortColumns"
        row-key="id"
        multiple-sort
        @sort-change="onMultiSortChange"
      />
      <div class="event-log" v-if="multiSortInfo">
        多列排序: {{ JSON.stringify(multiSortInfo) }}
      </div>
    </section>

    <!-- ====== 39. 列控制器 ====== -->
    <section class="demo-section">
      <h2>39. 列控制器 (Column Controller)</h2>
      <p class="section-desc">配置 <code>columnController</code> 允许用户动态显示/隐藏列。</p>
      <t-table
        :data="baseData"
        :columns="columnControllerColumns"
        row-key="id"
        :column-controller="columnControllerConfig"
        :display-columns="displayColumns"
        @display-columns-change="onDisplayColumnsChange"
        bordered
      />
    </section>

    <!-- ====== 40. 异步加载 ====== -->
    <section class="demo-section">
      <h2>40. 异步加载 (Async Loading)</h2>
      <p class="section-desc"><code>asyncLoading</code> 属性展示数据异步加载状态，支持 <code>loading</code> 和 <code>load-more</code> 两种状态。</p>
      <div style="display: flex; gap: 12px; margin-bottom: 12px;">
        <t-button size="small" @click="asyncStatus = 'loading'">加载中</t-button>
        <t-button size="small" @click="asyncStatus = 'load-more'">加载更多</t-button>
        <t-button size="small" @click="asyncStatus = ''">恢复正常</t-button>
      </div>
      <t-table
        :data="baseData"
        :columns="baseColumns"
        row-key="id"
        :async-loading="asyncStatus"
        @async-loading-click="onAsyncLoadingClick"
      />
    </section>

    <!-- ====== 41. 排序列高亮 ====== -->
    <section class="demo-section">
      <h2>41. 排序列背景高亮 (Sort Column Bg Color)</h2>
      <p class="section-desc"><code>showSortColumnBgColor</code> 属性高亮当前排序的列。</p>
      <t-table
        :data="sortData"
        :columns="sortColumns"
        row-key="id"
        show-sort-column-bg-color
      />
    </section>

    <!-- ====== 42. 拖拽手柄排序 ====== -->
    <section class="demo-section">
      <h2>42. 拖拽手柄排序 (Drag Handler Sort)</h2>
      <p class="section-desc"><code>dragSort="row-handler"</code> 配合 <code>colKey: 'drag'</code> 列实现手柄拖拽。</p>
      <t-table
        :data="dragHandlerData"
        :columns="dragHandlerColumns"
        row-key="id"
        drag-sort="row-handler"
        @drag-sort="onDragHandlerSort"
      />
    </section>

    <!-- ====== 43. 隐藏表头 ====== -->
    <section class="demo-section">
      <h2>43. 隐藏表头 (Hide Header)</h2>
      <p class="section-desc"><code>showHeader: false</code> 隐藏表头行。</p>
      <t-table
        :data="baseData"
        :columns="baseColumns"
        row-key="id"
        :show-header="false"
        bordered
      />
    </section>

    <!-- ====== 44. 吸顶/吸底 ====== -->
    <section class="demo-section">
      <h2>44. 表头吸顶 &amp; 页脚吸底 (Affix)</h2>
      <p class="section-desc"><code>headerAffixedTop</code> 表头吸顶，<code>footerAffixedBottom</code> 页脚吸底，<code>paginationAffixedBottom</code> 分页吸底。</p>
      <t-table
        :data="affixData"
        :columns="summaryColumns"
        row-key="id"
        bordered
        :header-affixed-top="{ offsetTop: 0, zIndex: 1000 }"
        max-height="280"
      >
        <template #footerSummary>
          <div class="summary-row">
            <span class="summary-cell" style="width: 80px; padding: 8px 16px;"><strong>合计</strong></span>
            <span class="summary-cell" style="flex: 1; padding: 8px 16px;"></span>
            <span class="summary-cell" style="width: 150px; padding: 8px 16px; color: #e34d59; font-weight: bold;">¥ {{ affixTotalSalary }}</span>
            <span class="summary-cell" style="flex: 1; padding: 8px 16px;"></span>
          </div>
        </template>
      </t-table>
    </section>

    <!-- ====== 45. 懒加载 ====== -->
    <section class="demo-section">
      <h2>45. 懒加载 (Lazy Load)</h2>
      <p class="section-desc"><code>lazyLoad: true</code> 时表格在滚动到可视区域后才渲染，优化页面初始加载性能。</p>
      <t-table
        :data="baseData"
        :columns="baseColumns"
        row-key="id"
        lazy-load
      />
    </section>
  </div>
</template>

<script setup>
import { ref, computed, h } from 'vue'
import { Tag, Button, Link, Popup } from 'tdesign-vue-next'

// ==================== 公共数据 ====================

const departments = ['技术部', '产品部', '设计部', '市场部', '运营部', '人事部']
const statuses = ['在线', '离线', '忙碌', '休假']
const bios = [
  '资深工程师，擅长前端架构设计与性能优化',
  '产品经理，专注用户体验与增长策略',
  '视觉设计师，精通品牌与 UI 设计',
  '市场专员，善于数据驱动的营销策略',
  '运营经理，有丰富的社区运营经验',
  'HR 专家，专注于人才发展与组织建设'
]

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generatePerson(id) {
  return {
    id,
    name: `员工${String(id).padStart(3, '0')}`,
    age: 22 + (id % 20),
    department: departments[id % departments.length],
    status: statuses[id % statuses.length],
    salary: (8000 + id * 500) + Math.floor(id * 100),
    bio: bios[id % bios.length],
    email: `user${id}@example.com`,
    phone: `138${String(id).padStart(8, '0')}`
  }
}

// ==================== 1. 基础表格 ====================

const baseColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'age', title: '年龄', width: 80 },
  { colKey: 'department', title: '部门', width: 120 },
  { colKey: 'email', title: '邮箱' }
]
const baseData = ref(Array.from({ length: 5 }, (_, i) => generatePerson(i + 1)))

// ==================== 6. 加载状态 ====================

const loading = ref(true)

// ==================== 9. 文本省略 ====================

const ellipsisColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'bio', title: '个人简介', ellipsis: true },
  { colKey: 'email', title: '邮箱', ellipsis: true }
]
const ellipsisData = ref(Array.from({ length: 5 }, (_, i) => generatePerson(i + 1)))

// ==================== 10. 固定表头 ====================

const scrollData = ref(Array.from({ length: 20 }, (_, i) => generatePerson(i + 1)))

// ==================== 11. 固定列 ====================

const fixedColumns = [
  { colKey: 'id', title: 'ID', width: 80, fixed: 'left' },
  { colKey: 'name', title: '姓名', width: 120, fixed: 'left' },
  { colKey: 'age', title: '年龄', width: 100 },
  { colKey: 'department', title: '部门', width: 150 },
  { colKey: 'email', title: '邮箱', width: 200 },
  { colKey: 'phone', title: '手机号', width: 200 },
  { colKey: 'status', title: '状态', width: 100 },
  { colKey: 'salary', title: '薪资', width: 150, fixed: 'right' }
]
const fixedData = ref(Array.from({ length: 8 }, (_, i) => generatePerson(i + 1)))

// ==================== 12. 排序 ====================

const sortInfo = ref(null)
const sortColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'age', title: '年龄', width: 100, sorter: true },
  { colKey: 'department', title: '部门', width: 120 },
  { colKey: 'salary', title: '薪资', width: 120, sorter: true }
]
const sortData = ref(Array.from({ length: 8 }, (_, i) => generatePerson(i + 1)))

function onSortChange(val) {
  sortInfo.value = val
  if (val.sortBy === 'age') {
    sortData.value.sort((a, b) =>
      val.sortOrder === 'asc' ? a.age - b.age : val.sortOrder === 'desc' ? b.age - a.age : 0
    )
  } else if (val.sortBy === 'salary') {
    sortData.value.sort((a, b) =>
      val.sortOrder === 'asc' ? a.salary - b.salary : val.sortOrder === 'desc' ? b.salary - a.salary : 0
    )
  }
}

// ==================== 13. 筛选 ====================

const filterInfo = ref(null)
const filterColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'age', title: '年龄', width: 100 },
  {
    colKey: 'department',
    title: '部门',
    width: 150,
    filter: {
      type: 'single',
      list: departments.map(d => ({ label: d, value: d }))
    }
  },
  {
    colKey: 'status',
    title: '状态',
    width: 120,
    filter: {
      type: 'multiple',
      list: statuses.map(s => ({ label: s, value: s }))
    }
  }
]
const filterData = ref(Array.from({ length: 10 }, (_, i) => generatePerson(i + 1)))

function onFilterChange(val) {
  filterInfo.value = val
}

// ==================== 14-15. 选择 ====================

const selectColumns = [
  { colKey: 'row-select', type: 'multiple', width: 50 },
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'department', title: '部门', width: 120 },
  { colKey: 'status', title: '状态', width: 100 }
]
const selectData = ref(Array.from({ length: 8 }, (_, i) => generatePerson(i + 1)))
const selectedRowKeys = ref([])

function onSelectChange(val) {
  selectedRowKeys.value = val
}

// 单选
const radioSelectColumns = [
  { colKey: 'row-select', type: 'single', width: 50 },
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'department', title: '部门', width: 120 }
]
const radioSelectedKey = ref([])
function onRadioSelectChange(val) {
  radioSelectedKey.value = val
}

// ==================== 16. 展开行 ====================

const expandedRowKeys = ref([])
const expandColumns = [
  { colKey: 'expand', width: 50 },
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'age', title: '年龄', width: 100 },
  { colKey: 'department', title: '部门', width: 120 }
]
const expandData = ref(Array.from({ length: 5 }, (_, i) => generatePerson(i + 1)))

function onExpandChange(val) {
  expandedRowKeys.value = val
}

// ==================== 17. 树形数据 ====================

const treeColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '名称', width: 200 },
  { colKey: 'department', title: '部门', width: 150 },
  { colKey: 'status', title: '状态', width: 100 }
]
const treeData = ref([
  {
    id: 1, name: '技术部', department: '—', status: '在线',
    children: [
      { id: 11, name: '前端组', department: '技术部', status: '在线' },
      { id: 12, name: '后端组', department: '技术部', status: '忙碌',
        children: [
          { id: 121, name: 'Java 组', department: '技术部', status: '在线' },
          { id: 122, name: 'Go 组', department: '技术部', status: '离线' }
        ]
      },
      { id: 13, name: '测试组', department: '技术部', status: '休假' }
    ]
  },
  {
    id: 2, name: '产品部', department: '—', status: '在线',
    children: [
      { id: 21, name: 'B端产品组', department: '产品部', status: '在线' },
      { id: 22, name: 'C端产品组', department: '产品部', status: '忙碌' }
    ]
  },
  { id: 3, name: '设计部', department: '—', status: '在线' }
])

// ==================== 18. 分页 ====================

const pagination = ref({
  current: 1,
  pageSize: 5,
  total: 30,
  showJumper: true,
  showPageSize: true,
  pageSizeOptions: [5, 10, 20]
})
const paginationData = ref(Array.from({ length: 30 }, (_, i) => generatePerson(i + 1)))

function onPageChange(val) {
  pagination.value.current = val.current
  pagination.value.pageSize = val.pageSize
}

// ==================== 19. 自定义单元格 ====================

const customCellColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  {
    colKey: 'status',
    title: '状态',
    width: 120,
    cell: (h, { row }) => {
      const themeMap = { '在线': 'success', '离线': 'default', '忙碌': 'warning', '休假': 'danger' }
      return h(Tag, { theme: themeMap[row.status] || 'default', variant: 'light', size: 'small' }, () => row.status)
    }
  },
  {
    colKey: 'salary',
    title: '薪资',
    width: 150,
    cell: (h, { row }) => {
      return h('span', { style: { color: '#e34d59', fontWeight: 'bold' } }, `¥ ${row.salary.toLocaleString()}`)
    }
  },
  {
    colKey: 'operation',
    title: '操作',
    width: 180,
    cell: (h, { row }) => {
      return h('div', { style: { display: 'flex', gap: '8px' } }, [
        h(Button, { theme: 'primary', variant: 'text', size: 'small' }, () => '查看'),
        h(Button, { theme: 'warning', variant: 'text', size: 'small' }, () => '编辑'),
        h(Button, { theme: 'danger', variant: 'text', size: 'small' }, () => '删除')
      ])
    }
  }
]
const customCellData = ref(Array.from({ length: 6 }, (_, i) => generatePerson(i + 1)))

// ==================== 20. 自定义表头 ====================

const customHeaderColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  {
    colKey: 'name',
    title: () => h('span', { style: { color: '#0052d9' } }, ['👤 姓名'])
  },
  { colKey: 'age', title: '年龄', width: 80 },
  { colKey: 'department', title: '部门', width: 120 }
]

// ==================== 21. 行样式 ====================

const rowStyleData = ref(Array.from({ length: 6 }, (_, i) => generatePerson(i + 1)))

function getRowClassName({ row }) {
  if (row.status === '忙碌') return 'row-busy'
  if (row.status === '休假') return 'row-vacation'
  return ''
}

// ==================== 22. 对齐方式 ====================

const alignColumns = [
  { colKey: 'id', title: 'ID (left)', width: 120, align: 'left' },
  { colKey: 'name', title: '姓名 (center)', width: 140, align: 'center' },
  { colKey: 'salary', title: '薪资 (right)', width: 140, align: 'right' },
  { colKey: 'department', title: '部门 (left)', width: 140, align: 'left' }
]

// ==================== 24. 表尾合计 ====================

const summaryColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'salary', title: '薪资', width: 150 },
  { colKey: 'department', title: '部门' }
]
const summaryData = ref(Array.from({ length: 5 }, (_, i) => generatePerson(i + 1)))

const totalSalary = computed(() =>
  summaryData.value.reduce((sum, r) => sum + r.salary, 0).toLocaleString()
)
const totalCount = computed(() => summaryData.value.length)

// ==================== 25. 多级表头 ====================

const groupHeaderColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  {
    title: '工作信息',
    children: [
      { colKey: 'department', title: '部门', width: 120 },
      { colKey: 'status', title: '状态', width: 100 },
      { colKey: 'salary', title: '薪资', width: 120 }
    ]
  },
  {
    title: '联系方式',
    children: [
      { colKey: 'email', title: '邮箱' },
      { colKey: 'phone', title: '手机号' }
    ]
  }
]
const groupHeaderData = ref(Array.from({ length: 5 }, (_, i) => generatePerson(i + 1)))

// ==================== 26. 拖拽排序 ====================

const dragColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'department', title: '部门', width: 120 },
  { colKey: 'status', title: '状态', width: 100 }
]
const dragData = ref(Array.from({ length: 6 }, (_, i) => generatePerson(i + 1)))

function onDragSort({ current, target }) {
  const list = [...dragData.value]
  const [moved] = list.splice(current, 1)
  list.splice(target, 0, moved)
  dragData.value = list
}

// ==================== 27. 可调整列宽 ====================

const resizableColumns = [
  { colKey: 'id', title: 'ID', width: 80, resizable: true },
  { colKey: 'name', title: '姓名', width: 150, resizable: true },
  { colKey: 'age', title: '年龄', width: 100, resizable: true },
  { colKey: 'department', title: '部门', width: 150, resizable: true },
  { colKey: 'email', title: '邮箱', width: 200, resizable: true }
]

// ==================== 30. 行事件 ====================

const rowEventLog = ref('')
function onRowClick({ row, index }) {
  rowEventLog.value = `点击了第 ${index + 1} 行: ${row.name}`
}
function onRowHover({ row, index }) {
  if (row) {
    rowEventLog.value = `悬浮在第 ${index + 1} 行: ${row.name}`
  }
}

// ==================== 31. 虚拟滚动 ====================

const virtualData = Array.from({ length: 1000 }, (_, i) => generatePerson(i + 1))

// ==================== 33. 综合用法 ====================

const fullSortInfo = ref(null)
const fullFilterInfo = ref(null)
const fullSelectedKeys = ref([])
const fullPagination = ref({
  current: 1,
  pageSize: 5,
  total: 20,
  showJumper: true
})
const fullFeatureColumns = [
  { colKey: 'row-select', type: 'multiple', width: 50 },
  { colKey: 'id', title: 'ID', width: 70 },
  { colKey: 'name', title: '姓名', width: 100 },
  { colKey: 'age', title: '年龄', width: 80, sorter: true },
  {
    colKey: 'department',
    title: '部门',
    width: 120,
    filter: {
      type: 'single',
      list: departments.map(d => ({ label: d, value: d }))
    }
  },
  {
    colKey: 'status',
    title: '状态',
    width: 100,
    cell: (h, { row }) => {
      const themeMap = { '在线': 'success', '离线': 'default', '忙碌': 'warning', '休假': 'danger' }
      return h(Tag, { theme: themeMap[row.status] || 'default', variant: 'light', size: 'small' }, () => row.status)
    }
  },
  { colKey: 'salary', title: '薪资', width: 120, sorter: true },
  {
    colKey: 'operation',
    title: '操作',
    width: 150,
    cell: (h) => {
      return h('div', { style: { display: 'flex', gap: '8px' } }, [
        h(Button, { theme: 'primary', variant: 'text', size: 'small' }, () => '编辑'),
        h(Button, { theme: 'danger', variant: 'text', size: 'small' }, () => '删除')
      ])
    }
  }
]
const fullFeatureData = ref(Array.from({ length: 20 }, (_, i) => generatePerson(i + 1)))

function onFullPageChange(val) {
  fullPagination.value.current = val.current
}
function onFullSelectChange(val) {
  fullSelectedKeys.value = val
}
function onFullSortChange(val) {
  fullSortInfo.value = `${val.sortBy} ${val.sortOrder}`
}
function onFullFilterChange(val) {
  fullFilterInfo.value = JSON.stringify(val)
}

// ==================== 34. 序号列 ====================

const serialColumns = [
  { colKey: 'serial-number', title: '序号', width: 80 },
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'department', title: '部门', width: 120 },
  { colKey: 'email', title: '邮箱' }
]

// ==================== 35. 行高亮 ====================

const activeRowKeys = ref([])
function onActiveChange(keys) {
  activeRowKeys.value = keys
}

// ==================== 36. 可编辑单元格 ====================

import { Input, Select } from 'tdesign-vue-next'

const editableRowKeys = ref([])
const editableData = ref(Array.from({ length: 5 }, (_, i) => ({
  ...generatePerson(i + 1),
  editable: true
})))
editableRowKeys.value = editableData.value.map(r => String(r.id))

const editableColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  {
    colKey: 'name',
    title: '姓名 (可编辑)',
    width: 160,
    edit: {
      component: Input,
      keepEditMode: true,
      props: { clearable: true },
      onEdited: (context) => {
        editableData.value[context.rowIndex].name = context.newValue
      }
    }
  },
  { colKey: 'age', title: '年龄', width: 80 },
  {
    colKey: 'department',
    title: '部门 (可编辑)',
    width: 180,
    edit: {
      component: Select,
      keepEditMode: true,
      props: {
        options: departments.map(d => ({ label: d, value: d })),
        clearable: true
      },
      onEdited: (context) => {
        editableData.value[context.rowIndex].department = context.newValue
      }
    }
  },
  { colKey: 'email', title: '邮箱' }
]

// ==================== 37. 合并单元格 ====================

const mergeColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'department', title: '部门', width: 120 },
  { colKey: 'status', title: '状态', width: 100 },
  { colKey: 'email', title: '邮箱' }
]
const mergeData = ref(Array.from({ length: 6 }, (_, i) => generatePerson(i + 1)))

function onRowspanAndColspan({ rowIndex, colIndex }) {
  // 第一列的奇数行合并到上方（每两行合并）
  if (colIndex === 0 && rowIndex % 2 === 1) {
    return { rowspan: 0, colspan: 0 }
  }
  if (colIndex === 0 && rowIndex % 2 === 0) {
    return { rowspan: 2, colspan: 1 }
  }
  // 第三列（部门）相同部门的行合并
  if (colIndex === 2) {
    const currentDept = mergeData.value[rowIndex]?.department
    const prevDept = mergeData.value[rowIndex - 1]?.department
    if (prevDept === currentDept) {
      return { rowspan: 0, colspan: 0 }
    }
    // 向下查找连续相同的部门
    let span = 1
    for (let i = rowIndex + 1; i < mergeData.value.length; i++) {
      if (mergeData.value[i].department === currentDept) span++
      else break
    }
    if (span > 1) return { rowspan: span, colspan: 1 }
  }
}

// ==================== 38. 多列排序 ====================

const multiSortInfo = ref(null)
const multiSortColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'age', title: '年龄', width: 100, sorter: true },
  { colKey: 'department', title: '部门', width: 120 },
  { colKey: 'salary', title: '薪资', width: 120, sorter: true }
]
const multiSortData = ref(Array.from({ length: 10 }, (_, i) => generatePerson(i + 1)))

function onMultiSortChange(val) {
  multiSortInfo.value = val
}

// ==================== 39. 列控制器 ====================

const displayColumns = ref(['id', 'name', 'age', 'department', 'email'])
const columnControllerColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'age', title: '年龄', width: 80 },
  { colKey: 'department', title: '部门', width: 120 },
  { colKey: 'email', title: '邮箱', width: 200 },
  { colKey: 'phone', title: '手机号', width: 200 },
  { colKey: 'status', title: '状态', width: 100 }
]
const columnControllerConfig = {
  fields: ['id', 'name', 'age', 'department', 'email', 'phone', 'status'],
  dialogProps: { preventScrollThrough: false },
  hideTriggerButton: false
}

function onDisplayColumnsChange(val) {
  displayColumns.value = val
}

// ==================== 40. 异步加载 ====================

const asyncStatus = ref('')
function onAsyncLoadingClick({ status }) {
  if (status === 'load-more') {
    asyncStatus.value = 'loading'
    setTimeout(() => {
      asyncStatus.value = ''
    }, 1500)
  }
}

// ==================== 42. 拖拽手柄排序 ====================

const dragHandlerColumns = [
  { colKey: 'drag', title: '排序', width: 60 },
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'department', title: '部门', width: 120 },
  { colKey: 'status', title: '状态', width: 100 }
]
const dragHandlerData = ref(Array.from({ length: 6 }, (_, i) => generatePerson(i + 1)))

function onDragHandlerSort({ current, target }) {
  const list = [...dragHandlerData.value]
  const [moved] = list.splice(current, 1)
  list.splice(target, 0, moved)
  dragHandlerData.value = list
}

// ==================== 44. 吸顶吸底 ====================

const affixData = ref(Array.from({ length: 15 }, (_, i) => generatePerson(i + 1)))
const affixTotalSalary = computed(() =>
  affixData.value.reduce((sum, r) => sum + r.salary, 0).toLocaleString()
)
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f7fa;
  color: #333;
}

.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px 80px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.page-desc {
  font-size: 14px;
  color: #888;
  margin-bottom: 40px;
}

.demo-section {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.demo-section h2 {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}

.section-desc {
  font-size: 13px;
  color: #888;
  margin-bottom: 16px;
  line-height: 1.6;
}

.section-desc code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #e34d59;
}

.size-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.size-item h4 {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.event-log {
  margin-top: 12px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  font-family: 'Courier New', monospace;
}

.expand-content {
  padding: 16px 24px;
  background: #fafafa;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.8;
}

.summary-row {
  display: flex;
  align-items: center;
  border-top: 1px solid #e7e7e7;
  background: #fafafa;
}

.summary-cell {
  display: inline-block;
}

/* 行样式 */
:deep(.row-busy) {
  background-color: #fff7e6 !important;
}

:deep(.row-vacation) {
  background-color: #e8f8f0 !important;
}
</style>
