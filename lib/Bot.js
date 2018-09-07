"use strict";

let log;

module.exports = Bot;

/**
 * @param {Object} config
 * @constructor
 */
function Bot(config, _log) {
    this._config = config;

    log = _log;
}

Bot.prototype.start = function() {

};

Bot.prototype.stop = function() {

};
