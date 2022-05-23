const Promise = require('./p7');

Promise.all = promises => {
  const arr = [];
  let i = 0;

  return new Promise((resolve, reject) => {
    promises.forEach((p, idx) => {
      Promise.resolve(p).then(res => {
        arr[idx] = res;
        i++;
        if (i === promises.length) {
          resolve(arr);
        }
      }, reject);
    });
  });
};

Promise.race = promises => {
  return new Promise((resolve, reject) => {
    for (const p of promises) {
      Promise.resolve(p).then(resolve, reject);
    }
  });
};

Promise.any = promises => {
  const arr = [];
  let i = 0;

  return new Promise((resolve, reject) => {
    promises.forEach((p, idx) => {
      Promise.resolve(p).then(resolve, err => {
        arr[idx] = err;
        i++;
        if (i === promises.length) {
          reject(arr);
        }
      });
    });
  });
};

Promise.allSettled = promises => {
  const arr = [];
  let i = 0;

  return new Promise(resolve => {
    const handleResult = (res, idx) => {
      arr[idx] = res;
      i++;
      if (i === promises.length) {
        resolve(arr);
      }
    };

    promises.forEach((p, idx) => {
      Promise.resolve(p).then(
        res => handleResult({ status: 'fulfilled', value: res }, idx),
        err => handleResult({ status: 'rejected', reason: err }, idx)
      );
    });
  });
};
