const { expect } = require('chai');
const createHook = require('../hook');

describe('hook', function () {
  it('should register', function () {
    const hook = createHook();

    hook.register('process-test', function (next) {
      return function (num) {
        return num + 1;
      };
    });
    expect(hook.isRegistered('process-test')).to.be.true;
    expect(hook.isRegistered('process-other')).to.be.false;
  });

  it('should unregister', function () {
    const hook = createHook();

    const unregister = hook.register('process-test', function (next) {
      return function (num) {
        return num + 1;
      };
    });
    expect(hook.isRegistered('process-test')).to.be.true;

    unregister();
    expect(hook.isRegistered('process-test')).to.be.false;
  });

  it('should syncExec', function () {
    const hook = createHook();

    expect(hook.syncExec('process-test', 6)).to.equal(6);
    expect(hook.syncExec('process-test')).to.be.undefined;
    expect(hook.syncExec('process-test', 6, 7, 8)).to.eql([6, 7, 8]);

    const unregister = hook.register('process-test', function (next) {
      return function (num) {
        return num + 1;
      };
    });
    expect(hook.syncExec('process-test', 6)).to.equal(7);

    unregister();
    hook.register('process-test', function (next) {
      return function (num) {
        return next(num + 1);
      };
    });
    expect(hook.syncExec('process-test', 66)).to.equal(67);

    hook.register('process-test', function (next) {
      return function (num) {
        return num + 2;
      };
    });
    expect(hook.syncExec('process-test', 66)).to.equal(69);

    hook.register('process-test', function (next) {
      return function (num) {
        return num + 3;
      };
    });
    expect(hook.syncExec('process-test', 666)).to.equal(669);
  });

  it('should asyncExec and then return result correctly', function () {
    const hook = createHook();

    return hook.asyncExec('unknown', 6).then(rst => {
      // should return args[0].
      expect(rst).to.equal(6);

      return hook.asyncExec('unknown', 6, 66);
    }).then(rst => {
      // should return args.
      expect(rst).to.eql([6, 66]);

      hook.register('process-test', function (next) {
        return function (obj) {
          return next({ count: obj.count + 1 });
        };
      });
      return hook.asyncExec('process-test', { count: 6 });
    }).then(rst => {
      // should next for one hook fn.
      expect(rst).to.eql({ count: 7 });

      hook.unregisterAll('process-test');
      hook.register('process-test', function (next) {
        return function (obj) {
          return { count: obj.count + 2 };
        };
      });
      return hook.asyncExec('process-test', { count: 6 });
    }).then(rst => {
      // should return for one hook fn.
      expect(rst).to.eql({ count: 8 });

      hook.unregisterAll('process-test');
      hook.register('process-test', function (next) {
        return function (obj) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(next({ count: obj.count + 1 }));
            }, 100);
          });
        };
      });
      hook.register('process-test', function (next) {
        return function (obj) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(next({ count: obj.count + 2 }));
            }, 100);
          });
        };
      });
      return hook.asyncExec('process-test', { count: 66 });
    }).then(rst => {
      // should return for multiple hook fns and first fn use next.
      expect(rst).to.eql({ count: 69 });

      hook.unregisterAll('process-test');
      hook.register('process-test', function (next) {
        return function (obj) {
          return { count: obj.count + 1 };
        };
      });
      hook.register('process-test', function (next) {
        return function (obj) {
          return { count: obj.count + 2 };
        };
      });
      return hook.asyncExec('process-test', { count: 66 });
    }).then(rst => {
      // should return for multiple hook fns and first fn use return.
      expect(rst).to.eql({ count: 67 });
    });
  });

  it('should asyncExec and call catch when throw exception', function (done) {
    const hook = createHook();

    hook.register('process-test', function (next) {
      return function () {
        throw new Error('hi, this is an exception!');
      };
    });
    hook.asyncExec('process-test', { n: 6 }).catch(err => {
      expect(err.message).to.equal('hi, this is an exception!');
      done();
    });
  });

  it('should asyncExec and call catch when return reject', function (done) {
    const hook = createHook();

    hook.register('process-test', function (next) {
      return function (...args) {
        return next(...args);
      };
    });
    hook.register('process-test', function (next) {
      return function () {
        return new Promise(function (resolve, reject) {
          reject(new Error('hi, this is an exception!'));
        });
      };
    });
    hook.asyncExec('process-test', { n: 6 }).catch(err => {
      expect(err.message).to.equal('hi, this is an exception!');
      done();
    });
  });

  it('should asyncExec and not call then but catch', function (done) {
    const hook = createHook();

    hook.register('process-test', function (next) {
      return function (...args) {
        return next(...args);
      };
    });
    hook.register('process-test', function (next) {
      return function () {
        throw new Error('hi, this is an exception!');
      };
    });
    hook.asyncExec('process-test', { n: 6 }).then(rst => {
      throw new Error('it will not happen!');
    }).catch(err => {
      expect(err.message).to.equal('hi, this is an exception!');
      done();
    });
  });
});
