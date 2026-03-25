import "jest";

import { describe, expect, it, afterEach, beforeEach } from "@jest/globals";

describe("precisionForTests-shaders-glsl", () => {
    const originalProcess = global.process;

    afterEach(() => {
        global.process = originalProcess;
        jest.resetModules();
    });

    it("does not throw when process is undefined (browser-like environment)", () => {
        // @ts-expect-error simulating browser where process is not defined
        global.process = undefined;

        expect(() => {
            jest.isolateModules(() => {
                require("./precisionForTests-shaders-glsl");
            });
        }).not.toThrow();
    });

    it("selects PROD_PRECISION when process is undefined", () => {
        // @ts-expect-error simulating browser where process is not defined
        global.process = undefined;

        let PRECISION: string | undefined;
        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            ({ PRECISION } = require("./precisionForTests-shaders-glsl"));
        });

        expect(PRECISION).toBe("");
    });

    it("selects PROD_PRECISION when no relevant env vars are set", () => {
        global.process = {
            ...originalProcess,
            env: {},
        };

        let PRECISION: string | undefined;
        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            ({ PRECISION } = require("./precisionForTests-shaders-glsl"));
        });

        expect(PRECISION).toBe("");
    });

    it("selects TEST_PRECISION when NODE_ENV is not production", () => {
        global.process = {
            ...originalProcess,
            env: { NODE_ENV: "test" },
        };

        let PRECISION: string | undefined;
        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            ({ PRECISION } = require("./precisionForTests-shaders-glsl"));
        });

        expect(PRECISION).toContain("precision highp float");
    });

    it("selects PROD_PRECISION when NODE_ENV is production", () => {
        global.process = {
            ...originalProcess,
            env: { NODE_ENV: "production" },
        };

        let PRECISION: string | undefined;
        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            ({ PRECISION } = require("./precisionForTests-shaders-glsl"));
        });

        expect(PRECISION).toBe("");
    });
});
