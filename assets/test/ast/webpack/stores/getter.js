// Webpack Module 352527 - Patched by
0,
function(e, t, n) {
    n.d(t, {
        Z: () => d
    });
    var r, l, i, o = n(442837), a = n(570140);
    let s = !1
      , c = !1;
    class u extends (i = o.ZP.Store) {
        get keepOpen() {
            return c
        }
        get enabled() {
            return s
        }
    }
    l = "SoundboardOverlayStore",
    (r = "displayName")in u ? Object.defineProperty(u, r, {
        value: l,
        enumerable: !0,
        configurable: !0,
        writable: !0
    }) : u[r] = l;
    let d = new u(a.Z,{
        SOUNDBOARD_SET_OVERLAY_ENABLED: function(e) {
            if (s = e.enabled,
            e.enabled) {
                var t;
                c = null != (t = e.keepOpen) && t
            }
        }
    })
}
