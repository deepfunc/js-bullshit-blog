# TypeScript of Redux 心得体会

Redux 是一个非常经典的状态管理库，在 2019 年接近年底的时候这个项目用 TypeScript 重写了。网上有很多分析 Redux JavaScript 代码实现的文章，然而 TypeScript 部分的却很少。我在看重写的 TypeScript 代码时发现有很多地方比较有意思，也启发我提炼了一些东西，所以整理成了这篇博客，欢迎一起来讨论和学习。

本文内容分成两个部分，第一部分是关于 Redux 中类型定义和推导的技巧，这部分完全是 TypeScript 代码和相关概念，如果不熟悉 TypeScript 的话基本是没法看，可以找官方文档补课后再来；第二部分是我提炼的一些个人心得，包括我理解的 Redux 设计思路，我们从中怎么学习和应用等等，这部分只要知道函数式编程思想就好了。



## Types

Redux 把所有的类型定义都放在 types 文件夹中。主要描述了 Redux 中的抽象定义，比如什么是 `Action` 和 `Reducer`；还有一部分是推导类型，比如：`ActionFromReducer`、`StateFromReducersMapObject` 等等。

我列了几个比较有意思的来一起康康。



### ReducerFromReducersMapObject

```typescript
export type ReducerFromReducersMapObject<M> = M extends {
  [P in keyof M]: infer R
}
  ? R extends Reducer<any, any>
    ? R
    : never
  : never
```

这个推导类型的目的是从 `ReducersMapObject` 中推导出 `Reducer` 的类型。这里有个知识点：在映射类型中，`infer` 会推导出联合类型。请看下面的例子：

```typescript
export type ValueType<M> = M extends {
  [P in keyof M]: infer R
}
  ? R
  : never

type Person = {
  name: string;
  age: number;
  address: string;
}

type T1 = ValueType<Person>; // T1 = string | number
```



### ExtendState

```typescript
export type ExtendState<State, Extension> = [Extension] extends [never]
  ? State
  : State & Extension
```

这个类型是用来推导扩展 State 的。如果没有扩展，就返回 State 本身，否则返回 State 和 Extension 的交叉类型。这里比较奇怪的是为什么判断 `never` 要用 `[Extension] extends [never]` 而不是 `Extension extends never` 呢？



代码注释中很贴心的有一个此问题的讨论链接：https://github.com/microsoft/TypeScript/issues/31751#issuecomment-498526919。大概意思是有人写了个推导类型，但是行为不符合期望所以提了个 issue：

```typescript
type MakesSense = never extends never ? 'yes' : 'no' // Resolves to 'yes'

type ExtendsNever<T> = T extends never ? 'yes' : 'no'

type MakesSenseToo = ExtendsNever<{}> // Resolves to 'no'
type Huh = ExtendsNever<never>
// Expect to resolve to 'yes', actually resolves to never 
```

我们注意到他用了 `Extension extends never`。但当泛型参数传入 `never` 时，结果不是 `yes` 而是 `never`！

下面有人给出了答案：

> This is the expected behavior, `ExtendsNever` is a distributive conditional type. Conditional types distribute over unions. Basically if `T` is a union `ExtendsNever` is applied to each member of the union and the result is the union of all applications (`ExtendsNever<'a' | 'b'> == ExtendsNever<'a' > | ExtendsNever<'b'>`). `never` is the empty union (ie a union with no members). This is hinted at by its behavior in a union `'a' | never == 'a'`. So when distributing over `never`, `ExtendsNever` is never applied, since there are no members in this union and thus the result is never.
>
> If you disable distribution for `ExtendsNever`, you get the behavior you expect:
>
> ```typescript
> type MakesSense = never extends never ? 'yes' : 'no' // Resolves to 'yes'
> 
> type ExtendsNever<T> = [T] extends [never] ? 'yes' : 'no'
> 
> type MakesSenseToo = ExtendsNever<{}> // Resolves to 'no'
> type Huh = ExtendsNever<never> // is yes 
> ```
>
> 

