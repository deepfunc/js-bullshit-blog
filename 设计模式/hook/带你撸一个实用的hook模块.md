hook 模式在我们日常的代码中会经常用到，譬如我们会定义一系列的事件，然后在需要的时候通知这些事件的处理函数去逐个处理等等。

本质上来说 hook 模式类似与责任链模式，hook 建立了特定事件与事件处理程序之间的一对多关系，当事件需要处理时，沿着事件处理程序链条挨个执行。但不同的设计可能会有不同的处理行为，在本文中，链条靠前的处理程序有权决定是否需要交给下个处理程序接着处理还是直接返回最终结果。

> 这里遵循了开闭原则：**对扩展开放，对修改封闭。**
>
> 这意味着，在 hook 模式中，一旦有新的事件处理需求，我们只需要注册事件处理函数按照既定行为处理就好，不需要更改 hook 框架。



下面我们先来看下 hook 框架的创建方式和有哪些功能接口：

```javascript
function createHook() {
  const _hooks = {};
  
  function register(key, fn) {...}
  
  function isRegistered(key) {...}
  
  function syncExec(key, ...args) {...}
  
  function asyncExec(key, ...args) {...}
  
  function unregisterAll(key) {...}
  
  return {
    register,
    isRegistered,
    syncExec,
    asyncExec,
    unregisterAll
  };
}
```

以上就是这个 hook 框架的概况，使用时我们使用 `const hook = createHook();` 创建一个 hook 对象的实例来使用。下面我们就来逐一分析的一下每个功能的实现和使用。



## register(key, fn)

这个函数的作用就是注册事件处理——key 是事件名称字符串，fn 就是事件处理函数。这里需要注意的是 fn 需要是一个高阶函数，格式如下：

```javascript
const fn = function (next) {
  return function (...args) {
    return next({...});
    // return {...}
  }
};
```

这里注入的 next 是个函数：调用 next 即调用下个处理函数处理，如果不需要也可以直接返回处理结果，所以位置靠前的处理函数会有选择权。

回到 register 函数，实现如下：

```javascript
function register(key, fn) {
  if (!_hooks[key]) {
    _hooks[key] = [];
  }
  _hooks[key].push(fn);

  return function unregister() {
    const fns = _hooks[key];
    const idx = fns.indexOf(fn);
    fns.splice(idx, 1);
    if (fns.length === 0) {
      delete _hooks[key];
    }
  };
}
```

注册逻辑很简单，`_hooks` 是一个对象，用来记录事件名称与事件处理函数的关系，因为有多个并且要按注册顺序执行，所以每一个 key 属性是一个数组。

这里值得注意的是，register 函数返回了一个 unregister 函数——用来注销事件处理，这样做的目的是用户不用记录 fn 的引用，但后续需要注销时，保留 unregister 并在适当的时候使用他。



## isRegistered(key)

isRegistered 是用来判断某个事件是否存在对应的处理函数，内容很简单：

```javascript
function isRegistered(key) {
  return (_hooks[key] || []).length > 0;
}
```



## syncExec(key, ...args)

syncExec 是用来同步执行某个事件的处理函数链，并返回处理结果。使用示例如下：

```javascript
const hook = createHook();

// 第一个处理函数
hook.register('process-test', function (next) {
  return function (num) {
    return next(num + 1);
  };
});
// 第二个处理函数
hook.register('process-test', function (next) {
  return function (num) {
    return next(num + 2);
  };
});

const rst = hook.syncExec('process-test', 1);
// rst 的结果是 4
```

如例子所示，每一个处理函数通过 next 将自己的处理结果交给下一个处理函数，或者直接 return 最终的结果。

下面我们来看看 syncExec 的具体实现：

```javascript
function syncExec(key, ...args) {
  const fns = (_hooks[key] || []).slice();

  let idx = 0;
  const next = function (...args) {
    if (idx >= fns.length) {
      return (args.length > 1 ? args : args[0]);
    } else {
      const fn = fns[idx++].call(this, next.bind(this));
      return fn.apply(this, args);
    }
  };

  return next.apply(this, args);
}
```

首先，值得注意的是，当获取某个 key 对应的处理函数数组时用了 slice() 去拷贝，这是为了防止在执行过程中原数组发生变化。然后构造一个 next 函数注入到事件处理函数中（还记得事件处理函数是高阶函数吗？），并通过闭包记录下一个要执行的事件处理函数的索引 idx。然后通过第一个 next 的调用，整个处理链条就开始运转了。

这里有一个特殊的逻辑是返回结果的格式处理。如果 next 传递的是多个参数，那么返回结果是一个数组，包含所有的参数；如果 next 传递的是单个参数，那么返回结果就是那一个参数。



## asyncExec(key, ...args)

既然有同步执行，那我们还需要有异步执行。asyncExec 的使用示例如下：

```javascript
const hook = createHook();

hook.register('process-test', function (next) {
  return function (obj) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(next({ count: obj.count + 1 }));
      }, 100);
    });
  };
});
hook.register('process-test', function (next) {
  return function (obj) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(next({ count: obj.count + 2 }));
      }, 100);
    });
  };
});

hook.asyncExec('process-test', { count: 66 }).then(rst => {
  console.log(rst);
  // rst === 69
});
```

当事件处理函数需要异步执行时，我们可以调用 asyncExec 来处理，而且事件处理函数中就算返回的是同步结果，比如上面的第一个处理函数执行返回 `return next({ count: obj.count + 1 });` 也是可以的。

下面我们来看看 asyncExec 是如何实现的：

```javascript
function asyncExec(key, ...args) {
  const fns = (_hooks[key] || []).slice();
  let idx = 0;

  const next = function (...args) {
    if (idx >= fns.length) {
      return Promise.resolve(args.length > 1 ? args : args[0]);
    } else {
      try {
        const fn = fns[idx++].call(this, next.bind(this));
        const rst = fn.apply(this, args);
        return Promise.resolve(rst);
      } catch (err) {
        return Promise.reject(err);
      }
    }
  };

  return next.apply(this, args);
}
```

这里的核心思想就是 resolve 的参数如果是 Promise，那么原 Promise 的状态由里层的 Promise 决定，不熟悉的童鞋可以复习下 Promise 哈。这里还有个需要注意的地方是，处理了当事件处理函数执行时抛出的异常。然后对于返回结果的处理也是与 syncExec 同样的逻辑。



## unregisterAll(key)

最后的 unregisterAll 就很简单了，注销掉某个事件上的所有处理函数：

```javascript
function unregisterAll(key) {
  delete _hooks[key];
}
```



## 总结

以上就是 hook 模块的整个解析，源码在 [这里](hook.js)。更详细的使用案例请参考 [单元测试](test/hook.test.js)。



我想有些童鞋可能会问：“为什么不把 Hook 写成一个 Class，然后业务系统去继承 hook 来使用，这样不就可以把 Hook 功能继承到业务对象里面了吗？”。

这里主要是考虑到遵循另一个设计原则：**多用组合，少用继承**。有时候使用组合方式具备更大的弹性，所以如果我们想把 hook 继承到自己的业务对象里面，简单点可以像下面这样做：

```javascript
const app = {...};
const hook = createHook();

// mixin
Object.assign(app, hook);
```



如果对本篇有疑问或建议，欢迎在 [这里](https://github.com/deepfunc/js-bullshit-blog/issues/5) 提出。

欢迎 star 和关注我的 JS 博客：[小声比比 Javascript](https://github.com/deepfunc/js-bullshit-blog)