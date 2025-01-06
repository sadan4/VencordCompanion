/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// should be the same types as src/server/types/recieve.ts in the companion
import { ReporterData as IReporterData } from "../../types";
export type ReporterData = IReporterData;

export type IncomingMessage = (Report | DiffModule | ExtractModule | ModuleList | RawId) & Base;
export type FullIncomingMessage = IncomingMessage & Nonce;
export type Base = {
    ok: true;
} | {
    ok: false;
    error: string;
};
export type Nonce = {
    nonce: number;
};
export type ModuleResult = {
    moduleNumber: number;
};

// #region valid payloads
export type Report = {
    type: "report";
    data: ReporterData;
};

export type DiffModule = {
    type: "diff";
    data: {
        source: string;
        patched: string;
    } & ModuleResult;
};

export type ExtractModule = {
    type: "extract";
    data: {
        module: string;
        /**
         * if the module is incomplete. ie: from a find
         */
        find?: boolean;
    } & ModuleResult;
};

export type ModuleList = {
    type: "moduleList";
    data: {
        modules: string[];
    };
};

export type RawId = {
    type: "rawId";
    data: string;
};
// #endregion

