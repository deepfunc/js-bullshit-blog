function Promise(exector) {
  this.pending = [];
  this.value = undefined;

  const resolve = value => {
    if (this.pending) {
      this.value = value;
      for (const onFulfilled of this.pending) {
        onFulfilled(this.value);
      }
      this.pending = undefined;
    }
  };

  exector(resolve);
}

Promise.prototype.then = function (onFulfilled) {
  if (this.pending) {
    this.pending.push(onFulfilled);
  } else {
    onFulfilled(this.value);
  }
};
