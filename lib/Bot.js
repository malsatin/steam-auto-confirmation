"use strict";

const TECH_CONFIG = {
    domain: "abracadabra.com",
    pollInterval: 15 * 1000,
    confirmationInterval: 10 * 1000,
};

const SteamUser = require("steam-user");
const SteamCommunity = require("steamcommunity");
const SteamTotp = require("steam-totp");
const TradeOfferManager = require("steam-tradeoffer-manager");

let log;

module.exports = Bot;

/**
 * @param {Object} config
 * @param {Logger} _log
 * @constructor
 */
function Bot(config, _log) {
    this._config = config;

    log = _log;

    this._user = new SteamUser({
        promptSteamGuardCode: false,
        rememberPassword: true,
    });
    this._community = new SteamCommunity();

    this._manager = new TradeOfferManager({
        steam: this._user,
        community: this._community,
        domain: TECH_CONFIG.domain,
        pollInterval: TECH_CONFIG.pollInterval, // Polling every 15 seconds is fine since we get notifications from Steam
        gzipData: true,
        savePollData: true,
    });

    this._initialized = false;
}

Bot.prototype.start = function() {
    log.log("Logging in");

    let logonData = {
        accountName: this._config.username,
        password: this._config.password,
    };

    this._user.logOn(logonData);
    this._user.on("loggedOn", () => {
        log.info("Logged into Steam.");
    });

    this._user.on("error", (err) => {
        log.error("Login error", err);

        if(err.eresult && Number(err.eresult) === 84) {
            log.warn("You have to wait about 30 minutes before next login");
            process.exit(1);
        }
    });

    this._user.on("steamGuard", (domain, callback) => {
        callback(SteamTotp.getAuthCode(this._config.shared_secret));
    });

    this._user.on("webSession", (sessionID, cookies) => {
        log.log("Got new webSession: " + sessionID);

        this._manager.setCookies(cookies, (err) => {
            if(err) {
                log.error(err);
                process.exit(1); // Fatal error since we couldn't get our API key
                return;
            }

            log.log("Got SteamAPI key: " + this._manager.apiKey);

            this._initAcceptor();
        });

        this._community.setCookies(cookies);

        if(this._config.auto_confirm) {
            this._community.startConfirmationChecker(TECH_CONFIG.confirmationInterval, this._config.identity_secret);
            this._community.checkConfirmations();
        }
    });

    this._community.on("sessionExpired", () => {
        log.log("Steam community session expired");

        this._user.webLogOn();
    });

    this._bindEventsLog();
};

Bot.prototype._initAcceptor = function() {
    if(this._initialized) {
        return;
    }
    this._initialized = true;

    // New received offer
    if(this._config.accept_incoming !== null || this._config.accept_gifts !== null) {
        this._manager.on("newOffer", (offer) => {
            // Сделано так для того, чотбы стим успел определиться со статусом трейда
            setTimeout(() => {
                offer.update((err) => {
                    if(err) {
                        log.error("Error while updating offer #" + offer.id + ": " + err.message);
                        return;
                    }

                    this._precessOffer(offer);
                });
            }, 2500);
        });
    }
};

Bot.prototype._precessOffer = function(offer) {
    if(offer.state !== TradeOfferManager.ETradeOfferState.Active) {
        log.log("Offer#" + offer.id + ": wrong, declining it (state is " + TradeOfferManager.ETradeOfferState[offer.state] + ")");

        offer.cancel();
        return;
    }
    if(offer.isGlitched()) {
        log.log("Offer#" + offer.id + ": glitched, declining it.");

        offer.cancel();
        return;
    }

    if(offer.itemsToGive.length > 0) {
        if(this._config.accept_incoming !== null) {
            if(this._config.accept_incoming) {
                log.log("Offer#" + offer.id + ": gift, accepting it.");

                this._acceptOffer(offer);
            } else {
                log.log("Offer#" + offer.id + ": gift, declining it.");

                offer.cancel();
            }
        }
    } else {
        if(this._config.accept_gifts !== null) {
            if(this._config.accept_gifts) {
                log.log("Offer#" + offer.id + ": gift, accepting it.");

                this._acceptOffer(offer);
            } else {
                log.log("Offer#" + offer.id + ": gift, declining it.");

                offer.cancel();
            }
        }
    }
};

Bot.prototype._acceptOffer = function(offer) {
    offer.accept(true, (err, status) => {
        if(err) {
            log.error(err);

            if(err.message === "HTTP error 403") {
                log.warn("Offer#" + offer.id + ": error accepting, bot logged off.");
            }
        } else {
            //this._community.checkConfirmations(); // Check for confirmations right after accepting the offer
            if(status === "accepted") {
                log.log("Offer#" + offer.id + ": accepted.");
            } else {
                log.log("Offer#" + offer.id + ": accept in progress.");
            }
        }
    });
};

Bot.prototype._bindEventsLog = function() {
    this._community.on("confirmationAccepted", (conf) => {
        log.log("Confirmed new trade#" + conf.offerID);
    });
};

Bot.prototype.stop = function() {
    this._manager.shutdown();
    this._community.stopConfirmationChecker();
    this._user.disconnect();
};
