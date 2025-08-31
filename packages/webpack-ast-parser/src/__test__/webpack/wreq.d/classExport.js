// Webpack Module 613568 - Patched by ConsoleJanitor
0,
function(e, t, n) {
    "use strict";
    n.d(t, {
        U: () => E
    }),
    n(388685),
    n(539854),
    n(415506);
    var r = n(500268)
      , i = n(512722)
      , a = n.n(i)
      , o = n(135273);
    n(17089);
    var s = n(986529)
      , l = n(579092)
      , c = n(153102)
      , u = n(625306)
      , d = n(420970);
    function f(e, t, n) {
        return t in e ? Object.defineProperty(e, t, {
            value: n,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[t] = n,
        e
    }
    let _ = new Set(["APP_STATE_UPDATE", "CLEAR_CACHES", "CONNECTION_CLOSED", "CONNECTION_OPEN", "CONNECTION_RESUMED", "LOGIN_SUCCESS", "LOGIN", "LOGOUT", "MESSAGE_SEND_FAILED", "PUSH_NOTIFICATION_CLICK", "RESET_SOCKET", "SESSION_START", "UPLOAD_FAIL", "WRITE_CACHES"])
      , p = new l.Yd("Flux")
      , h = 100
      , m = 10
      , g = "__subscriptions";
    class E {
        isDispatching() {
            return null != this._currentDispatchActionType
        }
        dispatch(e) {
            return new Promise( (t, n) => {
                this._waitQueue.push( () => {
                    try {
                        null == this.functionCache[e.type] && (this.functionCache[e.type] = e => this._dispatchWithDevtools(e),
                        y(this.functionCache[e.type], "dispatch_" + e.type)),
                        this.functionCache[e.type](e),
                        t()
                    } catch (e) {
                        n(e)
                    }
                }
                ),
                this.flushWaitQueue()
            }
            )
        }
        dispatchForStoreTest(e, t) {
            for (let {name: n, actionHandler: r, storeDidChange: i} of (a()(!1, "dispatchForTest cannot be called in: ".concat("production")),
            this._actionHandlers.getOrderedActionHandlers(e)))
                n === t && !1 !== r(e) && i(e)
        }
        flushWaitQueue() {
            if (!this._processingWaitQueue)
                try {
                    this._processingWaitQueue = !0,
                    c.Z.isDispatching = !0;
                    let t = 0;
                    for (; this._waitQueue.length > 0; ) {
                        if (++t > 100) {
                            var e;
                            let t = u.qC();
                            throw p.error("LastFewActions", t),
                            null == (e = this._sentryUtils) || e.addBreadcrumb({
                                message: "Dispatcher: Dispatch loop detected",
                                data: {
                                    lastFewActions: t
                                }
                            }),
                            Error("Dispatch loop detected, aborting")
                        }
                        for (; this._waitQueue.length > 0; )
                            this._waitQueue.shift()();
                        c.Z.emit()
                    }
                } finally {
                    this._processingWaitQueue = !1,
                    c.Z.isDispatching = !1
                }
        }
        _dispatchWithDevtools(e) {
            this._dispatchWithLogging(e)
        }
        _dispatchWithLogging(e) {
            a()(null == this._currentDispatchActionType, "Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. Action: ".concat(e.type, " Already dispatching: ").concat(this._currentDispatchActionType)),
            a()(e.type, "Dispatch.dispatch(...) called without an action type"),
            _.has(e.type) && p.log("Dispatching ".concat(e.type)),
            (0,
            s.B1)(e.type),
            u.IH(e.type);
            let t = this.actionLogger.log(e, t => {
                try {
                    this._currentDispatchActionType = e.type,
                    this._dispatch(e, t)
                } finally {
                    this._currentDispatchActionType = null
                }
            }
            );
            try {
                (0,
                s.L8)("DISPATCH[".concat(e.type, "]"), e.type)
            } catch (e) {}
        }
        _dispatch(e, t) {
            for (let t of this._interceptors)
                if (t(e))
                    return !1;
            let n = this._actionHandlers.getOrderedActionHandlers(e);
            for (let r = 0, i = n.length; r < i; r++) {
                let {name: i, actionHandler: a, storeDidChange: o} = n[r];
                !1 !== t(i, () => a(e)) && o(e)
            }
            let r = this._subscriptions[e.type];
            null != r && t(g, () => {
                r.forEach(t => t(e))
            }
            )
        }
        addInterceptor(e) {
            this._interceptors.push(e)
        }
        wait(e) {
            this._waitQueue.push(e),
            this.flushWaitQueue()
        }
        subscribe(e, t) {
            let n = this._subscriptions[e];
            null == n && (this._subscriptions[e] = n = new Set),
            n.add(t)
        }
        unsubscribe(e, t) {
            let n = this._subscriptions[e];
            null != n && (n.delete(t),
            0 === n.size && delete this._subscriptions[e])
        }
        register(e, t, n, r, i) {
            return this._actionHandlers.register(e, t, n, null != r ? r : this._defaultBand, i)
        }
        createToken() {
            return this._actionHandlers.createToken()
        }
        addDependencies(e, t) {
            this._actionHandlers.addDependencies(e, t)
        }
        constructor(e=0, t, n) {
            (f(this, "_defaultBand", void 0),
            f(this, "_interceptors", []),
            f(this, "_subscriptions", {}),
            f(this, "_waitQueue", []),
            f(this, "_processingWaitQueue", !1),
            f(this, "_currentDispatchActionType", null),
            f(this, "_actionHandlers", new b),
            f(this, "_sentryUtils", void 0),
            f(this, "actionLogger", void 0),
            f(this, "functionCache", {}),
            this._defaultBand = e,
            this._sentryUtils = n,
            null != t) ? this.actionLogger = t : ("undefined" == typeof window || 1,
            this.actionLogger = new d.Z),
            this.actionLogger.on("trace", (e, t, n) => {
                o.Z.isTracing && n >= m && o.Z.mark("\uD83E\uDDA5", t, n)
            }
            )
        }
    }
    function y(e, t) {
        Object.defineProperty(e, "name", {
            value: t
        })
    }
}
//# sourceURL=file:///WebpackModule613568

