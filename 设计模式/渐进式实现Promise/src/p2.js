function isPromise(value) {
  return value && typeof value.then === 'function';
}

function Promise(exector) {
  this.pending = [];
  this.value = undefined;

  const resolve = value => {
    if (this.pending) {
      this.value = wrapToThenable(value);
      for (const onFulfilled of this.pending) {
        this.value.then(onFulfilled);
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
      prev.value.then(onSpreadFulfilled);
    }
  });

  return promise;
};

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
