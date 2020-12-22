<template>
  <div id="app">
    <img alt="Vue logo" src="./assets/logo.png" />
    <Profile />
    <afile />
    <zfile />
    <noTag />
  </div>
</template>

<script>
import Profile from "./components/Profile.vue";
import afile from "./views/afile/index.vue";
import zfile from "./views/x/y/z/zfile.vue";
import noTag from "./views/noTag/notag.vue";

export default {
  name: "App",
  components: {
    Profile,
    afile,
    zfile,
    noTag,
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
