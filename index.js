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
        "auto_confirm": true,
        "accept_gifts": true, // can be true|false|null. On null incoming gifts are ignored
        "accept_incoming": null // can be true|false|null. On null incoming trades except gifts are ignored
    };

    let config = JSON.parse(rawConfig);
    if(!Array.isArray(config)) {
        config = [config];
    }

    for(let i = 0; i < config.length; i++) {
        let conf = config[i];
        requiredProps.forEach((prop) => {
            if(!conf.hasOwnProperty(prop) || !conf[prop].length) {
                throw new Error("Config should contain non-empty field " + prop);
            }
        });

        config[i] = merge({}, defaultProps, conf);
    }

    return config;
}

function startNextBot() {
    let conf = config[conf_i];
    if(!conf) {
        log.info("# All bots checked");
        return;
    }

    bot = new Bot(conf, log);
    bot.start();
    conf_i++;

    let checker = setInterval(() => {
        if(bot._initialized && bot.hasNoConfirmations()) {
            clearInterval(checker);
            bot.stop();

            log.info("Switching bot..");

            startNextBot();
        }
    }, 1000);
}

function startOneBot() {
    bot = new Bot(config[0], log);
    bot.start();
}

let rawConfig = fs.readFileSync("./config.json");
let config = prepareConfig(rawConfig);

log.info("Config loaded");

let conf_i = 0, bot;
if(config.length > 1) {
    startNextBot();
} else {
    startOneBot();
}

process.on("SIGINT", function() {
    log.info("Stopping bot..");

    bot.stop();
    setTimeout(process.exit, 1000, 0);
});
