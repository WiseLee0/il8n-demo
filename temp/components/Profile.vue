<!-- il8n -->
<template>
  <div class="hello">
    <h1>组件翻译</h1>
    <input type="text" placeholder="请输入" />
    <!-- <el-button @click="" class="create-button" size="small" type="primary">
       注释
    </el-button> -->
    <div>
      <span>嵌套一层</span>
      <div>
        <span>嵌套二层</span>
        <div>
          <input type="text" placeholder="嵌套输入提示" />
        </div>
      </div>
    </div>
    <div define-attr="自定义属性"></div>
    <span>
      换行文本换行文本换行文本换行文本换行文本
      换行文本换行文本换行文本换行文本换行文本换行文本换行文本
    </span>
  </div>
</template>

<script>
export default {
  name: "HelloWorld",
  props: {
    msg: String,
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
