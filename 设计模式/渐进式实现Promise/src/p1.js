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
  const prev = this;

  const promise = new Promise(resolve => {
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
