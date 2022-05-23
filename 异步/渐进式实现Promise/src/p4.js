function isPromise(value) {
  return value && typeof value.then === 'function';
}

function Promise(exector) {
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

  try {
    exector(resolve, reject);
  } catch (e) {
    reject(e);
  }
}

Promise.prototype.then = function (onFulfilled, onRejected) {
  const prev = this;
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

Promise.prototype.catch = function (onRejected) {
  return Promise.prototype.then.call(this, undefined, onRejected);
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

function wrapToRejected(value) {
  return {
    then: function (_, onRejected) {
      return wrapToThenable(onRejected(value));
    }
  };
}

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
