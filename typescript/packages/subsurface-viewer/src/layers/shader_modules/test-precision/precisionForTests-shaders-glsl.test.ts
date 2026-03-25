import "jest";

import { describe, expect, it, afterEach, jest } from "@jest/globals";

describe("precisionForTests-shaders-glsl", () => {
    const originalProcess = global.process;

    afterEach(() => {
        global.process = originalProcess;
        jest.resetModules();
    });

    it("does not throw when process is undefined (browser-like environment)", async () => {
        // @ts-expect-error simulating browser where process is not defined
        global.process = undefined;

        await expect(
            jest.isolateModulesAsync(
                () => import("./precisionForTests-shaders-glsl")
            )
        ).resolves.not.toThrow();
    });

    it("selects PROD_PRECISION when process is undefined", async () => {
        // @ts-expect-error simulating browser where process is not defined
        global.process = undefined;

        let PRECISION: string | undefined;
        await jest.isolateModulesAsync(async () => {
            ({ PRECISION } = await import("./precisionForTests-shaders-glsl"));
        });

        expect(PRECISION).toBe("");
    });

    it("selects PROD_PRECISION when no relevant env vars are set", async () => {
        global.process = { ...originalProcess, env: {} };

        let PRECISION: string | undefined;
        await jest.isolateModulesAsync(async () => {
            ({ PRECISION } = await import("./precisionForTests-shaders-glsl"));
        });

        expect(PRECISION).toBe("");
    });

    it("selects TEST_PRECISION when NODE_ENV is not production", async () => {
        global.process = { ...originalProcess, env: { NODE_ENV: "test" } };

        let PRECISION: string | undefined;
        await jest.isolateModulesAsync(async () => {
            ({ PRECISION } = await import("./precisionForTests-shaders-glsl"));
        });

        expect(PRECISION).toContain("precision highp float");
    });

    it("selects PROD_PRECISION when NODE_ENV is production", async () => {
        global.process = {
            ...originalProcess,
            env: { NODE_ENV: "production" },
        };

        let PRECISION: string | undefined;
        await jest.isolateModulesAsync(async () => {
            ({ PRECISION } = await import("./precisionForTests-shaders-glsl"));
        });

        expect(PRECISION).toBe("");
    });
});
