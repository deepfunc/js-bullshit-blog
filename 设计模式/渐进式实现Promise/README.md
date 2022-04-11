最近重温了一下 [Q/Promise](https://github.com/kriskowal/q/blob/master/design/README.md) 的设计讲解，结合自己的理解和一些小优化，决定也来写一篇手写 Promise 的文章。本文的内容适合对 Promise 的使用有一定了解的童鞋，因为过程中不会过多解释 Promise 的基础操作。我们从一个基础版本开始，渐进式地完成这个 Promise，在过程中分享我的理解和观点。内容可能有点长，废话不多说，我们开始吧。

## 基础版本

我们先以**观察者模式**作为基石来搭建一个基础版本，实现的功能如下：

1. 构造函数接受一个函数 `exector` 作为参数，该函数的第一个参数是 `resolve`，作用是把 Promise 对象的状态变为“成功”。
2. 原型方法 `then` 是用来注册一个当状态变为成功的回调函数，当回调触发时，参数是 `resolve` 时的决议值。

```javascript
function Promise(exector) {
  this.pending = [];
  this.value = undefined;

  const resolve = value => {
    if (this.pending) {
      this.value = value;
      for (const onFulfilled of this.pending) {
        // 通知观察者。
        onFulfilled(this.value);
      }
      this.pending = undefined;
    }
  };

  exector(resolve);
}

Promise.prototype.then = function (onFulfilled) {
  if (this.pending) {
    // 还没决议，先注册观察者。
    this.pending.push(onFulfilled);
  } else {
    // 已决议，直接通知。
    onFulfilled(this.value);
  }
};

// 测试一下。
const p = new Promise(resolve => {
  setTimeout(() => resolve(666), 100);
})

p.then(res => console.log('res: %s', res));

// 输出：
// res: 666
```

代码很简单，应该不用过多解释，上面的完整代码在这里：[p0.js](src/p0.js)。

这个基础版本有个明显的问题： `then`  不能进行链式调用，接着就来优化一下。

## `then` 链式调用

then 的链式调用会返回一个新的 Promise，并且 `then` 中回调的返回值会使这个新的 Promise 决议为“成功”状态。

```javascript
Promise.prototype.then = function (onFulfilled) {
  // “当前” Promise，对于返回的新 Promise 而言，也是“前一个” Promise。
  const prev = this;

  const promise = new Promise(resolve => {
    // 包装 onFulfilled，使其可以“传播”决议；
    // “前一个” Promise 决议后，决议返回的这个新 Promise。
    const onSpreadFulfilled = function (value) {
      resolve(onFulfilled(value));
    };

    if (prev.pending) {
      prev.pending.push(onSpreadFulfilled);
    } else {
      onSpreadFulfilled(prev.value);
    }
  });

  return promise;
};

// 测试一下。
const p = new Promise(resolve => {
  setTimeout(() => resolve(666), 100);
});

p.then(res => {
  console.log('res1: %s', res);
  return res + 1;
).then(res => {
  console.log('res2: %s', res);
);
  
// 输出：
// res1: 666
// res2: 667
```

实现链式调用的关键是如何决议返回的新 Promise？这里我对变量做了一些有含义的命名，方便理解：

1. `prev` 是调用 `then` 时“当前”的 Promise，对于返回的新 Promise 而言，可以看做是“前一个”Promise。
2. 包装 onFulfilled——执行完当前注册的 onFulfilled 后，用其返回值来决议返回的那个新的 Promise。这是个关键步骤，为体现传播的动作，将其命名为 `onSpreadFulfilled`。
3. 将 `onSpreadFulfilled` 作为成功的回调注册到 `prev` 上。

上面的完整代码在这里：[p1.js](src/p1.js)。

现在又有个新问题，如果 `resolve` 的 `value` 是个 Promise，或者 `onfulfilled` 函数返回的结果是个 Promise，那么链式传播的决议值不应该是这个 Promise 本身，而是这个 Promise 的决议值才对，也就是要**支持 Promise 的状态传递**。

## 状态传递

在实现状态传递之前，我们先来康康如何确定一个值是不是 Promise。我们可以用原型继承来判断：

```javascript
return value instanceof Promise;
```

这样的缺点是兼容性较差，你无法强制使用者的运行环境上下文中只会用一种 Promise 的库，或者在不同的运行上下文中传递 Promise 实例。所以这里我们使用 [鸭子类型](https://zh.wikipedia.org/wiki/%E9%B8%AD%E5%AD%90%E7%B1%BB%E5%9E%8B) 来判断 Promise，**重点关注对象的行为**，将 Promise 看作是一个 `thenable` 对象。

```javascript
function isPromise(value) {
  // 如果这个对象上可以调用 then 方法，就认为它是一个“Promise”了。
  return value && typeof value.then === 'function';
}
```

接下来就来实现状态传递了，实现的思路就是基于鸭子类型和“通知转移”。我们先定义一个函数：

```javascript
function wrapToThenable(value) {
  if (isPromise(value)) {
    return value;
  } else {
    return {
      then: function (onFulfilled) {
        return wrapToThenable(onFulfilled(value));
      }
    };
  }
}
```

顾名思义，这个函数的作用是用来把一个值包装为 `thenable` 对象：如果 value 是 Promise 则直接返回；如果不是就包装并返回一个有 `then` 方法的对象，也就是 `thenable` 对象。这个 `thenable` 对象的作用是啥呢？接着看这里：

```javascript
function Promise(exector) {
  this.pending = [];
  this.value = undefined;

  const resolve = value => {
    if (this.pending) {
      // 包装为 thenable。
      this.value = wrapToThenable(value);
      for (const onFulfilled of this.pending) {
        // 通知时改为调用 thenable 上的 then。
        this.value.then(onFulfilled);
      }
      this.pending = undefined;
    }
  };

  exector(resolve);
}
```

`resolve` 决议时，根据 `value` 的类型不同，有两种处理情况：

1. 如果 `value` 是普通值，经过 `wrapToThenable` 会包装为 `thenable` 对象，通知时调用 `then` 方法相当于直接调用 `onFulfilled`。
2. 如果 `value` 是 Promise，则把 `onFulfilled` 注册到 `value` 上；等到 `value` 决议时，就会调用 `onFulfilled`。还记得链式调用时的 `onSpreadFulfilled` 吗？ 这里就是“通知转移”了，把通知下一个 Promise 的责任转移到了 `value` 身上。

当然 `then` 也要做一点修改：

```javascript
Promise.prototype.then = function (onFulfilled) {
  const prev = this;

  const promise = new Promise(resolve => {
    const onSpreadFulfilled = function (value) {
      resolve(onFulfilled(value));
    };

    if (prev.pending) {
      prev.pending.push(onSpreadFulfilled);
    } else {
      // 这里也要改为调用 then。
      prev.value.then(onSpreadFulfilled);
    }
  });

  return promise;
};

// 测试一下。
const p = new Promise(resolve => {
  setTimeout(() => resolve(666), 100);
});

p.then(res => {
  console.log('res1: %s', res);
  return new Promise(resolve => {
    setTimeout(() => resolve(777), 100);
  });
}).then(res => {
  console.log('res2: %s', res);
});

// 输出：
// res1: 666
// res2: 777
```

这里来总结一下状态传递的设计思路。包装为 `thenable` 对象非常关键，作用是保持了与 Promise 一致的行为，也就是接口一致。这样在 `resolve` 时我们不用特定去判断这个值是不是 Promise，而可以用统一的处理方式来通知观察者；并且也顺便完成了“通知转移”，如果 `value` 还没有决议，则 `then` 会注册为回调，如果已决议则 `then` 会立即执行。

上面的完整代码在这里：[p2.js](src/p2.js)。接下来，我们来完善一下 `reject`。

## 失败状态

当 Promise 决议失败时，`then` 方法里面将只执行第二个参数 `onRejected` 对应的回调。首先我们需要另一个包装函数：

```javascript
function wrapToRejected(value) {
  return {
    then: function (_, onRejected) {
      return wrapToThenable(onRejected(value));
    }
  };
}
```

这个函数的作用是一旦发生 `reject(value)` 时，我们把 value 变为另一种 `thenable` 对象，这个对象在执行 `then` 时只会调用 `onRejected`。

然后改变一下构造函数：

```javascript
function Promise(exector) {
  // pending 变为一个二维数组，里面存放的元素是 [onFulfilled, onRejected]。
  this.pending = [];
  this.value = undefined;

  const resolve = value => {
    if (this.pending) {
      this.value = wrapToThenable(value);
      for (const handlers of this.pending) {
        this.value.then.apply(this.value, handlers);
      }
      this.pending = undefined;
    }
  };

  const reject = value => {
    resolve(wrapToRejected(value));
  };

  exector(resolve, reject);
}
```

现在有一个比较大的变化：`this.pending` 变为了二维数组。这样 `this.value.then.apply` 在执行时会有三种情况：

1. this.value 是成功决议转换来的 `thenable` 对象，还记得 `wrapToThenable` 吗？`then` 被执行时只会调用 `onFulfilled`。
2. this.value 是失败决议转换来的 `thenable` 对象，`then` 被执行时只会调用 `onRejected`。
3. this.value 是一个 Promise，决议会转移到这个 Promise 上。

同样 `then` 方法也要做一些修改：

```javascript
Promise.prototype.then = function (onFulfilled, onRejected) {
  const prev = this;
  
  // 注意这里给了 onFulfilled、onRejected 默认值。
  onFulfilled =
    onFulfilled ||
    function (value) {
      return value;
    };
  onRejected =
    onRejected ||
    function (value) {
      return wrapToRejected(value);
    };

  const promise = new Promise(resolve => {
    const onSpreadFulfilled = function (value) {
      resolve(onFulfilled(value));
    };
    const onSpreadRejected = function (value) {
      resolve(onRejected(value));
    };

    if (prev.pending) {
      prev.pending.push([onSpreadFulfilled, onSpreadRejected]);
    } else {
      prev.value.then(onSpreadFulfilled, onSpreadRejected);
    }
  });

  return promise;
};

// 测试一下。
const p = new Promise((resolve, reject) => {
  setTimeout(() => reject(666), 100);
});

p.then(undefined, err => {
  console.log('err1: %s', err);
  return 1;
}).then(res => {
  console.log('res1: %s', res);
});

// 输出：
// err1: 666
// res1: 1
```

我们要特别注意一下增加了 `onFulfilled`、`onRejected` 的默认值。在实际使用 `then` 时，可能只会专注处理成功或者失败的回调，但是我们又需要另外一种状态要继续传播下去。这里可能有点不好理解，可以代入数据模拟一下。上面的完整代码在这里：[p3.js](src/p3.js)。

又到了思考总结时间，`thenable` 这个接口是关键所在。通过两个包装对象，分别处理成功和失败的状态，在通知观察者时可以保持统一的逻辑，这个设计是不是感觉很妙呢？

接下来我们要处理一下调用时会产生异常的问题。

## 异常处理

我们先思考一下会有哪些地方会产生异常？第一个是构造函数里面 `exector` 执行的时候：

```javascript
function Promise(exector) {
  this.pending = [];
  this.value = undefined;

  const resolve = value => {
    // ...
  };

  const reject = value => {
    resolve(wrapToRejected(value));
  };

  try {
    exector(resolve, reject);
  } catch (e) {
    // 如果有异常产生，状态变为“失败”。
    reject(e);
  }
}
```

然后是`onFulfilled` 和 `onRejected` 执行的时候。当在以上两个方法里产生异常时，状态要变为失败，并且需要把异常传播下去。`then` 的改动如下：

```javascript
Promise.prototype.then = function (onFulfilled, onRejected) {
  // ...
  // 产生异常的时候包装一下。
  const errHandler = returnWhenError(err => wrapToRejected(err));
  onFulfilled = errHandler(onFulfilled);
  onRejected = errHandler(onRejected);

  const promise = new Promise(resolve => {
    const onSpreadFulfilled = function (value) {
      resolve(onFulfilled(value));
    };
    const onSpreadRejected = function (value) {
      resolve(onRejected(value));
    };

    if (prev.pending) {
      prev.pending.push([onSpreadFulfilled, onSpreadRejected]);
    } else {
      prev.value.then(onSpreadFulfilled, onSpreadRejected);
    }
  });

  return promise;
};

// 封装为一个可重用的高阶函数。
// 如果 fun 执行失败了，则返回 onError 的结果。
function returnWhenError(onError) {
  return fun =>
    (...args) => {
      let result;

      try {
        result = fun(...args);
      } catch (e) {
        result = onError(e);
      }

      return result;
    };
}
```

然后我们可以加入 `catch` 方法：

```javascript
Promise.prototype.catch = function (onRejected) {
  // 在 then 中忽略掉“成功”状态的回调。
  return Promise.prototype.then.call(this, undefined, onRejected);
};

// 测试一下。
const p = new Promise(resolve => {
  setTimeout(() => resolve(666), 100);
});

p.then(res => {
  console.log('res1: %s', res);
  throw new Error('test error1');
}).then(undefined, err => {
  console.log('err1: %s', err.message);
  throw new Error('test error2');
}).catch(err => {
  console.log('err2: %s', err.message);
});

// 输出：
// res1: 666
// err1: test error1
// err2: test error2
```

上面的完整代码在这里：[p4.js](src/p4.js)。

到了这里，基本上 Promise 的基本功能就差不多完成了。不过还有一些不太完善的地方，我们来继续做一些优化。

## 一些优化

### 封装私有变量

`this.pending` 和 `this.value` 从外部是可以读写的，不够安全和健壮。而我又还是想用构造函数和原型方法，不想用闭包来封装。我这里采用的是 [WeakMap](https://es6.ruanyifeng.com/#docs/set-map#WeakMap) 来达到目的，关键的修改如下：

```javascript
const refMap = new WeakMap();

// ...

function Promise(exector) {
  // 用当前的实例引用作为 key，把想隐藏的数据放进一个对象里。
  refMap.set(this, {
    pending: [],
    value: undefined
  });

  const resolve = value => {
    // 取出封装的数据。
    const data = refMap.get(this);

    if (data.pending) {
      data.value = wrapToThenable(value);
      for (const handlers of data.pending) {
        data.value.then.apply(data.value, handlers);
      }
      data.pending = undefined;
    }
  };

  // ...
}
```

同样 `then` 也修改一下：

```javascript
Promise.prototype.then = function (onFulfilled, onRejected) {
  // ...

  const promise = new Promise(resolve => {
    const onSpreadFulfilled = function (value) {
      resolve(onFulfilled(value));
    };
    const onSpreadRejected = function (value) {
      resolve(onRejected(value));
    };
    // 取出封装的数据。
    const data = refMap.get(prev);

    if (data.pending) {
      data.pending.push([onSpreadFulfilled, onSpreadRejected]);
    } else {
      data.value.then(onSpreadFulfilled, onSpreadRejected);
    }
  });

  return promise;
};
```

上面的完整代码在这里：[p5.js](src/p5.js)。

当 Promise 实例被垃圾回收时，对应在 WeakMap 中的私有数据对象引用也会被消除，没有内存泄漏问题，这种方案非常适合用来封装私有变量。

### 调用顺序

目前的 Promise 在执行时有调用顺序问题，比如：

```javascript
const p = new Promise(resolve => resolve(1));

p.then(res => {
  console.log('res1:', res);
  return res + 1;
}).then(res => {
  console.log('res2:', res);
});

p.then(res => {
  console.log('res3:', res);
});

console.log('Hi!');

// 目前的输出是：
// res1: 1
// res2: 2
// res3: 1
// Hi!

// 正确的输出应该是：
// Hi!
// res1: 1
// res3: 1
// res2: 2
```

一个简单的做法是利用 `setTimeout` 来改进：

```javascript
function Promise(exector) {
  // ...
  
  const resolve = value => {
    const data = refMap.get(this);

    if (data.pending) {
      data.value = wrapToThenable(value);
      for (const handlers of data.pending) {
        // 延迟执行。
        enqueue(() => {
          data.value.then.apply(data.value, handlers);
        });
      }
      data.pending = undefined;
    }
  };
  
  // ...
}

Promise.prototype.then = function (onFulfilled, onRejected) {
  // ...

  const promise = new Promise(resolve => {
    // ...

    if (data.pending) {
      data.pending.push([onSpreadFulfilled, onSpreadRejected]);
    } else {
      // 延迟执行。
      enqueue(() => {
        data.value.then(onSpreadFulfilled, onSpreadRejected);
      });
    }
  });

  return promise;
};

function enqueue(callback) {
  setTimeout(callback, 1);
}
```

`enqueue` 的作用是模拟按入队顺序来延迟执行函数。通过对所有 `then` 调用的延迟执行，可以保证按正确的注册顺序和决议顺序来执行代码了。

## 接下来呢？

咳咳，到了这里我觉得就先差不多了，毕竟此文的目的是分享和交流一种 Promise 的设计思路和心得，而不是去造一个完美的 Promise。手写一个 Promise 这个结果不应该是我们的目的，观察演进过程中的思路和方案才是我们需要吸收的东西。后面有时间我会把缺少的一些接口也补上，比如 `Promise.resolve`、`Promise.prototype.finally` 等等。

最后，希望你也能从这篇文章中收获一些东西吧，欢迎 star 和关注我的 JavaScript 博客：[小声比比 JavaScript](https://github.com/deepfunc/js-bullshit-blog)