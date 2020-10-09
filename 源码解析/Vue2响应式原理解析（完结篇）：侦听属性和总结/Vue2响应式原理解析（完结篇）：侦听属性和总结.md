Hi 大家好，假期快乐鸭~ 咳咳，在前面两篇我们从设计出发讲了一下 Vue2 的响应式原理和实现，还有计算属性的详细解析等等。这一篇呢就是这个系列的最后一篇了，我们来聊一下侦听属性和 `vm.$watch`，再回到设计来总结一下 Vue2 的响应式。如果没有看过前面两篇的朋友先看了前面的再来哈，传送门：[Vue2响应式原理解析（一）：从设计出发](https://github.com/deepfunc/js-bullshit-blog/blob/master/%E6%BA%90%E7%A0%81%E8%A7%A3%E6%9E%90/Vue2%E5%93%8D%E5%BA%94%E5%BC%8F%E5%8E%9F%E7%90%86%E8%A7%A3%E6%9E%90%EF%BC%88%E4%B8%80%EF%BC%89%EF%BC%9A%E4%BB%8E%E8%AE%BE%E8%AE%A1%E5%87%BA%E5%8F%91/Vue2%E5%93%8D%E5%BA%94%E5%BC%8F%E5%8E%9F%E7%90%86%E8%A7%A3%E6%9E%90%EF%BC%88%E4%B8%80%EF%BC%89%EF%BC%9A%E4%BB%8E%E8%AE%BE%E8%AE%A1%E5%87%BA%E5%8F%91.md)，[Vue2响应式原理解析（二）：计算属性揭秘](https://github.com/deepfunc/js-bullshit-blog/blob/master/%E6%BA%90%E7%A0%81%E8%A7%A3%E6%9E%90/Vue2%E5%93%8D%E5%BA%94%E5%BC%8F%E5%8E%9F%E7%90%86%E8%A7%A3%E6%9E%90%EF%BC%88%E4%BA%8C%EF%BC%89%EF%BC%9A%E8%AE%A1%E7%AE%97%E5%B1%9E%E6%80%A7%E6%8F%AD%E7%A7%98/Vue2%E5%93%8D%E5%BA%94%E5%BC%8F%E5%8E%9F%E7%90%86%E8%A7%A3%E6%9E%90%EF%BC%88%E4%BA%8C%EF%BC%89%EF%BC%9A%E8%AE%A1%E7%AE%97%E5%B1%9E%E6%80%A7%E6%8F%AD%E7%A7%98.md)。



## 侦听属性 watch

关于侦听属性的使用我就不多了，相信大家都很熟练，无非就是定义个函数，当要监听的值发生变化时会回调这个函数。我们直接来康康关键代码是怎么实现的。打开 `src/core/instance/state.js` 文件，找到 `initState`：

```javascript
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch) // 侦听属性的初始化是在最后。
  }
}
```

这个函数里面可以看到熟悉的 `initData` 和 `initComputed`，前面已经讲过了。 `initWatch` 就是侦听属性初始化的函数了，这里注意一下 `initWatch` 是在最后调用的并传入了 vm 对象（其实就是要监听 vm 上的属性），**这意味着侦听属性也是可以侦听到计算属性的变化哟**。`initWatch` 的内容很简单，我们只看关键的代码：

```javascript
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      // 看这里。
      createWatcher(vm, key, handler)
    }
  }
}
```

`initWatch` 遍历我们定义的 watch 对象属性，拿到每个属性的侦听函数 handler，并对其调用 `createWatcher`：

```javascript
function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }

  // 其实侦听属性最后就是用 $watch api 实现的。
  return vm.$watch(expOrFn, handler, options)
}
```

到这里我们发现原来侦听属性就是利用 vm.$watch 来实现的啦。



### vm.$watch

\$watch 函数是可以在 Vue 对象上调用的，所以定义在了 Vue 对象的原型上，具体在 `stateMixin` 函数中：

```javascript
export function stateMixin (Vue: Class<Component>) {
  // ...

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    // ...
    
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)

    // 立即求值
    if (options.immediate) {
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        // ...
      }
    }
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
```

这里我们看到 vm.$watch 其实是生成了 `Watcher` 对象，有这几个地方要康康：

- `expOrFn`，这里是需要监听的属性值。
- `options.user`，表明是用户定义的，watcher 更新时会调用用户定义的回调函数 cb。
- `options.immediate`，立即求值，一开始就会传递当前值到定义的侦听函数。
- `unwatchFn`，可以手动关闭监听（当然定义的侦听属性不需要这个了）。



#### expOrFn

这里我重点说一下 `expOrFn`。expOrFn 是可以支持属性表达式的，按照 Vue 文档的说法：

> 观察 Vue 实例上的一个表达式或者一个函数计算结果的变化。

也就是说可以像这样去设置：

```javascript
vm.$watch('a.b', function (newVal, oldVal) {
  // 属性 a 改变或者 a.b 改变都会触发
})

vm.$watch(
  function () {
    return this.c + this.d
  },
  function (newVal, oldVal) {
    // 属性 c 改变或者 d 改变都会触发
  }
)
```



第一种情况下 expOrFn 是表达式。在 `src/core/observer/watcher.js` 中找到 `Watcher` 的构造函数：

```javascript
// ...
if (typeof expOrFn === 'function') {
  this.getter = expOrFn
} else {
  this.getter = parsePath(expOrFn)
  // ...
}
// ...
```

我们知道 watcher.getter 要求是个函数， `parsePath` 在 `src/core/util/lang.js` 里面：

```javascript
export function parsePath (path: string): any {
  // ...
  const segments = path.split('.')
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    return obj
  }
}
```

`parsePath`返回的确实是一个函数，内容是按照表达式的路径顺序去逐步获得路径上的属性（对象）以及最后的值。这里我们回忆下 `defineReactive`，按顺序去访问表达式路径上的属性会触发属性的 `get`，这样就建立了依赖关系（路径上的所有属性都会），当涉及的属性变化时就会通知 watcher 了~ 同理第二种情况下是一个函数也是一样的。剩下的怎么去通知 watcher 更新前面第一篇已经介绍过了，这里就不多说了。



## 设计总结

到这里 Vue2 响应式的主要内容解析就完结了，我们看了很多的代码，是时候来总结一下啦。不知道大家看源码学习的目的和感受是什么，我呢主要是关注作者的设计意图和权衡侧重点，当然还有一些实现的技巧之类。第一篇我们从设计出发，最后呢当然也要从设计来总结一下从 Vue2 响应式中学到了什么。



### 可重用的模块

Vue2 响应式实现的一个很赞的地方是把这套东西独立了出来，抽象出了 `Dep` 和 `Watcher` 等关键定义，基本上如果你是 Web 应用都可以直接拿去用。这告诉我们在实现之前要多考虑重用和抽象，这样你的实现才能发挥更大的价值。



### 巧妙的双向依赖设计与实现

在观察者模式中，一般我们只会在被观察者上记录观察者列表，等到需要时去通知观察者即可。而在 Vue2 中由于使用场景下依赖关系会发生变化（依赖关系收集在求值过程中），所以采用了双向依赖的设计与实现。这告诉我们设计模式不是死的，根据你想达到的目的去做灵活调整，我觉得这是 Vue2 响应式设计非常精彩的一个地方~



### 观察者模式的角色权重

从 Vue2 的设计和实现中我们可以看到，观察者模式中被观察者（属性和 `Dep`）和观察者（`Watcher`）的角色权重是不同的，从代码量也可以感受出来。被观察者主要是实现依赖的建立和通知机制，更抽象一些；而观察者则要根据实际场景加入更多的功能设计与实现，比如 Vue 中的计算属性缓存和 expOrFn 等。这也是提醒我们在实现自己的观察者模式场景中，具体的内容应该放在哪里有个参考。



## 最后

到这里 Vue2 响应式我想哔哔的东西已经全部讲完了，希望能给大家一点参考吧，水平有限，理解和解读难免会有错漏，欢迎指出哇。最近 Vue3.0 One Piece 也正式发布了，以后偶也会持续写一些 Vue3 的相关东东，下次再见~

欢迎 star 和关注我的 JS 博客：[小声比比 JavaScript](https://github.com/deepfunc/js-bullshit-blog)