我结合官方文档来说一下为什么这个行为是符合预期的。因为 `ExtendsNever` 在这里是分发的条件类型：[Distributive conditional types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html#distributive-conditional-types)。分发的条件类型在实例化时会自动分发成联合类型。 例如，实例化 `T extends U ? X : Y`，`T` 的类型为 `A | B | C`，会被解析为 `(A extends U ? X : Y) | (B extends U ? X : Y) | (C extends U ? X : Y)`。

而当实例化的泛型为 `never` 时，`ExtendsNever` 不会执行，因为联合类型是 `never` 相当于没有联合类型成员，所以上面的结果是根本不会进入条件判断而直接返回 `never`。所以要解决这个问题需要的就是打破分发的条件类型，使其不要分发。

官方文档上写了分发的条件类型的触发条件：如果待检查的类型是`naked type parameter`。那什么是 `naked type` 呢？简单点来说就是没有被其他类型包裹的类型，其他类型包括：数组、元组、或其他泛型等。这里我也找了一个 [stack overflow](https://stackoverflow.com/questions/51651499/typescript-what-is-a-naked-type-parameter) 上面的解答大家可以参考一下。



看到这里问题就迎刃而解了：`[Extension] extends [never]` 把 `never` 包裹成元组就是为了打破分发的条件类型以实现正确地判断是否 `never`。



### CombinedState

```typescript
declare const $CombinedState: unique symbol

export type CombinedState<S> = { readonly [$CombinedState]?: undefined } & S
```



这个类型是用来区分 State 是否由 `combineReducers` 创建的，`combineReducers` 函数会返回这个类型。我们知道 TypeScript 的对象类型兼容是结构子类型，也就是说只要对象的结构满足就好了。而 `combineReducers` 构造的 State 又需要与普通的 State 对象区分开来，这个时候就需要一个标识的属性来检查不同——`$CombinedState`。

首先注意到的是，`$CombinedState` 是一个 `unique symbol`，这说明这个 symbol 的类型是唯一的，TypeScript 可以追踪和识别它的类型；然后我们看到 `$CombinedState` 是 `declare` 出来的并且没有导出，这表明 `$CombinedState` 只用来做类型定义用的（不需要实现）并且不能被外部的类型伪造。

接着看下面 `CombinedState<S>` 里面的 `{ readonly [$CombinedState]?: undefined }` 部分。`[$CombinedState]` 属性是可选的并且类型是 `undefined` 而且不能被赋值修改，这就说明这个对象里面啥也没有嘛。然后与 `S` 做交叉，保持了看起来与 `S` 的“结构一样”（`S` 类型的变量可以赋值给 `CombinedState<S>` 类型的变量），但又被完美地从结构类型上区分开了，这个玩法有点高级！

来看下面的测试好好体会一下：

```typescript
type T1 = {
  a: number;
  b: string;
}

declare const $CombinedState: unique symbol;

type T2<T> = { readonly [$CombinedState]?: undefined } & T;

type T3<T> = {} & T;

type T4<T> = Required<T> extends {
  [$CombinedState]: undefined
} ? 'yes' : 'no';

type S1 = T2<T1>;
// type S1 = { readonly [$CombinedState]?: undefined; } & T1;
type S2 = T4<S1>;
// type S2 = "yes";
type S3 = T3<T1>;
// type S3 = T1;
type S4 = T4<S3>;
// type S4 = "no";

let s: S1 = { a: 1, b: '2' };
```



### PreloadedState

```typescript
export type PreloadedState<S> = Required<S> extends {
  [$CombinedState]: undefined
}
  ? S extends CombinedState<infer S1>
    ? {
        [K in keyof S1]?: S1[K] extends object ? PreloadedState<S1[K]> : S1[K]
      }
    : never
  : {
      [K in keyof S]: S[K] extends string | number | boolean | symbol
        ? S[K]
        : PreloadedState<S[K]>
    }
```

`PreloadedState` 是调用 `createStore` 时 State 预设值的类型，只有 Combined State 的属性值才是可选的。类型的推导方案借助了上面的 `CombinedState` 来完成，并且是一个递归的推导。这里我有个疑问是为什么判断是否原始类型 primitive 的方式上下不一致？



以上是我觉得 Redux 类型定义中比较有意思的地方，其他的类型定义内容应该比较好理解大家可以多康康，如果有疑问也可以提出来一起讨论。

接着是第二部分的内容，我个人对于 Redux 设计思想与实现的心得理解，还有一些观点和建议。



## Redux 好在哪里？

说起来我用 Redux 已经很久了。2016 年决定把主要精力放在前端时是学习的 React，接触的第一个状态管理框架就是 Redux，并且现在公司的前端业务层也是围绕着 Redux 技术栈打造的。我很早就看过 Redux 的 JavaScript 代码，加上 TypeScript 的代码部分可以说我对 Redux 已经很熟悉了，所以这次决定要好好总结一下。



### Redux 是函数式编程的经典模板

我认为 Redux 具有非常学院派的函数式编程思想，如果你想编写一个功能库给别人使用，完全可以使用 Redux 的思想当做模板来应用。为什么我会这么说呢，来看下以下几点。



#### 隐藏数据

思考一个问题：为何 Redux 不用 `Class` 来实现，是编写习惯吗？

由于 JavaScript 目前的语言特性，`Class` 产生的对象无法直接隐藏数据属性，在运行时健壮性有缺陷。仔细看看 Redux 的实现方式：`createStore` 函数返回一个对象，在 `createStore` 函数内部存放数据变量，返回的对象只暴露了方法，这就是典型的**利用闭包隐藏数据**，是我们常用的函数式编程思想之一。



#### 抽象行为

在设计一个给别人使用的功能库时，我们首先要考虑的问题是什么？我认为是**能提供什么样的功能，换句话说就是功能库的行为是怎样的**。我们来看看 Redux 是怎么考虑这个问题的，在 `types\store.ts` 中有一个 `Store` 接口（我把注释都去掉了）：

```typescript
export interface Store<
  S = any,
  A extends Action = AnyAction,
  StateExt = never,
  Ext = {}
> {
  dispatch: Dispatch<A>
  getState(): S
  subscribe(listener: () => void): Unsubscribe
  replaceReducer<NewState, NewActions extends Action>(
    nextReducer: Reducer<NewState, NewActions>
  ): Store<ExtendState<NewState, StateExt>, NewActions, StateExt, Ext> & Ext
  [Symbol.observable](): Observable<S>
}
```

 这个接口定义就是 `createStore` 返回的对象类型定义。从定义可以看出这个对象提供了几个方法，这就是 Redux 提供给用户使用的主要行为了。

**行为是一种契约，用户将按照你给出的行为来使用你提供的功能**。在函数式编程中，函数就是行为，所以我们要重点关注行为的设计。并且行为的变更一般来说代价很大，会造成不兼容，所以在函数式编程中我们一定要学习如何去抽象行为。



#### 如何扩展？

Redux 是如何扩展功能的 :thinking:，​我们可能会联想到 Redux middleware。但是你仔细想想，中间件的设计就代表了 Redux 的功能扩展吗？



##### Redux 中间件的本质

直接说结论：中间件扩展的是 `dispatch` 的行为，不是 Redux 本身。为了解决 `action` 在派送过程中的异步、特殊业务处理等各种场景需求，Redux 设计了中间件模式。但中间件仅代表这个特殊场景的扩展需求，这个需求是高频的，所以 Redux 专门实现了这个模式。



##### Redux 扩展：StoreEnhancer

在 `types\store.ts` 中有一个 `StoreEnhancer` 的定义，这个才是 Redux 扩展的设计思路：

```typescript
export type StoreEnhancer<Ext = {}, StateExt = never> = (
  next: StoreEnhancerStoreCreator<Ext, StateExt>
) => StoreEnhancerStoreCreator<Ext, StateExt>

export type StoreEnhancerStoreCreator<Ext = {}, StateExt = never> = <
  S = any,
  A extends Action = AnyAction
>(
  reducer: Reducer<S, A>,
  preloadedState?: PreloadedState<S>
) => Store<ExtendState<S, StateExt>, A, StateExt, Ext> & Ext
```

不难看出 `StoreEnhancer` 是一个高阶函数，通过传入原来的 `createStore` 函数而返回一个新的 `createStore` 函数来实现扩展。`Store & Ext` 在保留原有行为的基础上实现了扩展，所以**高阶函数是常用的扩展功能的方式**。对于使用者来说， 编写扩展时也要遵守 [里氏替换原则](https://zh.wikipedia.org/wiki/%E9%87%8C%E6%B0%8F%E6%9B%BF%E6%8D%A2%E5%8E%9F%E5%88%99)。



### “订阅/发布”中的小细节

```typescript
let currentListeners: (() => void)[] | null = []
let nextListeners = currentListeners

/**
  * This makes a shallow copy of currentListeners so we can use
  * nextListeners as a temporary list while dispatching.
  */
function ensureCanMutateNextListeners() {
  if (nextListeners === currentListeners) {
    nextListeners = currentListeners.slice()
  }
}

function subscribe(listener: () => void) {
  // ...
  ensureCanMutateNextListeners()
  nextListeners.push(listener)
  
  return function unsubscribe() {
    // ...
    ensureCanMutateNextListeners()
    const index = nextListeners.indexOf(listener)
    nextListeners.splice(index, 1)
    currentListeners = null
  }
}

function dispatch(action: A) {
  // ...
  try {
    isDispatching = true
    currentState = currentReducer(currentState, action)
  } finally {
    isDispatching = false
  }

  const listeners = (currentListeners = nextListeners)
  for (let i = 0; i < listeners.length; i++) {
    const listener = listeners[i]
    listener()
  }

  return action
}
```

以上就是 Redux“订阅/发布”的关键代码了，我说两点可以借鉴学习的地方。

1. 从 `subscribe` 中返回 `unsubscribe`

   原来我刚开始写“订阅/发布”模式时，会把“取消订阅”写成一个独立的函数 囧。把 `subscrible` 写成一个高阶函数，返回 `unsubscribe`，这样对于使用者来说可以更方便地使用匿名函数来接收通知。

2. 稳定的发布链

   `currentListeners` 和 `nextListeners` 可以保证在发布时通知是稳定的。因为可能在发布通知期间有新的订阅者或者退订的情况，那么在这种情况下这一次的发布过程是稳定的不会受影响，变化始终在 `nextListeners` 。



## 总结

当我们去看源码学习一个项目时，不要只看一次就完了。应隔一段时间去重温一下，从不同维度、不同视角去观察，多想想，多问几个为什么:question:，提炼出自己的心得，那就真的是学到了。

欢迎 star 和关注我的 JS 博客：[小声比比 JavaScript](https://github.com/deepfunc/js-bullshit-blog)