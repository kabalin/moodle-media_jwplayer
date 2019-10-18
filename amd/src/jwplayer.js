// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * JW Player module.
 *
 * @module     media_jwplayer/jwplayer
 * @package    media_jwplayer
 * @copyright  2017 Ruslan Kabalin, Lancaster University
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['jwplayer', 'jquery', 'core/ajax', 'core/log', 'module'], function(jwplayer, $, ajax, log, module) {
    var player = {
        /** @var {Number} context ID of the page. */
        context: null,

        /** @var {Object} event map. */
        eventMap: {
            started:   'firstFrame',
            paused:    'pause',
            seeked:    'seek',
            resumed:   'play',
            completed: 'complete',
            failed:    'error'
        },

        /** @var {Object} event map reversed. */
        flipEventMap: {},

        /**
         * Initialise the player instance.
         *
         * @method  init
         * @param   {Object}    playerSetup JW Player setup parameters.
         * @param   {Number}    context     The context of the current page.
         */
        init: function (playerSetup, context) {
            player.context = context;

            if (module.config().licensekey) {
                jwplayer.key = module.config().licensekey;
            }

            if (!$('#' + playerSetup.playerid).length) {
                player.logError({
                    type: 'setupError',
                    message: 'The target element for player setup (#' + playerSetup.playerid + ') is missing.'
                });
                return;
            }

            let playerinstance = jwplayer(playerSetup.playerid);
            playerinstance.setup(playerSetup.setupdata);

            // Add download button if required.
            if (typeof(playerSetup.downloadbtn) !== 'undefined') {
                playerinstance.addButton(playerSetup.downloadbtn.img, playerSetup.downloadbtn.tttext, function() {
                    // Grab the file that's currently playing.
                    window.open(playerinstance.getPlaylistItem().file + '?forcedownload=true');
                }, "download");
            }

            // Track errors and log them.
            playerinstance.on('setupError', player.logError);
            playerinstance.on('error', player.logError);

            // Track required events and log them in Moodle.
            playerSetup.events.forEach(function (eventName) {
                if (player.getEventName(eventName) !== 'undefined') {
                    player.flipEventMap[player.getEventName(eventName)] = eventName;
                    playerinstance.on(player.getEventName(eventName), player.logEvent);
                }
            });
        },

        /**
         * Event mapping helper.
         *
         * @method getEventName
         * @param  {String} mdlEventName media_jwplayer plugin event.
         * @return {String}
         */
        getEventName: function(mdlEventName) {
            return player.eventMap[mdlEventName];
        },

        /**
         * Event logging.
         *
         * @method logEvent
         * @param {Object} event JW Player event.
         */
        logEvent: function(event) {
            let args = {
                context:    player.context,
                event:      player.flipEventMap[event.type],
                title:      this.getPlaylistItem().file,
                position:   parseInt(this.getPosition())
            };

            if (typeof this.getPlaylistItem().title !== 'undefined') {
                // If title is defined, use it.
                args.title = this.getPlaylistItem().title;
            }

            if (event.type === 'seek') {
                // Offset is only valid for 'seek' event.
                args.offset = parseInt(event.offset);
            }

            if (event.type !== 'error') {
                $.when(
                    ajax.call([
                        {
                            methodname: 'media_jwplayer_playback_event',
                            args: args
                        }
                    ])[0]
                ).fail(log.error);
            }
        },

        /**
         * Error logging.
         *
         * @method logError
         * @param  {Object} event JW Player event.
         */
        logError: function(event) {
            if (event.type === 'error') {
                log.error('media_jwplayer error: ' + event.message);
            } else if (event.type === 'setupError'){
                log.error('media_jwplayer setup error: ' + event.message);
            }
        }
    };

    return /** @alias module:media_jwplayer/jwplayer */ {
        /**
         * Setup player instance.
         *
         * @method  setupPlayer
         * @param   {Object}    playerSetup JW Player setup parameters.
         * @param   {Number}    context     The context of the current page.
         */
        setupPlayer: player.init
    };
});