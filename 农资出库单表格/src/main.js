import { createApp } from 'vue'
// ant-design-vue（前缀 a-）与 tdesign-vue-next（前缀 t-）前缀不冲突，可同时全局注册
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import TDesign from 'tdesign-vue-next'
import 'tdesign-vue-next/es/style/index.css'
import App from './App.vue'

const app = createApp(App)
app.use(Antd)
app.use(TDesign)
app.mount('#app')
