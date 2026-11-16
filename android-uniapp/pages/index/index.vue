<template>
  <view class="app-shell">
    <web-view class="reader-webview" :src="src" @message="onMessage" />
  </view>
</template>

<script>
export default {
  data() {
    return {
      // 运行 npm run build:android 后，Web 构建产物位于 hybrid/html
      src: '/hybrid/html/index.html',
    }
  },
  methods: {
    onMessage(event) {
      // 预留原生桥接：可在此处理文件选择、分享等原生能力
      console.log('web-view message', event.detail)
    },
  },
}
</script>

<style>
.app-shell {
  width: 100%;
  height: 100vh;
  background: #f2efe6;
}
</style>
