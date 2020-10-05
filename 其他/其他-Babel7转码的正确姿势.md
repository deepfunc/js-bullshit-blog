Babel 转码的配置是每位前端童鞋在日常工作中都会遇到的。刚开始我也是在网上搜索各种配置方法，升级到 Babel 7 的时候又折腾了一把，所以决定把自己的心得和理解记录下来，希望能帮助到有需要的童鞋。

这里呢不打算去讲每一个详细的配置项，毕竟官方文档是最权威的。这篇主要是说下 Babel 7 转码中会涉及到的几个主要库以及他们之间的关系，还有不同的项目类型怎么选择配置方案和一些技巧。



## 涉及到的主要库

首先呢先介绍一下 Babel 7 转码涉及到的“四大天王”：

- `@babel/preset-env`
- `@babel/polyfill`
- `@babel/runtime`
- `@babel/plugin-transform-runtime`

这四个库有什么作用和联系？相信很多童鞋跟我当初一样总是有点分不清，下面就来逐一简单解释下，当然最详细的内容还是要看官方文档。



### @babel/preset-env

这个是 Babel 转码的环境预设，会根据你设定的目标环境（例如要支持的浏览器版本范围）来调整语法转换规则和选择环境垫片补丁，相比前任的优点是更智能，打包出来的体积也会更小。



### @babel/polyfill

这个可以模拟基本完全的 ES6+ 环境（不能低于 Stage 4 的提案）。例如，新的 Class：Promise、Map，静态方法：Array.from，新的原型方法：Array.prototype.includes 等。但要注意的是，使用 polyfill 的话是会污染全局的，因为要提供原型方法的支持。

> 注意，这个库在 Babel 7.4.0 后已被弃用，用下面的代替：
>
> ```javascript
> import 'core-js/stable';
> import 'regenerator-runtime/runtime';
> ```
>
> 但思想是一样的。



### @babel/runtime

这个库提供了一些转码过程中的一些帮助函数。简单点来说就是在转码过程中，对于一些新语法，都会抽象一个个小的函数，在转码过程中完成替换。比如说我们写了一个 `class Circle {...}`，转码后就会变成这样：

```javascript
function _classCallCheck(instance, Constructor) {
  //...
}

var Circle = function Circle() {
  _classCallCheck(this, Circle);
};
```

所以在每次转换 class 新语法的时候，都会用 `_classCallCheck` 这个函数去替换。



### @babel/plugin-transform-runtime

这个是和上面的 @babel/runtime 配合使用的。延续上面的那个例子，如果你的项目有多个 js 文件里面有 class 需要转码，那每个文件都会有一个重复的 _classCallCheck 函数定义，plugin-transform-runtime 的一个主要作用就是从统一的地方去引用这些帮助函数，消除代码冗余从而减少打包的体积：

```javascript
var _classCallCheck = require("@babel/runtime/helpers/classCallCheck");

var Circle = function Circle() {
  _classCallCheck(this, Circle);
};
```

除此之外，他还提供了一个沙盒环境。如果我们使用 @babel/polyfill 来支持使用一些 ES6+ 的新特性的话（如：Promise、Map 等），会造成全局污染。通过配置 plugin-transform-runtime 的 `corejs` 选项可以开启沙盒环境支持，在当前需要转码的文件中单独引入所需的新功能。



## 安装说明

接下来我们看看上面的四大天王怎么安装：

```shell
npm install --save @babel/runtime, @babel/polyfill
npm install --save-dev @babel/preset-env, @babel/plugin-transform-runtime
```

这里也许有童鞋会有跟我当时同样的疑问：@babel/runtime 不是打包转码过程中用的吗，怎么会安装为运行环境依赖呢？——还记得 plugin-transform-runtime 会从统一的地方去引用这些帮助函数吗，这意味着这些代码会在运行时执行，所以当然是运行时依赖啦。



然后这里给大家提供一个小技巧。有时我们会安装配置 @babel/preset-stage-x 去使用一些新的提案，当在 Babel 7 中这些 preset-stage-x 已经被弃用了，我们必须是一个个的安装所需的插件，还得去改 `.babelrc` 的配置，挺烦的，怎么简化呢？我们可以用下面的方法去简化安装，比如 stage-2：

1. 首先：`npm install --save-dev @babel/preset-stage-2`
2. 然后：`npx babel-upgrade --write --install`

这样就搞定了。babel-upgrade 这个工具会自动帮你安装所需的插件，并且把 package.json 和 .babelrc 文件相关的地方都改好，非常好用！



## 不同项目类型的配置建议

这里我们主要分为 npm 库项目和业务项目来建议配置，仅供大家参考。当然首先 preset-env 是都要安装的，然后根据你的目标环境做好配置。



### npm 库项目

这个简单点来说就是你写了一个第三方库来给别人使用的，runtime 和 plugin-transform-runtime 肯定是都要安装上的。特别注意 polyfill 不要安装，我的建议是：由业务项目来负责垫片补丁，因为 polyfill 会污染全局。



### 业务项目

这个就是我们的具体业务项目如网站啦什么的。那么 runtime、plugin-transform-runtime、和 polyfill 都要安装上，并且 @babel/preset-env 要配置上 `useBuiltIns: 'entry'`，这是为了在项目入口文件上根据目标环境来智能选择导入哪些 polyfill 而不是全部导入，这是 preset-env 会帮你做的事情（具体请参考 polyfill 文档），最后别忘记了在入口文件上 `import '@babel/polyfill'`。





以上即是我总结的 Babel 7 转码姿势，如果对本篇有疑问或建议，欢迎在 [这里](https://github.com/deepfunc/js-bullshit-blog/issues/4) 提出。

欢迎 star 和关注我的 JS 博客：[小声比比 JavaScript](https://github.com/deepfunc/js-bullshit-blog)



## 参考资料

- [Babel Docs](https://babeljs.io/docs/en/next/)