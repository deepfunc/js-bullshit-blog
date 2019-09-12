function createHook() {
  const _hooks = {};

  function register(key, fn) {
    if (!_hooks[key]) {
      _hooks[key] = [];
    }
    _hooks[key].push(fn);

    return function unregister() {
      const fns = _hooks[key];
      const idx = fns.indexOf(fn);
      fns.splice(idx, 1);
      if (fns.length === 0) {
        delete _hooks[key];
      }
    };
  }

  function isRegistered(key) {
    return (_hooks[key] || []).length > 0;
  }

  function syncExec(key, ...args) {
    const fns = (_hooks[key] || []).slice();
    let idx = 0;

    const next = function (...args) {
      if (idx >= fns.length) {
        return (args.length > 1 ? args : args[0]);
      } else {
        const fn = fns[idx++].call(this, next.bind(this));
        return fn.apply(this, args);
      }
    };

    return next.apply(this, args);
  }

  function asyncExec(key, ...args) {
    const fns = (_hooks[key] || []).slice();
    let idx = 0;

    const next = function (...args) {
      if (idx >= fns.length) {
        return Promise.resolve(args.length > 1 ? args : args[0]);
      } else {
        try {
          const fn = fns[idx++].call(this, next.bind(this));
          const rst = fn.apply(this, args);
          return Promise.resolve(rst);
        } catch (err) {
          return Promise.reject(err);
        }
      }
    };

    return next.apply(this, args);
  }

  function unregisterAll(key) {
    delete _hooks[key];
  }

  return {
    register,
    isRegistered,
    syncExec,
    asyncExec,
    unregisterAll
  };
}

module.exports = createHook;
