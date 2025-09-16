/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

import { start, stop } from "./port";
import { settings } from "./settings";

export default definePlugin({
    name: "EditUploadsV1",
    description: "Edit Uploads before sending. Ported to Vencord (discord native web console script).",
    authors: [{
        name: "ape",
        id: 860042784365871125n
    }, {
        name: "nicola02nb",
        id: 257900031351193600n
    }],
    settings,
    start: () => {
        start();
    },
    stop: () => {
        stop();
    },
});


