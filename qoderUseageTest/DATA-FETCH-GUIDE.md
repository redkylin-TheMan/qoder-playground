# Qoder Credits 数据自动获取工具

## 功能说明

这个工具可以自动从 Qoder 官网获取您的 Credits 使用数据，并自动去重和更新到 `data.json` 文件中。

## 使用方法

### 1. 首次使用

```bash
npm run fetch:data
```

### 2. 脚本执行流程

1. **自动启动 Edge 浏览器**
2. **打开 Qoder 使用情况页面** (`https://qoder.com/account/usage`)
3. **等待您确认登录状态**
   - 如果已登录，直接按回车继续
   - 如果未登录，请先在浏览器中登录，然后按回车
4. **自动获取数据**
   - 获取近 30 天的数据
   - 自动分页获取所有数据
   - 显示获取进度
5. **智能去重和合并**
   - 读取现有的 `data.json`
   - 根据时间戳精准去重
   - 合并新旧数据
6. **自动保存**
   - 覆盖更新 `public/data.json`
   - 显示新增记录数量

## 特性

✅ **自动分页**：自动获取所有页面的数据  
✅ **智能去重**：基于时间戳精准去重，不会重复添加  
✅ **增量更新**：只添加新数据，保留历史数据  
✅ **可视化进度**：实时显示获取进度和统计信息  
✅ **安全登录**：使用您自己的浏览器会话，安全可靠  

## 数据结构

获取的数据格式如下：

```json
{
  "time": 1778126076222,
  "source": "IDE",
  "operation": "Agent",
  "kind": "Charged",
  "credits": 1.22,
  "model_category": "Qwen3.6-Plus",
  "cost": 0.01
}
```

## 配置说明

可以在 `fetch-data.js` 中修改以下配置：

```javascript
const CONFIG = {
  usageUrl: 'https://qoder.com/account/usage',
  dataFilePath: path.join(__dirname, 'public', 'data.json'),
  pageSize: 100,           // 每页数据量
  requestDelay: 1000       // 请求延迟（毫秒）
};
```

## 定时更新（可选）

如果您想定期自动更新数据，可以设置 cron 任务：

### Windows 任务计划程序

1. 打开"任务计划程序"
2. 创建基本任务
3. 设置触发器（如每天、每周）
4. 操作：启动程序
   - 程序：`npm`
   - 参数：`run fetch:data`
   - 起始于：`E:\work\test\qoderUseageTest`

## 注意事项

⚠️ **首次使用需要登录**：脚本会打开浏览器，请确保已登录 Qoder 账号  
⚠️ **保持网络稳定**：获取数据过程中请保持网络连接  
⚠️ **不要关闭浏览器**：脚本执行过程中会自动控制浏览器，请勿手动关闭  

## 常见问题

**Q: 脚本报错说找不到浏览器？**  
A: 确保已安装 Microsoft Edge 浏览器

**Q: 获取的数据不完整？**  
A: 检查是否已正确登录，网络是否稳定

**Q: 可以修改获取的时间范围吗？**  
A: 可以，修改 `fetch-data.js` 中的 `calculateTimeRange()` 函数

## 更新日志

- **v1.0.0** (2026-05-07)
  - 初始版本
  - 支持自动获取数据
  - 支持智能去重和合并
  - 支持分页获取
