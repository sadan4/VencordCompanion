// Webpack Module 317269 - Patched by
0,
function(e, t, n) {
    n.d(t, {
        TB: () => T,
        VY: () => x,
        ZP: () => y
    }),
    n(47120),
    n(411104);
    var r = n(200651)
      , o = n(192379)
      , i = n(512722)
      , l = n.n(i)
      , a = n(442837)
      , s = n(481060)
      , u = n(16084)
      , c = n(987209)
      , d = n(179118)
      , _ = n(912788)
      , m = n(509545)
      , f = n(55563)
      , p = n(74538)
      , N = n(741245)
      , C = n(474936)
      , h = n(981631)
      , I = n(388032)
      , b = n(128463);
    function g(e) {
        let t, {planId: n, startingPremiumSubscriptionPlanId: o, paymentSourceType: i} = e, [s,u] = (0,
        a.Wu)([m.Z], () => [m.Z.get(o), m.Z.get(n)]);
        if (l()(null != s && null != u, "Missing startingPlan or newPlan"),
        C.Y1.indexOf(o) < C.Y1.indexOf(n))
            switch (n) {
            case C.Xh.PREMIUM_MONTH_TIER_1:
                t = I.NW.string(I.t.knvOV1),
                h.X7u.has(null != i ? i : h.HeQ.UNKNOWN) && (t = I.NW.format(I.t.o6hBiY, {}));
                break;
            case C.Xh.PREMIUM_MONTH_TIER_2:
                t = I.NW.string(I.t.f8Dqur),
                h.X7u.has(null != i ? i : h.HeQ.UNKNOWN) && (t = I.NW.format(I.t.A4THYm, {}));
                break;
            case C.Xh.PREMIUM_YEAR_TIER_1:
                t = I.NW.string(I.t.YZd5r6),
                h.X7u.has(null != i ? i : h.HeQ.UNKNOWN) && (t = I.NW.format(I.t.MHAxpK, {}));
                break;
            case C.Xh.PREMIUM_YEAR_TIER_2:
                t = I.NW.formatToPlainString(I.t["M/Lknp"], {
                    numFreeGuildSubscriptions: C.cb
                }),
                h.X7u.has(null != i ? i : h.HeQ.UNKNOWN) && (t = I.NW.format(I.t.mULxLS, {
                    numFreeGuildSubscriptions: C.cb
                }));
                break;
            case C.Xh.PREMIUM_3_MONTH_TIER_2:
            case C.Xh.PREMIUM_6_MONTH_TIER_2:
                t = I.NW.string(I.t.aaCoW1);
                break;
            case C.Xh.PREMIUM_MONTH_TIER_0:
            case C.Xh.PREMIUM_YEAR_TIER_0:
                t = I.NW.string(I.t["XEoQ7+"]);
                break;
            default:
                throw Error("Unexpected planId: ".concat(n))
            }
        else if (s.skuId === C.Si.TIER_2 && u.skuId === C.Si.TIER_1)
            t = I.NW.string(I.t.PNX4ND);
        else
            switch (u.skuId) {
            case C.Si.TIER_0:
                t = I.NW.string(I.t["XEoQ7+"]);
                break;
            case C.Si.TIER_1:
                t = I.NW.string(I.t.nLI1Ki);
                break;
            case C.Si.TIER_2:
                t = 1 !== s.intervalCount ? I.NW.string(I.t.qSZZVF) : I.NW.string(I.t.RNjcNj);
                break;
            default:
                throw Error("Unexpected skuId: ".concat(u.skuId))
            }
        return (0,
        r.jsx)("div", {
            className: b.text,
            children: t
        })
    }
    function y(e) {
        let t, n, {planId: i, enableNoPaymentTrial: c, startingPremiumSubscriptionPlanId: d, onClose: _, followupSKUInfo: y, isDowngrade: T, hideClose: x, postSuccessGuild: P, paymentSourceType: E} = e, {theme: O} = (0,
        s.TCT)(), v = (0,
        a.e7)([f.Z], () => null != y ? f.Z.get(y.id) : null);
        o.useEffect( () => {
            if (null == y || null != v)
                return;
            let {applicationId: e, id: t} = y;
            (0,
            u.$N)(e, t).catch(h.VqG)
        }
        , [y, v]);
        let W = e => e.skuId === C.Si.TIER_0 ? h.X7u.has(null != E ? E : h.HeQ.UNKNOWN) ? I.NW.format(I.t.o6hBiY, {}) : I.NW.string(I.t["AGf/yc"]) : e.skuId === C.Si.TIER_1 ? h.X7u.has(null != E ? E : h.HeQ.UNKNOWN) ? I.NW.format(I.t.o6hBiY, {}) : I.NW.string(I.t.knvOV1) : h.X7u.has(null != E ? E : h.HeQ.UNKNOWN) ? I.NW.format(I.t.A4THYm, {}) : c ? I.NW.string(I.t["g52y/v"]) : I.NW.string(I.t.aTUr3d);
        if (null != v)
            t = (0,
            r.jsx)("div", {
                className: b.text,
                children: I.NW.format(I.t.tsQOs7, {
                    skuName: v.name
                })
            });
        else if (null != d)
            t = (0,
            r.jsx)(g, {
                planId: i,
                startingPremiumSubscriptionPlanId: d
            });
        else if (null != P) {
            let e = m.Z.get(i);
            l()(null != e, "Missing plan"),
            t = (0,
            r.jsxs)(r.Fragment, {
                children: [(0,
                r.jsx)("div", {
                    className: b.text,
                    children: W(e)
                }), (0,
                r.jsx)("div", {
                    className: b.text,
                    children: I.NW.format(I.t["6aZ0NT"], {
                        guildName: P.name
                    })
                })]
            })
        } else {
            let e = m.Z.get(i);
            l()(null != e, "Missing plan"),
            t = (0,
            r.jsx)("div", {
                className: b.text,
                children: W(e)
            })
        }
        let M = p.ZP.getPremiumType(i);
        return l()(null != M, "premium type should not be null in purchase confirmation"),
        n = null != v ? I.NW.formatToPlainString(I.t["1qGgm5"], {
            skuName: v.name
        }) : T ? I.NW.string(I.t.QJ9EyM) : null != P ? I.NW.string(I.t.ta3cXV) : I.NW.string(I.t.TkTvBw),
        (0,
        r.jsxs)("div", {
            className: b.confirmation,
            children: [(0,
            r.jsx)(N.C, {
                className: b.banner,
                theme: O,
                premiumType: M,
                type: h.X7u.has(null != E ? E : h.HeQ.UNKNOWN) ? N.C.Types.PREMIUM_PAYMENT_STARTED : null != d ? N.C.Types.PREMIUM_UPDATED : N.C.Types.PREMIUM_ACTIVATED
            }), t, x ? null : (0,
            r.jsx)(s.zxk, {
                className: b.button,
                onClick: _,
                children: n
            })]
        })
    }
    function T(e) {
        let {planId: t, onClose: n} = e
          , {giftRecipient: o, selectedGiftStyle: i, hasSentMessage: s, giftMessageError: u, isSendingMessage: f} = (0,
        c.wD)()
          , p = (0,
        a.e7)([m.Z], () => m.Z.get(t));
        l()(null != p, "Missing plan");
        let N = (0,
        a.e7)([_.Z], () => _.Z.getGiftCode(p.skuId));
        return (0,
        r.jsx)(d.Z, {
            giftCode: N,
            subscriptionPlan: p,
            onClose: n,
            selectedGiftStyle: i,
            hasSentMessage: s,
            giftRecipient: o,
            giftMessageError: u,
            isSendingMessage: f
        })
    }
    function x() {
        return (0,
        r.jsxs)("div", {
            className: b.redirectConfirmation,
            children: [(0,
            r.jsx)(s.X6q, {
                variant: "heading-xl/bold",
                children: I.NW.string(I.t.Xtf9wM)
            }), (0,
            r.jsxs)("div", {
                className: b.redirectBody,
                children: [(0,
                r.jsx)(s.Text, {
                    variant: "text-md/normal",
                    children: I.NW.string(I.t.bIVRSU)
                }), (0,
                r.jsx)("br", {}), (0,
                r.jsx)(s.Text, {
                    variant: "text-md/normal",
                    children: I.NW.string(I.t["0UJqOz"])
                })]
            })]
        })
    }
}
//# sourceURL=WebpackModule317269