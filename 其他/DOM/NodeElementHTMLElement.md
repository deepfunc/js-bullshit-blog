DOM 模型是用一个节点树来描述 HTML/XML/SVG 文档的结构。其中节点的类型有 Node，Element 和 HTMLElement，那么这三种类型有什么区别和联系呢？

首先从继承关系来看：Node <- Element <- HTMLElement，这说明每个 Element 和 HTMLElement 都是一个 Node。然后 Node 有很多种类型，比如：

- Node.ELEMENT_NODE
- Node.TEXT_NODE
- Node.COMMENT_NODE
- ……

其中 `TEXT_NODE` 是文本节点，`COMMENT_NODE` 是注释节点，`ELEMENT_NODE` 就是元素节点，所以当 node.nodeType === Node.ELEMENT_NODE 时，就代表这个节点是 Element，比如 `<p>`、`<div>`。

那 HTMLElement 和 Element 有什么区别呢？HTMLElement 代表 HTML 中的元素，如：`<span>`、`<img>` 等，而有些元素并不是 HTML 标准的，比如 `<svg>`。可以用下面的方法来判断这个元素是不是 HTMLElement：

```javascript
document.getElementById('myIMG') instanceof HTMLElement;
```



