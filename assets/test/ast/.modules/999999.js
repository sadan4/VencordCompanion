// Webpack Module 999999 - Patched by
0,
function(e, t, n) {
    n.d(t, {
        ZP: () => h
    });
    var r, i, a = n(555002),
        _2 = n(222222);
    class p extends (l = a.ZP.Store) {
        initialize() {
            window.doThing();
        }
        getFoo() {
            return window.doThing() + _2.H(9, 7);
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
        CONNECTION_OPEN: d,
        GLOBAL_DISCOVERY_SERVERS_SEARCH_LAYOUT_RESET: d,
        GLOBAL_DISCOVERY_SERVERS_SEARCH_COUNT_SUCCESS: function(e) {
            window.doThing(e);
        }
    })
}
