<script>
export default {
  onLaunch() {
    // #ifdef APP-PLUS
    try {
      plus.navigator.setStatusBarBackground('#f2efe6')
      plus.navigator.setStatusBarStyle('dark')
    } catch (error) {
      console.warn('状态栏设置失败', error)
    }
    // #endif
  },
}
</script>

<style>
page,
html,
body {
  height: 100%;
  margin: 0;
  padding: 0;
  background: #f2efe6;
}
</style>
