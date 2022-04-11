const refMap = new WeakMap();

function isPromise(value) {
  return value && typeof value.then === 'function';
}

function Promise(exector) {
  refMap.set(this, {
    pending: [],
    value: undefined
  });

  const resolve = value => {
    const data = refMap.get(this);

    if (data.pending) {
      data.value = wrapToThenable(value);
      for (const handlers of data.pending) {
        data.value.then.apply(data.value, handlers);
      }
      data.pending = undefined;
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
    const data = refMap.get(prev);

    if (data.pending) {
      data.pending.push([onSpreadFulfilled, onSpreadRejected]);
    } else {
      data.value.then(onSpreadFulfilled, onSpreadRejected);
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
