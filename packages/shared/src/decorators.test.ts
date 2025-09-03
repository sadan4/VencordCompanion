import { Cache, CacheGetter } from "./decorators";

import { describe, expect, it } from "vitest";
describe("@CacheGetter()", function () {
    const mkTestClass = () => {
        class TestCachingGetters {
            @CacheGetter()
            static get staticValue() {
                return Symbol();
            }

            @CacheGetter()
            get value() {
                return Symbol();
            }
        }
        return TestCachingGetters;
    };

    it("works on static getters", function () {
        const cls = mkTestClass();

        expect(cls.staticValue).to.be.a("symbol").and.equal(cls.staticValue);
    });

    it("works on instance getters", function () {
        const cls = mkTestClass();
        const instance = new cls();

        expect(instance.value).to.be.a("symbol").and.equal(instance.value);
    });

    it("keeps values separate between static class getters", function () {
        const cls1 = mkTestClass();
        const cls2 = mkTestClass();

        expect(cls1.staticValue).to.be.a("symbol").and.not.equal(cls2.staticValue);
    });

    it("keeps values separate between different instance getters", function () {
        const cls = mkTestClass();
        const inst1 = new cls();
        const inst2 = new cls();

        expect(inst1.value).to.be.a("symbol").and.not.equal(inst2.value);
    });

    it("properly invalidates the cache", function () {
        const arr: (() => void)[] = [];

        class cls {
            @CacheGetter(arr)
            get rand() {
                return Symbol();
            }
        }

        const inst = new cls();
        const val1 = inst.rand;

        arr.forEach((x) => x());

        const val2 = inst.rand;

        expect(val1).to.not.equal(val2);
    });

    describe("throws an error when on the wrong type of thing", function () {
        it("errors on a static field", function () {
            expect(() => {
                class _shouldThrow {
                    // @ts-expect-error it should also throw a type error
                    @CacheGetter()
                    static field;
                }
            }).to.throw();
        });

        it("errors on a static function", function () {
            expect(() => {
                class _shouldThrow {
                    @CacheGetter()
                    func() {
                    }
                }
            }).to.throw();
        });

        it("errors on a lone setter", function () {
            expect(() => {
                class _shouldThrow {
                    // eslint-disable-next-line accessor-pairs
                    @CacheGetter()
                    set value(v) {
                        void v;
                    }
                }
            }).to.throw();
        });
    });
});
describe("@Cache()", function () {
    const mkTestClass = () => {
        class TestCachingFuncs {
            @Cache()
            static staticFunc() {
                return Symbol();
            }

            @Cache()
            func() {
                return Symbol();
            }
        }
        return TestCachingFuncs;
    };

    it("works on static methods", function () {
        const cls = mkTestClass();

        expect(cls.staticFunc()).to.be.a("symbol").and.equal(cls.staticFunc());
    });

    it("works on instance methods", function () {
        const cls = mkTestClass();
        const instance = new cls();

        expect(instance.func()).to.be.a("symbol").and.equal(instance.func());
    });

    it("keeps values separate between static class methods", function () {
        const cls1 = mkTestClass();
        const cls2 = mkTestClass();

        expect(cls1.staticFunc()).to.be.a("symbol").and.not.equal(cls2.staticFunc());
    });

    it("keeps values separate between different instance funcs", function () {
        const cls = mkTestClass();
        const inst1 = new cls();
        const inst2 = new cls();

        expect(inst1.func()).to.be.a("symbol").and.not.equal(inst2.func());
    });

    it("properly invalidates the cache", function () {
        const arr: (() => void)[] = [];

        class cls {
            @Cache(arr)
            rand() {
                return Symbol();
            }
        }

        const inst = new cls();
        const val1 = inst.rand();

        arr.forEach((x) => x());

        const val2 = inst.rand();

        expect(val1).to.not.equal(val2);
    });

    describe("it throws an error on the wrong type of thing", function () {
        it("errors on getters", function () {
            expect(() => {
                class _shouldThrow {
                    // @ts-expect-error should error
                    @Cache()
                    get getter() {
                        return;
                    }
                }
            }).to.throw();
        });

        it("errors on setters", function () {
            expect(() => {
                class _shouldThrow {
                    // eslint-disable-next-line accessor-pairs
                    @Cache()
                    set setter(v) {
                    }
                }
            }).to.throw();
        });

        it("errors on getters and setters", function () {
            expect(() => {
                class _shouldThrow {
                    // @ts-expect-error should error
                    @Cache()
                    get val() {
                        return;
                    }

                    set val(v) {
                    }
                }
            }).to.throw();
        });

        it("errors on fields", function () {
            expect(() => {
                class _shouldThrow {
                    // @ts-expect-error
                    @Cache()
                    field;
                }
            }).to.throw();
        });
        it("errors on functions with parameters", function () {
            expect(() => {
                class _shouldThrow {
                    // @ts-expect-error should error
                    @Cache()
                    func(param) {
                        return;
                    }
                }
            }).to.throw();
        });
    });
});
