/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    config: {
        type: OptionType.CUSTOM,
        description: "Current configuration.",
        default: {
            rgbMode: "dynamic",
            rgbStatic: "#00aaff",
            hdrMode: "auto",
            inject: { attachments: true, viewer: true, misc: false },
            rgbSpeed: 1,
        },
    }
});
