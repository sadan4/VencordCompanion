// Webpack Module 594174 - Patched by
0,
function(e, t, n) {
    "use strict";
    n.r(t),
    n.d(t, {
        ASSISTANT_WUMPUS_VOICE_USER: () => v,
        default: () => eP,
        mergeUser: () => A,
    }),
    n(388685),
    n(997841),
    n(825670),
    n(539854),
    n(642613);
    var r = n(392711)
      , a = n(864106)
      , s = n(579407)
      , l = n(502087)
      , c = n(168232)
      , u = n(598077)
      , d = n(630388)
      , f = n(823379)
      , _ = n(314897)
      , p = n(412788)
      , h = n(981631)
      , m = n(308083)
      , g = n(474936);
    function E(e, t, n) {
        return t in e ? Object.defineProperty(e, t, {
            value: n,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[t] = n,
        e
    }
    let b = {}
      , y = 0
      , v = "47835198259242069";
    function O(e, t, n) {
        let r = b[e];
        if (null == r)
            return !1;
        let i = r;
        i = null == n ? r.removeGuildAvatarHash(t) : r.addGuildAvatarHash(t, n),
        b[r.id] = i;
        let o = r !== i;
        return o && y++,
        o
    }
    function I(e, t) {
        let n = b[e];
        return !(null == n || (0,
        m.dM)(n.primaryGuild, t.primary_guild)) && (null == n.primaryGuild || null != t.primary_guild) && (n.primaryGuild = (0,
        m.lt)(t.primary_guild),
        b[n.id] = n,
        y++,
        !0)
    }
    function S(e, t) {
        switch (!0) {
        case null == e.primaryGuild && null == t.primary_guild:
            break;
        case null != e.primaryGuild && null == t.primary_guild:
        case (0,
        m.dM)(e.primaryGuild, t.primary_guild):
            t.primary_guild = e.primaryGuild;
            break;
        default:
            t.primary_guild = (0,
            m.lt)(t.primary_guild)
        }
        return t
    }
    function T(e) {
        let t = e.mfa_enabled;
        null != t && (e.mfaEnabled = t,
        delete e.mfa_enabled);
        let n = (0,
        c.G)(e.premium_type);
        void 0 !== n && (e.premiumType = n,
        delete e.premium_type);
        let r = e.nsfw_allowed;
        null != r && (e.nsfwAllowed = r,
        delete e.nsfw_allowed);
        let i = e.age_verification_status;
        null != i && (e.ageVerificationStatus = i,
        delete e.age_verification_status);
        let o = e.public_flags;
        null != o && (e.publicFlags = o,
        delete e.public_flags);
        let l = e.purchased_flags;
        void 0 !== l && (e.purchasedFlags = l,
        delete e.purchased_flags);
        let u = e.premium_usage_flags;
        void 0 !== u && (e.premiumUsageFlags = u,
        delete e.premium_usage_flags),
        null === e.banner_color && delete e.banner_color;
        let d = e.avatar_decoration_data;
        void 0 !== d && (e.avatarDecorationData = (0,
        a.FG)(d),
        delete e.avatar_decoration_data);
        let f = e.collectibles;
        void 0 !== f && (delete e.collectibles,
        e.collectibles = (0,
        s.Xm)(f));
        let _ = e.global_name;
        void 0 !== _ && (e.globalName = _,
        delete e.global_name);
        let p = e.primary_guild;
        return void 0 !== p && (e.primary_guild = (0,
        m.lt)(p)),
        e
    }
    function N(e) {
        return e.id !== _.default.getId()
    }
    function A(e) {
        let t, n = !(arguments.length > 1) || void 0 === arguments[1] || arguments[1], r = b[e.id], i = void 0 !== e.id && e.id === _.default.getId();
        if (null == r)
            void 0 !== (t = (r = new u.Z(e)).premiumType) && i && (r.premiumType = R((0,
            c.QI)(r), r.premiumType));
        else if (n) {
            var o;
            let n = T(e);
            void 0 !== (t = null != (o = n.premium_type) ? o : n.premiumType) && i && (0,
            c.VR)(n) && (n = C(n)),
            n = S(r, n),
            r = r.merge(n)
        }
        (0,
        c.jX)((0,
        c.QI)(r), t, r.premiumType);
        let a = b[e.id] !== r;
        return b[e.id] = r,
        a && y++,
        a
    }
    function C(e) {
        var t;
        let n = null != (t = e.premium_type) ? t : e.premiumType
          , r = R((0,
        c.VR)(e), n);
        return void 0 !== e.premiumType ? e.premiumType = r : void 0 !== e.premium_type && (e.premium_type = r),
        e
    }
    function R(e, t) {
        if (!e)
            return t;
        let n = l.Z.getPremiumTypeOverride()
          , r = l.Z.getPremiumTypeActual();
        return n === g.F_ ? r : n
    }
    function P(e, t) {
        var n, r, i, o, a, s;
        if (null != e.author && "SENDING" !== e.state && N(e.author) && A(e.author, t),
        null == (n = e.mentions) || n.forEach(e => {
            N(e) && A(e, t)
        }
        ),
        (null == (r = e.interaction) ? void 0 : r.user) != null && N(null == (i = e.interaction) ? void 0 : i.user) && A(e.interaction.user, t),
        null == (o = e.attachments) || o.forEach(e => {
            var n;
            null == (n = e.clip_participants) || n.forEach(e => {
                N(e) && A(e, t)
            }
            )
        }
        ),
        (null == (a = e.resolved) ? void 0 : a.users) != null)
            for (let n in e.resolved.users) {
                let r = e.resolved.users[n];
                N(r) && A(r, t)
            }
        (null == (s = e.interaction_metadata) ? void 0 : s.user) != null && N(e.interaction_metadata.user) && A(e.interaction_metadata.user, t)
    }
    function w(e) {
        let {user: t, users: n, guilds: r} = e;
        delete t.premium,
        delete t.banner_color,
        A(t),
        n.forEach(e => {
            A(e)
        }
        ),
        r.forEach(e => {
            e.members.forEach(t => {
                O(t.user.id, e.id, t.avatar),
                I(t.user.id, t.user)
            }
            )
        }
        ),
        null != b[_.default.getId()] && (b[v] = new u.Z({
            id: v,
            username: "Wumpus",
            discriminator: "0",
            globalName: "Wumpus",
            avatar: "c1f86b313385cb97985f1b118851c28c"
        }))
    }
    function L(e) {
        return !("incomplete"in e)
    }
    function U(e) {
        let {messages: t} = e;
        return t.forEach(e => P(e, !0)),
        !1
    }
    let Q = ["username", "avatar", "global_name", "discriminator", "bot", "primary_guild"];
    class eR extends p.Z {
        initialize() {
            this.waitFor(_.default, l.Z)
        }
        takeSnapshot() {
            let e = this.getCurrentUser();
            return {
                version: eR.LATEST_SNAPSHOT_VERSION,
                data: {
                    users: [e].filter(f.lm)
                }
            }
        }
        handleLoadCache(e) {
            let t = this.readSnapshot(eR.LATEST_SNAPSHOT_VERSION);
            if (null != t)
                for (let e of t.users)
                    b[e.id] = new u.Z(e);
            if (null != e.users)
                for (let t of e.users)
                    t.id in b && L(t) || (b[t.id] = new u.Z(t));
            for (let t of [e.privateChannels, e.initialGuildChannels])
                for (let e of t) {
                    var n;
                    null == (n = e.rawRecipients) || n.forEach(e => A(e, !1))
                }
        }
        getUserStoreVersion() {
            return y
        }
        getUser(e) {
            if (null != e)
                return b[e]
        }
        getUsers() {
            return b
        }
        forEach(e) {
            for (let t in b)
                if (!1 === e(b[t]))
                    break
        }
        findByTag(e, t) {
            for (let n in b) {
                let r = b[n];
                if (null != t && r.username === e && r.discriminator === t || null == t && r.username === e && r.isPomelo())
                    return r
            }
        }
        filter(e) {
            let t = arguments.length > 1 && void 0 !== arguments[1] && arguments[1]
              , n = [];
            for (let t in b) {
                let r = b[t];
                e(r) && n.push(r)
            }
            return t && n.sort( (e, t) => e.username > t.username ? 1 : e.username < t.username ? -1 : 0),
            n
        }
        getCurrentUser() {
            return b[_.default.getId()]
        }
        constructor() {
            super({
                CONNECTION_OPEN: w,
                CACHE_LOADED: e => this.handleLoadCache(e),
                LOAD_MESSAGES_SUCCESS: U,
                LOAD_MESSAGES_AROUND_SUCCESS: U,
                LOAD_PINNED_MESSAGES_SUCCESS: U,
                LOAD_RECENT_MENTIONS_SUCCESS: U,
            })
        }
    }
    E(eR, "displayName", "UserStore"),
    E(eR, "LATEST_SNAPSHOT_VERSION", 1);
    let eP = new eR
}
