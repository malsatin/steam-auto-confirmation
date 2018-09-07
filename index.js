"use strict";

const fs = require("fs");
const merge = require("merge");

const Logger = require("./lib/Logger");
const Bot = require("./lib/Bot");

const log = new Logger({
    format: [
        "{{timestamp}} <{{title}}> {{message}}",
        {
            error: "{{timestamp}} <{{title}}> {{message}} ({{file}}:{{method}}:{{line}}:{{pos}})",
        },
    ],
    dateformat: "mm-dd HH:MM:ss.L",
});

function prepareConfig(rawConfig) {
    if(!rawConfig) {
        throw new Error("Config file not found");
    }
    const requiredProps = ["username", "password", "shared_secret", "identity_secret"];
    const defaultProps = {
        "confirm_incoming": true,
        "confirm_outgoing": true,
        "accept_gifts": true, // can be true|false|null. On null incoming gifts are ignored
        "accept_incoming": null // can be true|false|null. On null incoming trades except gifts are ignored
    };

    let config = JSON.parse(rawConfig);
    requiredProps.forEach((prop) => {
        if(!config.hasOwnProperty(prop) || !config[prop].length) {
            throw new Error("Config should contain non-empty field " + prop);
        }
    });

    return merge({}, defaultProps, config);
}

let rawConfig = fs.readFileSync("./config.json");

let bot = new Bot(prepareConfig(rawConfig), log);
bot.start();

process.on("SIGINT", function() {
    log.info("Stopping bot..");

    bot.stop();
    setTimeout(process.exit, 1000, 0);
});
