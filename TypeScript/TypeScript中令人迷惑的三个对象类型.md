`Object`、`{}` 和 `object`，这三个表示对象的类型很容易让人迷惑，下面来总结一下它们的联系和差异。

## Object

`Object` 是 `Object.prototype` 的接口定义。源码中定义如下：

```typescript
interface Object {
  constructor: Function;
  toString(): string;
  toLocaleString(): string;
  valueOf(): Object;
  hasOwnProperty(v: PropertyKey): boolean;
  isPrototypeOf(v: Object): boolean;
  propertyIsEnumerable(v: PropertyKey): boolean;
}
```

JS 中所有对象的原型链缺省都继承自 `Object.prototype`，原始值有包装类型。所以原始值、对象和函数都可以赋值给 `Object` 类型。

## {}

在 JS 中 `{}` 表示没有自身属性的字面量对象。但在 TS 中，`{}` 类型表示对象类型，意味着原始值、对象和函数都可以赋值给 `{}` 类型,这一点与 `Object` 是一致的。但是这两种类型是有区别的，赋值给 `Object` 类型的对象必须严格满足 `Object.prototype` 接口定义，而赋值给 `{}` 类型则无此限制。如下：

```typescript
// Type '() => number' is not assignable to type '() => string'.
// Object.prototype.toString() 要求返回 string 类型。
let a: Object = {
  toString() {
    return 1;
  }
};

let b: {} = {
  toString() {
    return 1;
  }
};
```

## object

为表示非原始值类型的对象，[TypeScript 2.2](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html#object-type) 中引入了 `object` 类型。除了 `number`、`string`、`boolean`、`symbol`、`null` 和 `undefined`， 其他所有类型都可以赋值给 `object` 类型。所以按照 TS 的建议，当我们需要表示对象时，用 `object` 就好。

> `object` is not `Object`. **Always** use `object`!



