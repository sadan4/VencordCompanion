// Webpack Module 999999 - Patched by
0,
function(e, t, n) {
    n.d(t, {
        ZP: () => h
    });
    var r, i, l, a = n(555002),
        _2 = n(222222);
    class p extends (l = a.ZP.Store) {
        initialize() {
            window.doThing();
        }
        getFoo() {
            return window.doThing() + _2.H(9, 7);
        }
        getBar() {
            return 2;
        }
    }
    i = "MyTestingStore",
    (r = "displayName")in p ? Object.defineProperty(p, r, {
        value: i,
        enumerable: !0,
        configurable: !0,
        writable: !0
    }) : p[r] = i;
    let h = new p(o.Z,{
        FLUX_EVENT_HANDLER(e) {
            update_state_123(e)
        }
    })
}
