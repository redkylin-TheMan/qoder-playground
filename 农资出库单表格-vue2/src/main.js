import Vue from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/antd.css'
import { message } from 'ant-design-vue'
import App from './App.vue'

Vue.config.productionTip = false

// 全局注册所有 antd 组件（与 drying-fe 真实项目写法一致）
Vue.use(Antd)

// 函数式 API 挂到原型，组件内可用 this.$message
Vue.prototype.$message = message

new Vue({
  render: h => h(App)
}).$mount('#app')
