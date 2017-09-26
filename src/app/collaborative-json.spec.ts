import {
  CollaborativeJson,
  CollaborativeJsonString,
  CollaborativeJsonAtom,
  CollaborativeJsonArray,
  ConflictResolver,
  Conflict,
  ConflictResolution
} from './collaborative-json';


describe('collaborative-json', () => {
  let collaborativeJson: CollaborativeJson;
  let _sync = '_sync';
  let prop = 'test';

  let doStringSync = (localVal: string, localTime: number, localSynchronized: boolean, foreignVal: string, foreignTime: number, foreignSynchronized: boolean, resolver: ConflictResolver = null) => {

    collaborativeJson.addRule(prop, new CollaborativeJsonString());

    let localNode = {
      [_sync]: {
        [prop]: {
          time: localTime,
          synchronized: localSynchronized
        }
      },
      [prop]: localVal
    };

    let foreignNode = {
      [_sync]: {
        [prop]: {
          time: foreignTime,
          synchronized: foreignSynchronized
        }
      },
      [prop]: foreignVal
    };

    return collaborativeJson.sync(localNode, foreignNode, resolver).then(() => {
      return {
        local: localNode,
        foreign: foreignNode
      };
    });
  }

  beforeEach(() => {
    collaborativeJson = new CollaborativeJson(_sync);
  });

  it('should exist', (done) => {
    expect(collaborativeJson).toBeTruthy();
    done();
  });

  it('should add _sync property and not sync (_sync=no|no, prop=no|no, _sync.time=no|no, _sync.synchronized: no|no)', (done) => {
    return doStringSync(
      null, null, null,
      null, null, null,
    ).then(nodes => {
      expect(nodes.local[_sync][prop]).toBeTruthy();
      expect(nodes.foreign[_sync][prop].time).toBeFalsy();
      expect(nodes.foreign[_sync][prop].synchronized).toBeFalsy();
      done();
    });
  });

  it('should keep local changes and not sync (_sync=no|no, prop=yes|no, _sync.time=no|no, _sync.synchronized: no|no)', (done) => {
    let val = 'my string';

    return doStringSync(
      val, null, null,
      null, null, null,
    ).then(nodes => {
      expect(nodes.local[prop]).toEqual(val);
      done();
    });
  });

  it('should keep local changes and not sync (_sync=no|yes, prop=yes|yes, _sync.time=no|yes, _sync.synchronized: no|yes)', (done) => {
    let val = 'my string';

    return doStringSync(
      val, null, null,
      null, null, null,
    ).then(nodes => {
      expect(nodes.local[prop]).toEqual(val);
      expect(nodes.local[_sync]).toBeTruthy();
      done();
    });
  });

  it('should keep local changes and not sync (_sync=yes|yes, prop=yes|yes, _sync.time=yes|yes, _sync.synchronized: no|yes)', (done) => {
    let val = 'my string';
    let foreignVal = 'their string';

    return doStringSync(
      val, 0, null,
      foreignVal, 0, true,
    ).then(nodes => {
      expect(nodes.local[prop]).toEqual(val);
      expect(nodes.local[_sync][prop].time).toEqual(0);
      expect(nodes.local[_sync][prop].synchronized).toBeFalsy();
      done();
    });
  });

  it('should keep local changes and not sync (_sync=yes|yes, prop=yes|yes, _sync.time=yes>yes, _sync.synchronized: yes|yes)', (done) => {
    let val = 'my string';
    let foreignVal = 'their string';

    return doStringSync(
      val, 1, true,
      foreignVal, 0, true,
    ).then(nodes => {
      expect(nodes.local[prop]).toEqual(val);
      expect(nodes.local[_sync][prop].time).toEqual(1);
      expect(nodes.local[_sync][prop].synchronized).toEqual(true);
      done();
    });
  });

  it('should keep local changes and not sync (_sync=yes|yes, prop=yes|yes, _sync.time=yes|yes, _sync.synchronized: yes|yes)', (done) => {
    let val = 'my string';
    let foreignVal = 'their string';

    return doStringSync(
      val, 1, true,
      foreignVal, 1, true,
    ).then(nodes => {
      expect(nodes.local[prop]).toEqual(val);
      expect(nodes.local[_sync][prop].time).toEqual(1);
      expect(nodes.local[_sync][prop].synchronized).toEqual(true);
      done();
    });
  });

  it('should keep local changes and not sync (_sync=yes|yes, prop=yes|yes, _sync.time=yes|yes, _sync.synchronized: yes|yes)', (done) => {
    let val = 'my string';
    let foreignVal = 'their string';

    return doStringSync(
      val, 0, null,
      foreignVal, 1, true,
    ).then(nodes => {
      expect(nodes.local[prop]).toEqual(val);
      expect(nodes.local[_sync][prop].time).toEqual(0);
      expect(nodes.local[_sync][prop].synchronized).toBeFalsy();
      done();
    });
  });

  it('should accept foreign changes and sync (_sync=yes|yes, prop=yes|yes, _sync.time=yes<yes, _sync.synchronized: yes|yes)', (done) => {
    let val = 'my string';
    let foreignVal = 'their string';

    return doStringSync(
      val, 0, true,
      foreignVal, 1, true,
    ).then(nodes => {
      expect(nodes.local[prop]).toEqual(foreignVal);
      expect(nodes.local[_sync][prop].time).not.toEqual(0);
      expect(nodes.local[_sync][prop].synchronized).toEqual(true);
      done();
    });
  });

  it('should resolve conflicts', (done) => {
    let val = 'my string';
    let foreignVal = 'their string';
    let resolvedValue = 'resolve';

    class TestResolver implements ConflictResolver {
      resolve(conflict: Conflict): Promise<ConflictResolution> {
        conflict.local[conflict.property] = resolvedValue;
        return Promise.resolve(new ConflictResolution(true, conflict));
      }
    };

    return doStringSync(
      val, null, null,
      foreignVal, 1, true,
      new TestResolver()
    ).then(nodes => {
      expect(nodes.local[prop]).toEqual(resolvedValue);
      expect(nodes.local[_sync][prop].time).not.toEqual(0);
      expect(nodes.local[_sync][prop].synchronized).toEqual(true);
      done();
    });
  });

  it('should X', (done) => {
    expect(collaborativeJson).toBeTruthy();
    done();
  });
});
