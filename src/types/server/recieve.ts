/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// should be the same types as src/server/types/recieve.ts in the companion
import { ReporterData as IReporterData } from "../reporter";
export type ReporterData = IReporterData;

export type IncomingMessage = (Report | DiffModule | ExtractModuleR | ModuleList | RawId | I18nValue) & Base;
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
export type I18nValue = {
    type: "i18n";
    data: {
        value: string;
    };
};

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

export type ExtractModuleR = {
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

